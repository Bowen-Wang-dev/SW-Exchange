import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { aliasedTable } from "drizzle-orm/alias";
import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import {
  formatMinimalUnitsToHuman,
  MoneyFormatError,
  parseHumanAmountToMinimalUnits,
} from "../common/money.js";
import { DRIZZLE_DB } from "../db/database.module.js";
import type { Database } from "../db/database.module.js";
import { assets, ledgerEntries, transfers, users, wallets } from "../db/schema/index.js";

type TransferDto = {
  recipient: string;
  assetSymbol: "SWC" | "SWL";
  amount: string;
  note?: string;
};

type TransferRow = {
  id: string;
  fromUserId: string | null;
  fromEmail: string | null;
  fromUsername: string | null;
  toUserId: string | null;
  toEmail: string | null;
  toUsername: string | null;
  assetSymbol: string | null;
  decimals: number | null;
  amount: bigint;
  note: string | null;
  status: string;
  createdAt: Date;
};

@Injectable()
export class TransfersService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Database) {}

  async create(senderUserId: string, dto: TransferDto) {
    const recipientIdentifier = dto.recipient?.trim();
    if (!recipientIdentifier) {
      throw new BadRequestException("Recipient username or email is required.");
    }

    const assetSymbol = dto.assetSymbol?.trim().toUpperCase();
    if (assetSymbol !== "SWC" && assetSymbol !== "SWL") {
      throw new BadRequestException("assetSymbol must be SWC or SWL.");
    }

    const note = dto.note?.trim() || null;

    return this.db.transaction(async (tx) => {
      const [sender] = await tx
        .select({
          id: users.id,
          email: users.email,
          username: users.username,
          nickname: users.nickname,
          role: users.role,
          status: users.status,
        })
        .from(users)
        .where(eq(users.id, senderUserId))
        .limit(1);

      if (!sender) {
        throw new NotFoundException("Sender user was not found.");
      }

      if (sender.status !== "ACTIVE") {
        throw new ForbiddenException("Sender must be ACTIVE to transfer.");
      }

      const [recipient] = await tx
        .select({
          id: users.id,
          email: users.email,
          username: users.username,
          nickname: users.nickname,
          role: users.role,
          status: users.status,
        })
        .from(users)
        .where(or(eq(users.username, recipientIdentifier), eq(users.email, recipientIdentifier)))
        .limit(1);

      if (!recipient) {
        throw new NotFoundException("Recipient not found.");
      }

      if (recipient.id === sender.id) {
        throw new BadRequestException("Cannot transfer to yourself.");
      }

      if (recipient.status !== "ACTIVE") {
        throw new ForbiddenException("Recipient must be ACTIVE to receive transfers.");
      }

      const [asset] = await tx
        .select()
        .from(assets)
        .where(and(eq(assets.symbol, assetSymbol), eq(assets.isActive, true)))
        .limit(1);

      if (!asset) {
        throw new NotFoundException(`Active asset ${assetSymbol} was not found.`);
      }

      const amount = this.parseTransferAmount(dto.amount, asset.decimals);

      await tx
        .insert(wallets)
        .values({
          userId: recipient.id,
          assetId: asset.id,
          availableBalance: 0n,
          lockedBalance: 0n,
        })
        .onConflictDoNothing();

      const walletRows = await tx
        .select()
        .from(wallets)
        .where(and(eq(wallets.assetId, asset.id), inArray(wallets.userId, [sender.id, recipient.id])))
        .orderBy(asc(wallets.userId))
        .for("update");

      const senderWallet = walletRows.find((wallet) => wallet.userId === sender.id);
      const recipientWallet = walletRows.find((wallet) => wallet.userId === recipient.id);

      if (!senderWallet) {
        throw new NotFoundException("Sender wallet was not found.");
      }

      if (!recipientWallet) {
        throw new NotFoundException("Recipient wallet was not found.");
      }

      if (senderWallet.availableBalance < amount) {
        throw new BadRequestException("Insufficient available balance.");
      }

      const senderAvailableAfter = senderWallet.availableBalance - amount;
      const recipientAvailableAfter = recipientWallet.availableBalance + amount;
      const updatedAt = new Date();

      await tx
        .update(wallets)
        .set({
          availableBalance: senderAvailableAfter,
          updatedAt,
        })
        .where(eq(wallets.id, senderWallet.id));

      await tx
        .update(wallets)
        .set({
          availableBalance: recipientAvailableAfter,
          updatedAt,
        })
        .where(eq(wallets.id, recipientWallet.id));

      const [transfer] = await tx
        .insert(transfers)
        .values({
          fromUserId: sender.id,
          toUserId: recipient.id,
          assetId: asset.id,
          amount,
          status: "SUCCESS",
          note,
          updatedAt,
        })
        .returning();

      if (!transfer) {
        throw new Error("Failed to create transfer record.");
      }

      await tx.insert(ledgerEntries).values([
        {
          userId: sender.id,
          assetId: asset.id,
          type: "TRANSFER_OUT",
          amount: -amount,
          balanceAvailableAfter: senderAvailableAfter,
          balanceLockedAfter: senderWallet.lockedBalance,
          refType: "TRANSFER",
          refId: transfer.id,
          note,
        },
        {
          userId: recipient.id,
          assetId: asset.id,
          type: "TRANSFER_IN",
          amount,
          balanceAvailableAfter: recipientAvailableAfter,
          balanceLockedAfter: recipientWallet.lockedBalance,
          refType: "TRANSFER",
          refId: transfer.id,
          note,
        },
      ]);

      return {
        id: transfer.id,
        from: this.formatUserSummary(sender),
        to: this.formatUserSummary(recipient),
        assetSymbol: asset.symbol,
        asset: asset.symbol,
        amount: formatMinimalUnitsToHuman(amount, asset.decimals),
        amountRaw: amount.toString(),
        senderNewAvailable: formatMinimalUnitsToHuman(senderAvailableAfter, asset.decimals),
        senderNewAvailableRaw: senderAvailableAfter.toString(),
        recipientNewAvailable: formatMinimalUnitsToHuman(recipientAvailableAfter, asset.decimals),
        recipientNewAvailableRaw: recipientAvailableAfter.toString(),
        createdAt: transfer.createdAt,
        created_at: transfer.createdAt,
      };
    });
  }

  async listForUser(userId: string) {
    const rows = await this.selectTransferRows()
      .where(or(eq(transfers.fromUserId, userId), eq(transfers.toUserId, userId)))
      .orderBy(desc(transfers.createdAt))
      .limit(200);

    return rows.map((row) => {
      const direction = row.toUserId === userId ? "IN" : "OUT";
      const counterparty =
        direction === "IN"
          ? { username: row.fromUsername, email: row.fromEmail }
          : { username: row.toUsername, email: row.toEmail };

      return {
        id: row.id,
        direction,
        counterparty: {
          username: counterparty.username ?? "deleted-user",
          email: counterparty.email ?? "",
        },
        counterpartyUsername: counterparty.username ?? "deleted-user",
        counterpartyEmail: counterparty.email ?? "",
        assetSymbol: row.assetSymbol ?? "UNKNOWN",
        asset: row.assetSymbol ?? "UNKNOWN",
        amount: this.formatTransferAmount(row),
        amountRaw: row.amount.toString(),
        note: row.note,
        status: row.status,
        createdAt: row.createdAt,
        created_at: row.createdAt,
      };
    });
  }

  async listAllForAdmin() {
    const rows = await this.selectTransferRows().orderBy(desc(transfers.createdAt)).limit(300);

    return rows.map((row) => ({
      id: row.id,
      from: {
        id: row.fromUserId,
        username: row.fromUsername ?? "deleted-user",
        email: row.fromEmail ?? "",
      },
      to: {
        id: row.toUserId,
        username: row.toUsername ?? "deleted-user",
        email: row.toEmail ?? "",
      },
      assetSymbol: row.assetSymbol ?? "UNKNOWN",
      asset: row.assetSymbol ?? "UNKNOWN",
      amount: this.formatTransferAmount(row),
      amountRaw: row.amount.toString(),
      note: row.note,
      status: row.status,
      createdAt: row.createdAt,
      created_at: row.createdAt,
    }));
  }

  private selectTransferRows() {
    const fromUsers = aliasedTable(users, "from_users");
    const toUsers = aliasedTable(users, "to_users");

    return this.db
      .select({
        id: transfers.id,
        fromUserId: transfers.fromUserId,
        fromEmail: fromUsers.email,
        fromUsername: fromUsers.username,
        toUserId: transfers.toUserId,
        toEmail: toUsers.email,
        toUsername: toUsers.username,
        assetSymbol: assets.symbol,
        decimals: assets.decimals,
        amount: transfers.amount,
        note: transfers.note,
        status: transfers.status,
        createdAt: transfers.createdAt,
      })
      .from(transfers)
      .leftJoin(fromUsers, eq(transfers.fromUserId, fromUsers.id))
      .leftJoin(toUsers, eq(transfers.toUserId, toUsers.id))
      .leftJoin(assets, eq(transfers.assetId, assets.id));
  }

  private parseTransferAmount(input: string, decimals: number) {
    try {
      return parseHumanAmountToMinimalUnits(input, decimals);
    } catch (error) {
      if (error instanceof MoneyFormatError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }

  private formatTransferAmount(row: Pick<TransferRow, "amount" | "decimals">) {
    return formatMinimalUnitsToHuman(row.amount, row.decimals ?? 0);
  }

  private formatUserSummary(user: {
    id: string;
    email: string;
    username: string;
    nickname: string | null;
    role: "USER" | "ADMIN";
    status: "ACTIVE" | "FROZEN" | "BANNED";
  }) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      nickname: user.nickname,
      role: user.role,
      status: user.status,
    };
  }
}
