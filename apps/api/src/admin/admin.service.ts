import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { aliasedTable } from "drizzle-orm/alias";
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
  markets,
  orders,
  trades,
  transfers,
  users,
  wallets,
  walletTypeValues,
} from "../db/schema/index.js";
import type { WalletType } from "../db/schema/index.js";
import { FeesService } from "../fees/fees.service.js";
import { LedgerService } from "../ledger/ledger.service.js";
import { MarketsService } from "../markets/markets.service.js";
import { OrdersService } from "../orders/orders.service.js";
import { TradesService } from "../trades/trades.service.js";
import { TransfersService } from "../transfers/transfers.service.js";
import { WalletsService } from "../wallets/wallets.service.js";
import type { AdminWalletBucketTransferDto } from "./dto/admin-wallet-bucket-transfer.dto.js";
import type { AirdropDto } from "./dto/airdrop.dto.js";
import type { CreateAssetDto } from "./dto/create-asset.dto.js";
import type { CreateMarketDto } from "./dto/create-market.dto.js";
import type { UpdateAssetMetadataDto } from "./dto/update-asset-metadata.dto.js";
import type { UpdateAssetStatusDto } from "./dto/update-asset-status.dto.js";
import type { UpdateFeeSettingsDto } from "./dto/update-fee-settings.dto.js";
import type { UpdateMarketStatusDto } from "./dto/update-market-status.dto.js";
import type { UpdateUserStatusDto } from "./dto/update-user-status.dto.js";

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
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

