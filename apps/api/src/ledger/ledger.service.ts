import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { formatMinimalUnitsToHuman, formatSignedMinimalUnitsToHuman } from "../common/money.js";
import { DRIZZLE_DB } from "../db/database.module.js";
import type { Database } from "../db/database.module.js";
import { adminAuditLogs, assets, ledgerEntries, users } from "../db/schema/index.js";

@Injectable()
export class LedgerService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Database) {}

  async listForUser(userId: string) {
    const rows = await this.db
      .select({
        id: ledgerEntries.id,
        userId: ledgerEntries.userId,
        assetId: ledgerEntries.assetId,
        type: ledgerEntries.type,
        amount: ledgerEntries.amount,
        balanceAvailableAfter: ledgerEntries.balanceAvailableAfter,
        balanceLockedAfter: ledgerEntries.balanceLockedAfter,
        refType: ledgerEntries.refType,
        refId: ledgerEntries.refId,
        note: ledgerEntries.note,
        createdAt: ledgerEntries.createdAt,
        assetSymbol: assets.symbol,
        assetName: assets.name,
        decimals: assets.decimals,
      })
      .from(ledgerEntries)
      .innerJoin(assets, eq(ledgerEntries.assetId, assets.id))
      .where(eq(ledgerEntries.userId, userId))
      .orderBy(desc(ledgerEntries.createdAt))
      .limit(200);

    return rows.map((entry) => this.formatLedgerEntry(entry));
  }

  async listAllForAdmin() {
    const rows = await this.db
      .select({
        id: ledgerEntries.id,
        userId: ledgerEntries.userId,
        userEmail: users.email,
        username: users.username,
        userRole: users.role,
        userStatus: users.status,
        isSystem: users.isSystem,
        assetId: ledgerEntries.assetId,
        type: ledgerEntries.type,
        amount: ledgerEntries.amount,
        balanceAvailableAfter: ledgerEntries.balanceAvailableAfter,
        balanceLockedAfter: ledgerEntries.balanceLockedAfter,
        refType: ledgerEntries.refType,
        refId: ledgerEntries.refId,
        note: ledgerEntries.note,
        createdAt: ledgerEntries.createdAt,
        auditAfterValue: adminAuditLogs.afterValue,
        assetSymbol: assets.symbol,
        assetName: assets.name,
        decimals: assets.decimals,
      })
      .from(ledgerEntries)
      .innerJoin(users, eq(ledgerEntries.userId, users.id))
      .innerJoin(assets, eq(ledgerEntries.assetId, assets.id))
      .leftJoin(
        adminAuditLogs,
        and(
          eq(ledgerEntries.refType, "ADMIN_WALLET_BUCKET_TRANSFER"),
          eq(ledgerEntries.refId, adminAuditLogs.id),
        ),
      )
      .orderBy(desc(ledgerEntries.createdAt))
      .limit(300);

    return rows.map((entry) => {
      const walletType = this.inferLedgerWalletType(entry);

      return {
        ...this.formatLedgerEntry(entry),
        user: {
          id: entry.userId,
          email: entry.userEmail,
          username: entry.username,
          role: entry.userRole,
          status: entry.userStatus,
          isSystem: entry.isSystem,
        },
        userEmail: entry.userEmail,
        username: entry.username,
        userRole: entry.userRole,
        role: entry.userRole,
        walletType,
        ownerType: entry.userRole === "ADMIN" && walletType !== "MAIN"
          ? "ADMIN_BUCKET"
          : "USER_WALLET",
      };
    });
  }

  formatLedgerEntry(entry: {
    id: string;
    userId: string;
    assetId: string;
    type: string;
    amount: bigint;
    balanceAvailableAfter: bigint;
    balanceLockedAfter: bigint;
    refType: string;
    refId: string | null;
    note: string | null;
    createdAt: Date;
    assetSymbol: string;
    assetName: string;
    decimals: number;
  }) {
    return {
      id: entry.id,
      userId: entry.userId,
      assetId: entry.assetId,
      type: entry.type,
      asset: entry.assetSymbol,
      assetSymbol: entry.assetSymbol,
      assetName: entry.assetName,
      amount: formatSignedMinimalUnitsToHuman(entry.amount, entry.decimals),
      amountRaw: entry.amount.toString(),
      availableAfter: formatMinimalUnitsToHuman(entry.balanceAvailableAfter, entry.decimals),
      lockedAfter: formatMinimalUnitsToHuman(entry.balanceLockedAfter, entry.decimals),
      availableAfterRaw: entry.balanceAvailableAfter.toString(),
      lockedAfterRaw: entry.balanceLockedAfter.toString(),
      refType: entry.refType,
      refId: entry.refId,
      ref_type: entry.refType,
      ref_id: entry.refId,
      note: entry.note,
      createdAt: entry.createdAt,
      created_at: entry.createdAt,
    };
  }

  private inferLedgerWalletType(entry: {
    type: string;
    amount: bigint;
    note: string | null;
    auditAfterValue?: unknown;
  }) {
    if (entry.type === "FEE" && entry.amount > 0n) {
      return "FEE";
    }

    if (entry.type === "ADMIN_BUCKET_TRANSFER_OUT") {
      const auditWalletType = this.findAuditWalletType(entry.auditAfterValue, "source");
      const walletType = auditWalletType ?? this.findWalletTypeInNote(entry.note);
      return walletType ?? "ADMIN_BUCKET";
    }

    if (entry.type === "ADMIN_BUCKET_TRANSFER_IN") {
      const auditWalletType = this.findAuditWalletType(entry.auditAfterValue, "destination");
      const walletType = auditWalletType ?? this.findWalletTypeInNote(entry.note);
      return walletType ?? "ADMIN_BUCKET";
    }

    return "MAIN";
  }

  private findAuditWalletType(value: unknown, side: "source" | "destination") {
    if (!value || typeof value !== "object") {
      return null;
    }

    const walletType = (value as Record<string, unknown>)[side];
    if (!walletType || typeof walletType !== "object") {
      return null;
    }

    const candidate = (walletType as Record<string, unknown>).walletType;
    if (typeof candidate !== "string") {
      return null;
    }

    return this.normalizeDisplayWalletType(candidate);
  }

  private findWalletTypeInNote(note: string | null) {
    if (!note) {
      return null;
    }

    for (const walletType of ["TREASURY", "AIRDROP", "FEE", "HOT", "MAIN"] as const) {
      if (note.toUpperCase().includes(walletType)) {
        return walletType;
      }
    }

    return null;
  }

  private normalizeDisplayWalletType(value: string) {
    const walletType = value.toUpperCase();
    if (
      walletType === "MAIN" ||
      walletType === "FEE" ||
      walletType === "TREASURY" ||
      walletType === "AIRDROP" ||
      walletType === "HOT"
    ) {
      return walletType;
    }

    return null;
  }
}
