import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, count, desc, eq, inArray, or } from "drizzle-orm";
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
  transfers,
  users,
  wallets,
  walletTypeValues,
} from "../db/schema/index.js";
import type { WalletType } from "../db/schema/index.js";
import { FeesService } from "../fees/fees.service.js";
import { LedgerService } from "../ledger/ledger.service.js";
import { OrdersService } from "../orders/orders.service.js";
import { TradesService } from "../trades/trades.service.js";
import { TransfersService } from "../transfers/transfers.service.js";
import { WalletsService } from "../wallets/wallets.service.js";
import type { AdminWalletBucketTransferDto } from "./dto/admin-wallet-bucket-transfer.dto.js";
import type { AirdropDto } from "./dto/airdrop.dto.js";
import type { UpdateFeeSettingsDto } from "./dto/update-fee-settings.dto.js";

const ADMIN_SYSTEM_WALLET_TYPES = ["FEE", "TREASURY", "AIRDROP", "HOT"] as const;
const WALLET_TYPE_LABELS: Record<WalletType, string> = {
  MAIN: "Admin Main Wallet",
  FEE: "Fee Wallet",
  TREASURY: "Treasury Wallet",
  AIRDROP: "Airdrop Wallet",
  HOT: "Hot Wallet",
};
const SYSTEM_WALLET_STATUSES: Record<(typeof ADMIN_SYSTEM_WALLET_TYPES)[number], string> = {
  FEE: "ACTIVE",
  TREASURY: "PLACEHOLDER",
  AIRDROP: "PLACEHOLDER",
  HOT: "FUTURE_V1",
};

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
    @Inject(FeesService) private readonly feesService: FeesService,
    @Inject(LedgerService) private readonly ledgerService: LedgerService,
    @Inject(OrdersService) private readonly ordersService: OrdersService,
    @Inject(TradesService) private readonly tradesService: TradesService,
    @Inject(TransfersService) private readonly transfersService: TransfersService,
    @Inject(WalletsService) private readonly walletsService: WalletsService,
  ) {}

  async dashboard() {
    const [[usersCount], [walletsCount], [ledgerCount], [transferCount], [auditLogCount], openOrdersCount] =
      await Promise.all([
        this.db.select({ value: count() }).from(users).where(eq(users.isSystem, false)),
        this.db.select({ value: count() }).from(wallets),
        this.db.select({ value: count() }).from(ledgerEntries),
        this.db.select({ value: count() }).from(transfers),
        this.db.select({ value: count() }).from(adminAuditLogs),
        this.ordersService.countOpenOrders(),
      ]);

    return {
      totalUsers: usersCount?.value ?? 0,
      totalWallets: walletsCount?.value ?? 0,
      totalLedgerEntries: ledgerCount?.value ?? 0,
      totalTransfers: transferCount?.value ?? 0,
      totalAuditLogs: auditLogCount?.value ?? 0,
      totalOpenOrders: openOrdersCount,
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
        isSystem: users.isSystem,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.isSystem, false))
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
        isSystem: users.isSystem,
        assetId: assets.id,
        walletType: wallets.walletType,
        symbol: assets.symbol,
        name: assets.name,
        decimals: assets.decimals,
        availableBalance: wallets.availableBalance,
        lockedBalance: wallets.lockedBalance,
      })
      .from(wallets)
      .innerJoin(users, eq(wallets.userId, users.id))
      .innerJoin(assets, eq(wallets.assetId, assets.id))
      .where(and(eq(users.isSystem, false), eq(wallets.walletType, "MAIN")))
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
        isSystem: wallet.isSystem,
      },
      email: wallet.email,
      username: wallet.username,
      isSystem: wallet.isSystem,
    }));
  }

  async getAdminWallet(adminUserId: string) {
    await this.walletsService.ensureWalletsForUser(adminUserId);
    return this.listAdminWalletsByType(adminUserId, ["MAIN"]);
  }

  async getAdminSystemWallets(adminUserId: string) {
    await this.walletsService.ensureAdminBucketWallets(adminUserId);
    return this.listAdminWalletsByType(adminUserId, [...ADMIN_SYSTEM_WALLET_TYPES]);
  }

  async transferAdminWalletBucket(adminUserId: string, dto: AdminWalletBucketTransferDto) {
    const fromWalletType = this.normalizeWalletType(dto.fromWalletType);
    const toWalletType = this.normalizeWalletType(dto.toWalletType);

    if (fromWalletType === toWalletType) {
      throw new BadRequestException("fromWalletType and toWalletType must be different.");
    }

    const assetSymbol = dto.assetSymbol.trim().toUpperCase();
    if (assetSymbol !== "SWC" && assetSymbol !== "SWL") {
      throw new BadRequestException("assetSymbol must be SWC or SWL.");
    }

    return this.db.transaction(async (tx) => {
      const [adminUser] = await tx
        .select({
          id: users.id,
          role: users.role,
          status: users.status,
          isSystem: users.isSystem,
        })
        .from(users)
        .where(eq(users.id, adminUserId))
        .limit(1);

      if (!adminUser) {
        throw new NotFoundException("Admin user was not found.");
      }

      if (adminUser.role !== "ADMIN" || adminUser.isSystem || adminUser.status !== "ACTIVE") {
        throw new BadRequestException("Only an active admin user can transfer wallet buckets.");
      }

      const [asset] = await tx
        .select()
        .from(assets)
        .where(and(eq(assets.symbol, assetSymbol), eq(assets.isActive, true)))
        .limit(1);

      if (!asset) {
        throw new NotFoundException(`Active asset ${assetSymbol} was not found.`);
      }

      const amount = this.parseAdminBucketTransferAmount(dto.amount, asset.decimals);
      const note = dto.note?.trim() || null;

      await tx
        .insert(wallets)
        .values([
          {
            userId: adminUser.id,
            assetId: asset.id,
            walletType: fromWalletType,
            availableBalance: 0n,
            lockedBalance: 0n,
          },
          {
            userId: adminUser.id,
            assetId: asset.id,
            walletType: toWalletType,
            availableBalance: 0n,
            lockedBalance: 0n,
          },
        ])
        .onConflictDoNothing();

      const walletRows = await tx
        .select()
        .from(wallets)
        .where(
          and(
            eq(wallets.userId, adminUser.id),
            eq(wallets.assetId, asset.id),
            or(eq(wallets.walletType, fromWalletType), eq(wallets.walletType, toWalletType)),
          ),
        )
        .for("update");

      const sourceWallet = walletRows.find((wallet) => wallet.walletType === fromWalletType);
      const destinationWallet = walletRows.find((wallet) => wallet.walletType === toWalletType);

      if (!sourceWallet || !destinationWallet) {
        throw new Error("Failed to load admin bucket wallets.");
      }

      if (sourceWallet.lockedBalance < 0n || destinationWallet.lockedBalance < 0n) {
        throw new BadRequestException("Locked balances cannot be transferred.");
      }

      if (sourceWallet.availableBalance < amount) {
        throw new BadRequestException("Insufficient available balance.");
      }

      const sourceAvailableAfter = sourceWallet.availableBalance - amount;
      const destinationAvailableAfter = destinationWallet.availableBalance + amount;
      const updatedAt = new Date();

      await tx
        .update(wallets)
        .set({ availableBalance: sourceAvailableAfter, updatedAt })
        .where(eq(wallets.id, sourceWallet.id));

      await tx
        .update(wallets)
        .set({ availableBalance: destinationAvailableAfter, updatedAt })
        .where(eq(wallets.id, destinationWallet.id));

      const beforeValue = {
        assetSymbol: asset.symbol,
        amountRaw: amount.toString(),
        amount: formatMinimalUnitsToHuman(amount, asset.decimals),
        fromWalletType,
        toWalletType,
        source: this.auditWalletBalance(sourceWallet, asset.decimals),
        destination: this.auditWalletBalance(destinationWallet, asset.decimals),
      };
      const afterValue = {
        assetSymbol: asset.symbol,
        amountRaw: amount.toString(),
        amount: formatMinimalUnitsToHuman(amount, asset.decimals),
        fromWalletType,
        toWalletType,
        source: {
          ...this.auditWalletBalance(sourceWallet, asset.decimals),
          availableRaw: sourceAvailableAfter.toString(),
          available: formatMinimalUnitsToHuman(sourceAvailableAfter, asset.decimals),
        },
        destination: {
          ...this.auditWalletBalance(destinationWallet, asset.decimals),
          availableRaw: destinationAvailableAfter.toString(),
          available: formatMinimalUnitsToHuman(destinationAvailableAfter, asset.decimals),
        },
        note,
      };

      const [auditLog] = await tx
        .insert(adminAuditLogs)
        .values({
          adminUserId: adminUser.id,
          action: "ADMIN_WALLET_BUCKET_TRANSFER",
          targetType: "ADMIN_WALLET_BUCKET",
          targetId: adminUser.id,
          beforeValue,
          afterValue,
        })
        .returning();

      if (!auditLog) {
        throw new Error("Failed to create admin audit log.");
      }

      await tx.insert(ledgerEntries).values([
        {
          userId: adminUser.id,
          assetId: asset.id,
          type: "ADMIN_BUCKET_TRANSFER_OUT",
          amount: -amount,
          balanceAvailableAfter: sourceAvailableAfter,
          balanceLockedAfter: sourceWallet.lockedBalance,
          refType: "ADMIN_WALLET_BUCKET_TRANSFER",
          refId: auditLog.id,
          note: note ?? `${WALLET_TYPE_LABELS[fromWalletType]} to ${WALLET_TYPE_LABELS[toWalletType]}`,
        },
        {
          userId: adminUser.id,
          assetId: asset.id,
          type: "ADMIN_BUCKET_TRANSFER_IN",
          amount,
          balanceAvailableAfter: destinationAvailableAfter,
          balanceLockedAfter: destinationWallet.lockedBalance,
          refType: "ADMIN_WALLET_BUCKET_TRANSFER",
          refId: auditLog.id,
          note: note ?? `${WALLET_TYPE_LABELS[toWalletType]} from ${WALLET_TYPE_LABELS[fromWalletType]}`,
        },
      ]);

      return {
        id: auditLog.id,
        assetSymbol: asset.symbol,
        asset: asset.symbol,
        amount: formatMinimalUnitsToHuman(amount, asset.decimals),
        amountRaw: amount.toString(),
        fromWalletType,
        toWalletType,
        source: {
          walletType: fromWalletType,
          available: formatMinimalUnitsToHuman(sourceAvailableAfter, asset.decimals),
          availableRaw: sourceAvailableAfter.toString(),
          locked: formatMinimalUnitsToHuman(sourceWallet.lockedBalance, asset.decimals),
          lockedRaw: sourceWallet.lockedBalance.toString(),
        },
        destination: {
          walletType: toWalletType,
          available: formatMinimalUnitsToHuman(destinationAvailableAfter, asset.decimals),
          availableRaw: destinationAvailableAfter.toString(),
          locked: formatMinimalUnitsToHuman(destinationWallet.lockedBalance, asset.decimals),
          lockedRaw: destinationWallet.lockedBalance.toString(),
        },
        auditLogId: auditLog.id,
      };
    });
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
          walletType: "MAIN",
          availableBalance: 0n,
          lockedBalance: 0n,
        })
        .onConflictDoNothing();

      const [wallet] = await tx
        .select()
        .from(wallets)
        .where(
          and(
            eq(wallets.userId, targetUser.id),
            eq(wallets.assetId, asset.id),
            eq(wallets.walletType, "MAIN"),
          ),
        )
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

  listTransfers() {
    return this.transfersService.listAllForAdmin();
  }

  listOrders() {
    return this.ordersService.listAllForAdmin();
  }

  listTrades() {
    return this.tradesService.listAllForAdmin();
  }

  getFeeSettings() {
    return this.feesService.getAdminFeeSettings();
  }

  updateFeeSettings(adminUserId: string, dto: UpdateFeeSettingsDto) {
    return this.feesService.updateFeeSettings(adminUserId, dto);
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

  private parseAdminBucketTransferAmount(input: string, decimals: number) {
    try {
      return parseHumanAmountToMinimalUnits(input, decimals);
    } catch (error) {
      if (error instanceof MoneyFormatError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }

  private async listAdminWalletsByType(adminUserId: string, walletTypes: WalletType[]) {
    const rows = await this.db
      .select({
        id: wallets.id,
        userId: wallets.userId,
        assetId: wallets.assetId,
        walletType: wallets.walletType,
        availableBalance: wallets.availableBalance,
        lockedBalance: wallets.lockedBalance,
        symbol: assets.symbol,
        name: assets.name,
        decimals: assets.decimals,
      })
      .from(wallets)
      .innerJoin(assets, eq(wallets.assetId, assets.id))
      .where(and(eq(wallets.userId, adminUserId), inArray(wallets.walletType, walletTypes)))
      .orderBy(asc(wallets.walletType), asc(assets.symbol));

    return rows
      .sort((left, right) => {
        const leftTypeIndex = walletTypes.indexOf(left.walletType);
        const rightTypeIndex = walletTypes.indexOf(right.walletType);
        if (leftTypeIndex !== rightTypeIndex) {
          return leftTypeIndex - rightTypeIndex;
        }

        return left.symbol.localeCompare(right.symbol);
      })
      .map((wallet) => {
        const formatted = this.walletsService.formatWalletRow(wallet);
        const walletType = wallet.walletType;
        const isSystemType = walletType !== "MAIN";

        return {
          ...formatted,
          walletType,
          displayName: WALLET_TYPE_LABELS[walletType],
          status: isSystemType
            ? SYSTEM_WALLET_STATUSES[walletType as (typeof ADMIN_SYSTEM_WALLET_TYPES)[number]]
            : "ACTIVE",
        };
      });
  }

  private normalizeWalletType(input: string): WalletType {
    const walletType = input.trim().toUpperCase();
    if (!walletTypeValues.includes(walletType as WalletType)) {
      throw new BadRequestException("Invalid wallet type.");
    }

    return walletType as WalletType;
  }

  private auditWalletBalance(
    wallet: {
      walletType: WalletType;
      availableBalance: bigint;
      lockedBalance: bigint;
    },
    decimals: number,
  ) {
    return {
      walletType: wallet.walletType,
      displayName: WALLET_TYPE_LABELS[wallet.walletType],
      availableRaw: wallet.availableBalance.toString(),
      lockedRaw: wallet.lockedBalance.toString(),
      available: formatMinimalUnitsToHuman(wallet.availableBalance, decimals),
      locked: formatMinimalUnitsToHuman(wallet.lockedBalance, decimals),
    };
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
