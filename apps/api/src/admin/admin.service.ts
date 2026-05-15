import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, count, desc, eq, or } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import {
  formatMinimalUnitsToHuman,
  MoneyFormatError,
  parseHumanAmountToMinimalUnits,
} from "../common/money.js";
import { DRIZZLE_DB } from "../db/database.module.js";
import type { Database } from "../db/database.module.js";
import {
  adminAuditLogs,
  assets,
  ledgerEntries,
  users,
  wallets,
} from "../db/schema/index.js";
import { LedgerService } from "../ledger/ledger.service.js";
import { WalletsService } from "../wallets/wallets.service.js";
import type { AirdropDto } from "./dto/airdrop.dto.js";

type WalletFilters = {
  userId?: string;
  username?: string;
  email?: string;
  assetSymbol?: string;
};

@Injectable()
export class AdminService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    @Inject(LedgerService) private readonly ledgerService: LedgerService,
    @Inject(WalletsService) private readonly walletsService: WalletsService,
  ) {}

  async dashboard() {
    const [[usersCount], [walletsCount], [ledgerCount], [auditLogCount]] = await Promise.all([
      this.db.select({ value: count() }).from(users),
      this.db.select({ value: count() }).from(wallets),
      this.db.select({ value: count() }).from(ledgerEntries),
      this.db.select({ value: count() }).from(adminAuditLogs),
    ]);

    return {
      totalUsers: usersCount?.value ?? 0,
      totalWallets: walletsCount?.value ?? 0,
      totalLedgerEntries: ledgerCount?.value ?? 0,
      totalAuditLogs: auditLogCount?.value ?? 0,
    };
  }

  async listUsers() {
    const rows = await this.db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        nickname: users.nickname,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    return rows.map((user) => ({
      ...user,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
    }));
  }

  async listWallets(filters: WalletFilters = {}) {
    await this.walletsService.ensureWalletsForAllUsers();

    const rows = await this.db
      .select({
        id: wallets.id,
        userId: users.id,
        email: users.email,
        username: users.username,
        assetId: assets.id,
        symbol: assets.symbol,
        name: assets.name,
        decimals: assets.decimals,
        availableBalance: wallets.availableBalance,
        lockedBalance: wallets.lockedBalance,
      })
      .from(wallets)
      .innerJoin(users, eq(wallets.userId, users.id))
      .innerJoin(assets, eq(wallets.assetId, assets.id))
      .orderBy(desc(users.createdAt), assets.symbol);

    const normalizedAssetSymbol = filters.assetSymbol?.trim().toUpperCase();
    const filteredRows = rows.filter((row) => {
      if (filters.userId?.trim() && row.userId !== filters.userId.trim()) {
        return false;
      }

      if (filters.username?.trim() && row.username !== filters.username.trim()) {
        return false;
      }

      if (filters.email?.trim() && row.email !== filters.email.trim()) {
        return false;
      }

      if (normalizedAssetSymbol && row.symbol !== normalizedAssetSymbol) {
        return false;
      }

      return true;
    });

    return filteredRows.map((wallet) => ({
      ...this.walletsService.formatWalletRow(wallet),
      user: {
        id: wallet.userId,
        email: wallet.email,
        username: wallet.username,
      },
      email: wallet.email,
      username: wallet.username,
    }));
  }

  async airdrop(adminUserId: string, dto: AirdropDto) {
    const identifiers = [dto.userId, dto.username, dto.email].filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    );

    if (identifiers.length === 0) {
      throw new BadRequestException("Provide userId, username, or email.");
    }

    const assetSymbol = dto.assetSymbol.trim().toUpperCase();
    if (assetSymbol !== "SWC" && assetSymbol !== "SWL") {
      throw new BadRequestException("assetSymbol must be SWC or SWL.");
    }

    return this.db.transaction(async (tx) => {
      const [asset] = await tx
        .select()
        .from(assets)
        .where(and(eq(assets.symbol, assetSymbol), eq(assets.isActive, true)))
        .limit(1);

      if (!asset) {
        throw new NotFoundException(`Active asset ${assetSymbol} was not found.`);
      }

      const amount = this.parseAirdropAmount(dto.amount, asset.decimals);
      const targetUser = await this.findTargetUser(tx, dto);

      await tx
        .insert(wallets)
        .values({
          userId: targetUser.id,
          assetId: asset.id,
          availableBalance: 0n,
          lockedBalance: 0n,
        })
        .onConflictDoNothing();

      const [wallet] = await tx
        .select()
        .from(wallets)
        .where(and(eq(wallets.userId, targetUser.id), eq(wallets.assetId, asset.id)))
        .for("update")
        .limit(1);

      if (!wallet) {
        throw new Error("Failed to load target wallet.");
      }

      const previousAvailable = wallet.availableBalance;
      const previousLocked = wallet.lockedBalance;
      const newAvailable = previousAvailable + amount;
      const note = dto.note?.trim() || null;

      await tx
        .update(wallets)
        .set({
          availableBalance: newAvailable,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, wallet.id));

      const beforeValue = {
        assetSymbol: asset.symbol,
        availableRaw: previousAvailable.toString(),
        lockedRaw: previousLocked.toString(),
        available: formatMinimalUnitsToHuman(previousAvailable, asset.decimals),
        locked: formatMinimalUnitsToHuman(previousLocked, asset.decimals),
      };
      const afterValue = {
        assetSymbol: asset.symbol,
        amountRaw: amount.toString(),
        amount: formatMinimalUnitsToHuman(amount, asset.decimals),
        availableRaw: newAvailable.toString(),
        lockedRaw: previousLocked.toString(),
        available: formatMinimalUnitsToHuman(newAvailable, asset.decimals),
        locked: formatMinimalUnitsToHuman(previousLocked, asset.decimals),
        note,
      };

      const [auditLog] = await tx
        .insert(adminAuditLogs)
        .values({
          adminUserId,
          action: "AIRDROP",
          targetType: "USER",
          targetId: targetUser.id,
          beforeValue,
          afterValue,
        })
        .returning();

      if (!auditLog) {
        throw new Error("Failed to create admin audit log.");
      }

      const [ledgerEntry] = await tx
        .insert(ledgerEntries)
        .values({
          userId: targetUser.id,
          assetId: asset.id,
          type: "AIRDROP",
          amount,
          balanceAvailableAfter: newAvailable,
          balanceLockedAfter: previousLocked,
          refType: "AIRDROP",
          refId: auditLog.id,
          note,
        })
        .returning();

      if (!ledgerEntry) {
        throw new Error("Failed to create ledger entry.");
      }

      return {
        targetUser: {
          id: targetUser.id,
          email: targetUser.email,
          username: targetUser.username,
          nickname: targetUser.nickname,
          role: targetUser.role,
          status: targetUser.status,
        },
        assetSymbol: asset.symbol,
        asset: asset.symbol,
        amount: formatMinimalUnitsToHuman(amount, asset.decimals),
        amountRaw: amount.toString(),
        newAvailable: formatMinimalUnitsToHuman(newAvailable, asset.decimals),
        newAvailableRaw: newAvailable.toString(),
        ledgerEntryId: ledgerEntry.id,
        auditLogId: auditLog.id,
      };
    });
  }

  listLedger() {
    return this.ledgerService.listAllForAdmin();
  }

  async listAuditLogs() {
    const rows = await this.db
      .select({
        id: adminAuditLogs.id,
        adminUserId: adminAuditLogs.adminUserId,
        adminEmail: users.email,
        adminUsername: users.username,
        action: adminAuditLogs.action,
        targetType: adminAuditLogs.targetType,
        targetId: adminAuditLogs.targetId,
        beforeValue: adminAuditLogs.beforeValue,
        afterValue: adminAuditLogs.afterValue,
        createdAt: adminAuditLogs.createdAt,
      })
      .from(adminAuditLogs)
      .innerJoin(users, eq(adminAuditLogs.adminUserId, users.id))
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(300);

    return rows.map((row) => ({
      id: row.id,
      adminUser: {
        id: row.adminUserId,
        email: row.adminEmail,
        username: row.adminUsername,
      },
      admin_user: {
        id: row.adminUserId,
        email: row.adminEmail,
        username: row.adminUsername,
      },
      action: row.action,
      targetType: row.targetType,
      target_type: row.targetType,
      targetId: row.targetId,
      target_id: row.targetId,
      beforeValue: row.beforeValue,
      before_value: row.beforeValue,
      afterValue: row.afterValue,
      after_value: row.afterValue,
      createdAt: row.createdAt,
      created_at: row.createdAt,
    }));
  }

  private parseAirdropAmount(input: string, decimals: number) {
    try {
      return parseHumanAmountToMinimalUnits(input, decimals);
    } catch (error) {
      if (error instanceof MoneyFormatError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }

  private async findTargetUser(tx: Parameters<Parameters<Database["transaction"]>[0]>[0], dto: AirdropDto) {
    const conditions: SQL[] = [];

    if (dto.userId?.trim()) {
      conditions.push(eq(users.id, dto.userId.trim()));
    }

    if (dto.username?.trim()) {
      conditions.push(eq(users.username, dto.username.trim()));
    }

    if (dto.email?.trim()) {
      conditions.push(eq(users.email, dto.email.trim()));
    }

    if (conditions.length === 0) {
      throw new BadRequestException("Provide userId, username, or email.");
    }

    const rows = await tx
      .select()
      .from(users)
      .where(conditions.length === 1 ? conditions[0]! : or(...conditions))
      .limit(2);

    if (rows.length === 0) {
      throw new NotFoundException("Target user was not found.");
    }

    if (rows.length > 1) {
      throw new BadRequestException("Provided identifiers match more than one user.");
    }

    return rows[0]!;
  }
}