@Injectable()
export class AdminService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    @Inject(FeesService) private readonly feesService: FeesService,
    @Inject(LedgerService) private readonly ledgerService: LedgerService,
    @Inject(MarketsService) private readonly marketsService: MarketsService,
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

  async reportsSummary() {
    const [
      [userCount],
      [activeUserCount],
      [frozenUserCount],
      [bannedUserCount],
      [walletCount],
      [orderCount],
      openOrderCount,
      [tradeCount],
      [transferCount],
      [pausedAssetCount],
      [pausedMarketCount],
      feeSettings,
      marketSummaries,
      recentTrades,
      recentTransfers,
      recentAuditLogs,
    ] = await Promise.all([
      this.db.select({ value: count() }).from(users).where(eq(users.isSystem, false)),
      this.db
        .select({ value: count() })
        .from(users)
        .where(and(eq(users.isSystem, false), eq(users.status, "ACTIVE"))),
      this.db
        .select({ value: count() })
        .from(users)
        .where(and(eq(users.isSystem, false), eq(users.status, "FROZEN"))),
      this.db
        .select({ value: count() })
        .from(users)
        .where(and(eq(users.isSystem, false), eq(users.status, "BANNED"))),
      this.db.select({ value: count() }).from(wallets),
      this.db.select({ value: count() }).from(orders),
      this.ordersService.countOpenOrders(),
      this.db.select({ value: count() }).from(trades),
      this.db.select({ value: count() }).from(transfers),
      this.db.select({ value: count() }).from(assets).where(eq(assets.isActive, false)),
      this.db.select({ value: count() }).from(markets).where(eq(markets.status, "PAUSED")),
      this.feesService.getAdminFeeSettings(),
      this.marketsService.getSummary(),
      this.tradesService.listAllForAdmin(),
      this.transfersService.listAllForAdmin(),
      this.listAuditLogs(),
    ]);

    const primaryMarketSummary =
      marketSummaries.find((market) => market.marketSymbol === "SWL/SWC") ??
      marketSummaries[0] ??
      null;

    return {
      userCount: userCount?.value ?? 0,
      activeUserCount: activeUserCount?.value ?? 0,
      frozenUserCount: frozenUserCount?.value ?? 0,
      bannedUserCount: bannedUserCount?.value ?? 0,
      walletCount: walletCount?.value ?? 0,
      orderCount: orderCount?.value ?? 0,
      openOrderCount,
      tradeCount: tradeCount?.value ?? 0,
      transferCount: transferCount?.value ?? 0,
      pausedAssetCount: pausedAssetCount?.value ?? 0,
      pausedMarketCount: pausedMarketCount?.value ?? 0,
      feeWalletBalances: feeSettings.feeWallet.balances,
      marketSummary: primaryMarketSummary
        ? {
            marketSymbol: primaryMarketSummary.marketSymbol,
            lastPrice: primaryMarketSummary.lastPrice,
            volume24h: primaryMarketSummary.volume24h,
            openOrderCount: primaryMarketSummary.openOrderCount,
            totalTradeCount: primaryMarketSummary.totalTradeCount,
            status: primaryMarketSummary.status,
            baseAssetSymbol: primaryMarketSummary.baseAssetSymbol,
            quoteAssetSymbol: primaryMarketSummary.quoteAssetSymbol,
          }
        : null,
      marketSummaries,
      recentTrades: recentTrades.slice(0, 5),
      recentTransfers: recentTransfers.slice(0, 5),
      recentAuditLogs: recentAuditLogs.slice(0, 5),
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

  async updateUserStatus(adminUserId: string, targetUserId: string, dto: UpdateUserStatusDto) {
    const requestedStatus = this.normalizeUserStatus(dto.status);
    const note = dto.note?.trim() || null;

    return this.db.transaction(async (tx) => {
      await this.assertActiveAdmin(tx, adminUserId);

      const [targetUser] = await tx
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
        .where(eq(users.id, targetUserId))
        .for("update")
        .limit(1);

      if (!targetUser || targetUser.isSystem) {
        throw new NotFoundException("Target user was not found.");
      }

      if (targetUser.id === adminUserId && requestedStatus !== "ACTIVE") {
        throw new ForbiddenException("Cannot freeze or ban your own admin account.");
      }

      if (targetUser.role === "ADMIN" && targetUser.status === "ACTIVE" && requestedStatus !== "ACTIVE") {
        const [activeAdminCount] = await tx
          .select({ value: count() })
          .from(users)
          .where(
            and(
              eq(users.role, "ADMIN"),
              eq(users.status, "ACTIVE"),
              eq(users.isSystem, false),
            ),
          );

        if ((activeAdminCount?.value ?? 0) <= 1) {
          throw new ForbiddenException("Cannot freeze or ban the only active admin account.");
        }
      }

      if (targetUser.status === requestedStatus) {
        return {
          ...targetUser,
          created_at: targetUser.createdAt,
          updated_at: targetUser.updatedAt,
        };
      }

      const updatedAt = new Date();
      const [updatedUser] = await tx
        .update(users)
        .set({
          status: requestedStatus,
          updatedAt,
        })
        .where(eq(users.id, targetUser.id))
        .returning({
          id: users.id,
          email: users.email,
          username: users.username,
          nickname: users.nickname,
          role: users.role,
          status: users.status,
          isSystem: users.isSystem,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        });

      if (!updatedUser) {
        throw new Error("Failed to update user status.");
      }

      await tx.insert(adminAuditLogs).values({
        adminUserId,
        action: "UPDATE_USER_STATUS",
        targetType: "USER",
        targetId: targetUser.id,
        beforeValue: {
          status: targetUser.status,
        },
        afterValue: {
          status: updatedUser.status,
          note,
        },
      });

      return {
        ...updatedUser,
        created_at: updatedUser.createdAt,
        updated_at: updatedUser.updatedAt,
      };
    });
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
        displayName: assets.displayName,
        iconUrl: assets.iconUrl,
        iconSource: assets.iconSource,
        description: assets.description,
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
    if (!assetSymbol || assetSymbol.length > 16) {
      throw new BadRequestException("assetSymbol is invalid.");
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
        .where(eq(assets.symbol, assetSymbol))
        .limit(1);

      if (!asset) {
        throw new NotFoundException(`Asset ${assetSymbol} was not found.`);
      }

      if (!asset.isActive) {
        throw new BadRequestException("ASSET_PAUSED");
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
    if (!assetSymbol || assetSymbol.length > 16) {
      throw new BadRequestException("assetSymbol is invalid.");
    }

    return this.db.transaction(async (tx) => {
      await this.assertActiveAdmin(tx, adminUserId);

      const [asset] = await tx
        .select()
        .from(assets)
        .where(eq(assets.symbol, assetSymbol))
        .limit(1);

      if (!asset) {
        throw new NotFoundException(`Asset ${assetSymbol} was not found.`);
      }

      if (!asset.isActive) {
        throw new BadRequestException("ASSET_PAUSED");
      }

      const amount = this.parseAirdropAmount(dto.amount, asset.decimals);
      const targetUser = await this.findTargetUser(tx, dto);
      if (targetUser.status !== "ACTIVE") {
        throw new ForbiddenException("TARGET_USER_NOT_ACTIVE");
      }

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

  async createAsset(adminUserId: string, dto: CreateAssetDto) {
    const symbol = this.normalizeAssetSymbol(dto.symbol);
    const name = this.normalizeRequiredName(dto.name, "name", 128);
    const displayName = this.trimToNull(dto.displayName);
    const description = this.trimToNull(dto.description);
    const iconUrl = this.normalizeIconUrl(dto.iconUrl);
    const isActive = this.normalizeOptionalAssetStatus(dto.status, dto.isActive, true);
    const decimals = this.normalizeDecimals(dto.decimals, "decimals");
    const sortOrder = dto.sortOrder ?? null;

    return this.db.transaction(async (tx) => {
      await this.assertActiveAdmin(tx, adminUserId);

      const [existingAsset] = await tx
        .select({ id: assets.id })
        .from(assets)
        .where(eq(assets.symbol, symbol))
        .limit(1);

      if (existingAsset) {
        throw new BadRequestException(`Asset ${symbol} already exists.`);
      }

      const [createdAsset] = await tx
        .insert(assets)
        .values({
          symbol,
          name,
          displayName,
          decimals,
          iconUrl,
          iconSource: iconUrl ? "MANUAL" : "FALLBACK",
          sortOrder,
          description,
          isActive,
        })
        .returning();

      if (!createdAsset) {
        throw new Error("Failed to create asset.");
      }

      await this.walletsService.ensureWalletCoverageForAsset(createdAsset.id, tx);

      await tx.insert(adminAuditLogs).values({
        adminUserId,
        action: "CREATE_ASSET",
        targetType: "ASSET",
        targetId: createdAsset.id,
        afterValue: this.assetAuditValue(createdAsset),
      });

      return this.formatAssetStatusResponse(createdAsset);
    });
  }

  async createMarket(adminUserId: string, dto: CreateMarketDto) {
    const baseAssetSymbol = this.normalizeAssetSymbol(dto.baseAssetSymbol);
    const quoteAssetSymbol = this.normalizeAssetSymbol(dto.quoteAssetSymbol);

    if (baseAssetSymbol === quoteAssetSymbol) {
      throw new BadRequestException("baseAssetSymbol and quoteAssetSymbol must be different.");
    }

    const symbol = this.normalizeMarketSymbol(dto.symbol?.trim() ? dto.symbol : `${baseAssetSymbol}/${quoteAssetSymbol}`);
    const status = this.normalizeOptionalAssetStatus(dto.status, dto.isActive, true)
      ? "ACTIVE"
      : "PAUSED";
    const priceDecimals = this.normalizePrecision(dto.pricePrecision, "pricePrecision");
    const amountDecimals = this.normalizePrecision(dto.amountPrecision, "amountPrecision");
    const note = dto.note?.trim() || null;

    return this.db.transaction(async (tx) => {
      await this.assertActiveAdmin(tx, adminUserId);

      const assetRows = await tx
        .select()
        .from(assets)
        .where(inArray(assets.symbol, [baseAssetSymbol, quoteAssetSymbol]));

      const baseAsset = assetRows.find((asset) => asset.symbol === baseAssetSymbol);
      const quoteAsset = assetRows.find((asset) => asset.symbol === quoteAssetSymbol);

      if (!baseAsset) {
        throw new NotFoundException(`Base asset ${baseAssetSymbol} was not found.`);
      }

      if (!quoteAsset) {
        throw new NotFoundException(`Quote asset ${quoteAssetSymbol} was not found.`);
      }

      if (symbol !== `${baseAssetSymbol}/${quoteAssetSymbol}`) {
        throw new BadRequestException(
          "symbol must match BASE/QUOTE for the selected assets in v0.x.",
        );
      }

      const [existingMarket] = await tx
        .select({ id: markets.id })
        .from(markets)
        .where(eq(markets.symbol, symbol))
        .limit(1);

      if (existingMarket) {
        throw new BadRequestException(`Market ${symbol} already exists.`);
      }

      if (status === "ACTIVE" && (!baseAsset.isActive || !quoteAsset.isActive)) {
        throw new BadRequestException(
          "Active markets require both base and quote assets to be ACTIVE. Create the market as PAUSED or resume the assets first.",
        );
      }

      const resolvedAmountDecimals = amountDecimals ?? baseAsset.decimals;
      const resolvedPriceDecimals = priceDecimals ?? 18;
      const minOrderAmount = this.parseOptionalMarketMinimum(
        dto.minOrderAmount,
        baseAsset.decimals,
        "minOrderAmount",
      );
      const minNotional = this.parseOptionalMarketMinimum(
        dto.minNotional,
        quoteAsset.decimals,
        "minNotional",
      );

      const [createdMarket] = await tx
        .insert(markets)
        .values({
          symbol,
          baseAssetId: baseAsset.id,
          quoteAssetId: quoteAsset.id,
          status,
          priceDecimals: resolvedPriceDecimals,
          amountDecimals: resolvedAmountDecimals,
          minOrderAmount,
          minNotional,
        })
        .returning();

      if (!createdMarket) {
        throw new Error("Failed to create market.");
      }

      const feeSetting = await this.feesService.ensureActiveFeeSetting(tx, createdMarket.symbol);
      const marketResponse = await this.loadFormattedMarketBySymbol(tx, createdMarket.symbol);
      if (!marketResponse) {
        throw new Error("Failed to load created market.");
      }

      await tx.insert(adminAuditLogs).values({
        adminUserId,
        action: "CREATE_MARKET",
        targetType: "MARKET",
        targetId: createdMarket.id,
        afterValue: {
          ...marketResponse,
          note,
          buyerFeeRateBps: feeSetting.buyerFeeRateBps,
          sellerFeeRateBps: feeSetting.sellerFeeRateBps,
          feeSettingId: feeSetting.id,
        },
      });

      return {
        ...marketResponse,
        feeSetting: {
          id: feeSetting.id,
          marketId: feeSetting.marketId,
          marketSymbol: feeSetting.marketSymbol,
          buyerFeeRateBps: feeSetting.buyerFeeRateBps,
          sellerFeeRateBps: feeSetting.sellerFeeRateBps,
          isActive: feeSetting.isActive,
        },
      };
    });
  }

  listLedger() {
    return this.ledgerService.listAllForAdmin();
  }

  listTransfers() {
    return this.transfersService.listAllForAdmin();
  }

  listOrders(filters: { status?: string; marketSymbol?: string; user?: string } = {}) {
    return this.ordersService.listAllForAdmin(filters);
  }

  listTrades(filters: { marketSymbol?: string; user?: string } = {}) {
    return this.tradesService.listAllForAdmin(filters);
  }

  getFeeSettings(marketSymbol?: string) {
    return this.feesService.getAdminFeeSettings(marketSymbol);
  }

  updateFeeSettings(adminUserId: string, dto: UpdateFeeSettingsDto) {
    return this.feesService.updateFeeSettings(adminUserId, dto);
  }

  async updateAssetStatus(adminUserId: string, symbol: string, dto: UpdateAssetStatusDto) {
    const assetSymbol = symbol.trim().toUpperCase();
    const isActive = this.normalizeAssetStatus(dto);
    const note = dto.note?.trim() || null;

    return this.db.transaction(async (tx) => {
      await this.assertActiveAdmin(tx, adminUserId);

      const [asset] = await tx
        .select()
        .from(assets)
        .where(eq(assets.symbol, assetSymbol))
        .for("update")
        .limit(1);

      if (!asset) {
        throw new NotFoundException(`Asset ${assetSymbol} was not found.`);
      }

      if (asset.isActive === isActive) {
        return this.formatAssetStatusResponse(asset);
      }

      const updatedAt = new Date();
      const [updatedAsset] = await tx
        .update(assets)
        .set({
          isActive,
          updatedAt,
        })
        .where(eq(assets.id, asset.id))
        .returning();

      if (!updatedAsset) {
        throw new Error("Failed to update asset status.");
      }

      await tx.insert(adminAuditLogs).values({
        adminUserId,
        action: "UPDATE_ASSET_STATUS",
        targetType: "ASSET",
        targetId: asset.id,
        beforeValue: {
          symbol: asset.symbol,
          status: asset.isActive ? "ACTIVE" : "PAUSED",
          isActive: asset.isActive,
        },
        afterValue: {
          symbol: updatedAsset.symbol,
          status: updatedAsset.isActive ? "ACTIVE" : "PAUSED",
          isActive: updatedAsset.isActive,
          note,
        },
      });

      return this.formatAssetStatusResponse(updatedAsset);
    });
  }

  async updateAssetMetadata(adminUserId: string, symbol: string, dto: UpdateAssetMetadataDto) {
    const assetSymbol = symbol.trim().toUpperCase();

    return this.db.transaction(async (tx) => {
      await this.assertActiveAdmin(tx, adminUserId);

      const [asset] = await tx
        .select()
        .from(assets)
        .where(eq(assets.symbol, assetSymbol))
        .for("update")
        .limit(1);

      if (!asset) {
        throw new NotFoundException(`Asset ${assetSymbol} was not found.`);
      }

      const beforeValue = this.assetMetadataAuditValue(asset);
      const metadataUpdate = this.normalizeAssetMetadata(dto, asset);
      const updatedAt = new Date();
      const [updatedAsset] = await tx
        .update(assets)
        .set({
          ...metadataUpdate,
          updatedAt,
        })
        .where(eq(assets.id, asset.id))
        .returning();

      if (!updatedAsset) {
        throw new Error("Failed to update asset metadata.");
      }

      await tx.insert(adminAuditLogs).values({
        adminUserId,
        action: "UPDATE_ASSET_METADATA",
        targetType: "ASSET",
        targetId: asset.id,
        beforeValue,
        afterValue: this.assetMetadataAuditValue(updatedAsset),
      });

      return this.formatAssetStatusResponse(updatedAsset);
    });
  }

  async updateMarketStatus(adminUserId: string, symbol: string, dto: UpdateMarketStatusDto) {
    const marketSymbol = symbol.trim().toUpperCase();
    const status = this.normalizeMarketStatus(dto.status);
    const note = dto.note?.trim() || null;

    return this.db.transaction(async (tx) => {
      await this.assertActiveAdmin(tx, adminUserId);

      const [market] = await tx
        .select()
        .from(markets)
        .where(eq(markets.symbol, marketSymbol))
        .for("update")
        .limit(1);

      if (!market) {
        throw new NotFoundException(`Market ${marketSymbol} was not found.`);
      }

      if (market.status === status) {
        const currentMarket = await this.loadFormattedMarketById(tx, market.id);
        if (!currentMarket) {
          throw new Error("Failed to load market.");
        }

        return currentMarket;
      }

      const updatedAt = new Date();
      const [updatedMarket] = await tx
        .update(markets)
        .set({
          status,
          updatedAt,
        })
        .where(eq(markets.id, market.id))
        .returning();

      if (!updatedMarket) {
        throw new Error("Failed to update market status.");
      }

      await tx.insert(adminAuditLogs).values({
        adminUserId,
        action: "UPDATE_MARKET_STATUS",
        targetType: "MARKET",
        targetId: market.id,
        beforeValue: {
          symbol: market.symbol,
          status: market.status,
        },
        afterValue: {
          symbol: updatedMarket.symbol,
          status: updatedMarket.status,
          note,
        },
      });

      const formattedMarket = await this.loadFormattedMarketById(tx, updatedMarket.id);
      if (!formattedMarket) {
        throw new Error("Failed to load updated market.");
      }

      return formattedMarket;
    });
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
        displayName: assets.displayName,
        iconUrl: assets.iconUrl,
        iconSource: assets.iconSource,
        description: assets.description,
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

  private normalizeUserStatus(input: string) {
    const status = input.trim().toUpperCase();
    if (status !== "ACTIVE" && status !== "FROZEN" && status !== "BANNED") {
      throw new BadRequestException("Invalid user status.");
    }

    return status;
  }

  private normalizeAssetStatus(dto: UpdateAssetStatusDto) {
    return this.normalizeOptionalAssetStatus(dto.status, dto.isActive);
  }

  private normalizeMarketStatus(input: string) {
    const status = input.trim().toUpperCase();
    if (status !== "ACTIVE" && status !== "PAUSED") {
      throw new BadRequestException("Invalid market status.");
    }

    return status;
  }

  private normalizeOptionalAssetStatus(
    statusInput?: string,
    isActiveInput?: boolean,
    defaultIsActive?: boolean,
  ) {
    if (typeof isActiveInput === "boolean") {
      return isActiveInput;
    }

    if (!statusInput?.trim()) {
      if (typeof defaultIsActive === "boolean") {
        return defaultIsActive;
      }

      throw new BadRequestException("status or isActive is required.");
    }

    const status = statusInput.trim().toUpperCase();
    if (status === "ACTIVE") {
      return true;
    }

    if (status === "PAUSED") {
      return false;
    }

    throw new BadRequestException("Invalid asset status.");
  }

  private normalizeAssetSymbol(input: string) {
    const symbol = input.trim().toUpperCase();
    if (!symbol) {
      throw new BadRequestException("symbol is required.");
    }

    if (!/^[A-Z0-9]{2,16}$/.test(symbol)) {
      throw new BadRequestException("symbol must be 2-16 uppercase letters or numbers.");
    }

    return symbol;
  }

  private normalizeMarketSymbol(input: string) {
    const symbol = input.trim().toUpperCase();
    if (!symbol) {
      throw new BadRequestException("symbol is required.");
    }

    if (!/^[A-Z0-9]{2,16}\/[A-Z0-9]{2,16}$/.test(symbol)) {
      throw new BadRequestException("symbol must look like BASE/QUOTE.");
    }

    return symbol;
  }

  private normalizeRequiredName(input: string, label: string, maxLength: number) {
    const value = input.trim();
    if (!value) {
      throw new BadRequestException(`${label} is required.`);
    }

    if (value.length > maxLength) {
      throw new BadRequestException(`${label} is too long.`);
    }

    return value;
  }

  private normalizeDecimals(input: number, label: string) {
    if (!Number.isInteger(input) || input < 0 || input > 18) {
      throw new BadRequestException(`${label} must be an integer between 0 and 18.`);
    }

    return input;
  }

  private normalizePrecision(input: number | undefined, label: string) {
    if (input === undefined) {
      return null;
    }

    if (!Number.isInteger(input) || input < 0 || input > 18) {
      throw new BadRequestException(`${label} must be an integer between 0 and 18.`);
    }

    return input;
  }

  private parseOptionalMarketMinimum(
    input: string | undefined,
    decimals: number,
    label: string,
  ) {
    const value = input?.trim();
    if (!value) {
      return 0n;
    }

    try {
      return parseHumanAmountToMinimalUnits(value, decimals);
    } catch (error) {
      if (error instanceof MoneyFormatError) {
        throw new BadRequestException(`${label}: ${error.message}`);
      }

      throw error;
    }
  }

  private async assertActiveAdmin(tx: Transaction, adminUserId: string) {
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
      throw new ForbiddenException("Only an active admin user can perform admin controls.");
    }

    return adminUser;
  }

  private formatAssetStatusResponse(asset: typeof assets.$inferSelect) {
    return {
      ...asset,
      displayName: asset.displayName ?? asset.name,
      display_name: asset.displayName ?? asset.name,
      iconUrl: asset.iconUrl,
      icon_url: asset.iconUrl,
      iconSource: asset.iconSource ?? (asset.iconUrl ? "MANUAL" : "FALLBACK"),
      icon_source: asset.iconSource ?? (asset.iconUrl ? "MANUAL" : "FALLBACK"),
      sortOrder: asset.sortOrder,
      sort_order: asset.sortOrder,
      status: asset.isActive ? "ACTIVE" : "PAUSED",
      created_at: asset.createdAt,
      updated_at: asset.updatedAt,
    };
  }

  private assetAuditValue(asset: typeof assets.$inferSelect) {
    return {
      id: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      displayName: asset.displayName ?? asset.name,
      iconUrl: asset.iconUrl,
      iconSource: asset.iconSource ?? (asset.iconUrl ? "MANUAL" : "FALLBACK"),
      sortOrder: asset.sortOrder,
      description: asset.description,
      decimals: asset.decimals,
      status: asset.isActive ? "ACTIVE" : "PAUSED",
      isActive: asset.isActive,
    };
  }

  private normalizeAssetMetadata(
    dto: UpdateAssetMetadataDto,
    asset: typeof assets.$inferSelect,
  ) {
    const iconUrl =
      dto.iconUrl === undefined ? asset.iconUrl : this.normalizeIconUrl(dto.iconUrl);

    return {
      displayName:
        dto.displayName === undefined ? asset.displayName : this.trimToNull(dto.displayName),
      iconUrl,
      iconSource: iconUrl ? "MANUAL" : "FALLBACK",
      sortOrder: dto.sortOrder === undefined ? asset.sortOrder : dto.sortOrder,
      description:
        dto.description === undefined ? asset.description : this.trimToNull(dto.description),
    };
  }

  private normalizeIconUrl(input: string | null | undefined) {
    const value = this.trimToNull(input);
    if (!value) {
      return null;
    }

    if (value.startsWith("/")) {
      if (value.startsWith("//")) {
        throw new BadRequestException("iconUrl must be an http(s) URL or a local absolute path.");
      }

      return value;
    }

    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new BadRequestException("iconUrl must be a valid URL.");
    }

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new BadRequestException("iconUrl must use http or https.");
    }

    return parsed.toString();
  }

  private trimToNull(input: string | null | undefined) {
    if (input === null || input === undefined) {
      return null;
    }

    const value = input.trim();
    return value ? value : null;
  }

  private assetMetadataAuditValue(asset: typeof assets.$inferSelect) {
    return {
      symbol: asset.symbol,
      displayName: asset.displayName,
      iconUrl: asset.iconUrl,
      iconSource: asset.iconSource,
      sortOrder: asset.sortOrder,
      description: asset.description,
    };
  }

  private async loadFormattedMarketById(tx: Transaction, marketId: string) {
    const baseAssets = aliasedTable(assets, "admin_market_base_assets");
    const quoteAssets = aliasedTable(assets, "admin_market_quote_assets");

    const [market] = await tx
      .select({
        id: markets.id,
        symbol: markets.symbol,
        baseAssetId: markets.baseAssetId,
        quoteAssetId: markets.quoteAssetId,
        status: markets.status,
        priceDecimals: markets.priceDecimals,
        amountDecimals: markets.amountDecimals,
        minOrderAmount: markets.minOrderAmount,
        minNotional: markets.minNotional,
        createdAt: markets.createdAt,
        updatedAt: markets.updatedAt,
        baseAssetSymbol: baseAssets.symbol,
        quoteAssetSymbol: quoteAssets.symbol,
        baseAssetName: baseAssets.name,
        quoteAssetName: quoteAssets.name,
        baseAssetDisplayName: baseAssets.displayName,
        quoteAssetDisplayName: quoteAssets.displayName,
        baseAssetIconUrl: baseAssets.iconUrl,
        quoteAssetIconUrl: quoteAssets.iconUrl,
        baseAssetIconSource: baseAssets.iconSource,
        quoteAssetIconSource: quoteAssets.iconSource,
        baseAssetDecimals: baseAssets.decimals,
        quoteAssetDecimals: quoteAssets.decimals,
      })
      .from(markets)
      .innerJoin(baseAssets, eq(markets.baseAssetId, baseAssets.id))
      .innerJoin(quoteAssets, eq(markets.quoteAssetId, quoteAssets.id))
      .where(eq(markets.id, marketId))
      .limit(1);

    if (!market) {
      return null;
    }

    return {
      id: market.id,
      symbol: market.symbol,
      baseAssetId: market.baseAssetId,
      quoteAssetId: market.quoteAssetId,
      status: market.status,
      priceDecimals: market.priceDecimals,
      amountDecimals: market.amountDecimals,
      minOrderAmount: formatMinimalUnitsToHuman(market.minOrderAmount, market.baseAssetDecimals),
      minOrderAmountRaw: market.minOrderAmount.toString(),
      minNotional: formatMinimalUnitsToHuman(market.minNotional, market.quoteAssetDecimals),
      minNotionalRaw: market.minNotional.toString(),
      baseAssetSymbol: market.baseAssetSymbol,
      quoteAssetSymbol: market.quoteAssetSymbol,
      baseAssetName: market.baseAssetName,
      quoteAssetName: market.quoteAssetName,
      baseAssetDisplayName: market.baseAssetDisplayName,
      quoteAssetDisplayName: market.quoteAssetDisplayName,
      baseAssetIconUrl: market.baseAssetIconUrl,
      quoteAssetIconUrl: market.quoteAssetIconUrl,
      baseAssetIconSource: market.baseAssetIconSource,
      quoteAssetIconSource: market.quoteAssetIconSource,
      createdAt: market.createdAt,
      updatedAt: market.updatedAt,
      created_at: market.createdAt,
      updated_at: market.updatedAt,
    };
  }

  private async loadFormattedMarketBySymbol(tx: Transaction, marketSymbol: string) {
    const [market] = await tx
      .select({ id: markets.id })
      .from(markets)
      .where(eq(markets.symbol, marketSymbol))
      .limit(1);

    return market ? this.loadFormattedMarketById(tx, market.id) : null;
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
