import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, eq, or } from "drizzle-orm";
import { formatMinimalUnitsToHuman } from "../common/money.js";
import { DRIZZLE_DB } from "../db/database.module.js";
import type { Database } from "../db/database.module.js";
import { adminAuditLogs, assets, feeSettings, markets, users, wallets } from "../db/schema/index.js";
import type { UpdateFeeSettingsDto } from "../admin/dto/update-fee-settings.dto.js";

const SUPPORTED_MARKET_SYMBOL = "SWL/SWC";
export const FEE_RATE_DENOMINATOR_BPS = 10_000n;
export const DEFAULT_FEE_RATE_BPS = 10;
export const MAX_FEE_RATE_BPS = 500;

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DbLike = Database | Transaction;
type FeeWalletBalance = {
  id: string;
  userId: string;
  assetId: string;
  walletType: "FEE";
  asset: string;
  symbol: string;
  name: string;
  displayName: string | null;
  iconUrl: string | null;
  iconSource: string | null;
  description: string | null;
  decimals: number;
  available: string;
  locked: string;
  total: string;
  availableRaw: string;
  lockedRaw: string;
  totalRaw: string;
};

export type ActiveFeeConfig = {
  feeSettingId: string;
  marketId: string;
  marketSymbol: string;
  buyerFeeRateBps: number;
  sellerFeeRateBps: number;
  adminFeeUserId: string;
};

type FeeSettingRow = typeof feeSettings.$inferSelect;

@Injectable()
export class FeesService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  async getAdminFeeSettings() {
    return this.db.transaction(async (tx) => {
      const setting = await this.ensureActiveFeeSetting(tx, SUPPORTED_MARKET_SYMBOL);
      const adminUser = await this.getConfiguredAdminUser(tx);
      await this.ensureAdminFeeWallets(tx, adminUser.id);
      const balances = await this.getAdminFeeWalletBalances(tx, adminUser.id);

      return this.formatAdminFeeSettings(setting, balances, adminUser);
    });
  }

  async updateFeeSettings(adminUserId: string, dto: UpdateFeeSettingsDto) {
    const marketSymbol = this.normalizeMarketSymbol(dto.marketSymbol);
    const buyerFeeRateBps = this.parseFeeRatePercentToBps(
      dto.buyerFeeRatePercent,
      "Buyer fee rate",
    );
    const sellerFeeRateBps = this.parseFeeRatePercentToBps(
      dto.sellerFeeRatePercent,
      "Seller fee rate",
    );
    const note = dto.note?.trim() || null;

    return this.db.transaction(async (tx) => {
      const current = await this.ensureActiveFeeSetting(tx, marketSymbol);
      const beforeValue = this.auditValueForSetting(current);
      const updatedAt = new Date();

      const [updated] = await tx
        .update(feeSettings)
        .set({
          buyerFeeRateBps,
          sellerFeeRateBps,
          isActive: true,
          updatedAt,
        })
        .where(eq(feeSettings.id, current.id))
        .returning();

      if (!updated) {
        throw new Error("Failed to update fee settings.");
      }

      const afterValue = {
        ...this.auditValueForSetting(updated),
        note,
      };

      await tx.insert(adminAuditLogs).values({
        adminUserId,
        action: "UPDATE_FEE_SETTINGS",
        targetType: "MARKET",
        targetId: updated.marketId,
        beforeValue,
        afterValue,
      });

      const adminUser = await this.getConfiguredAdminUser(tx);
      await this.ensureAdminFeeWallets(tx, adminUser.id);
      const balances = await this.getAdminFeeWalletBalances(tx, adminUser.id);

      return this.formatAdminFeeSettings(updated, balances, adminUser);
    });
  }

  async getActiveFeeConfigForMarket(tx: Transaction, marketId: string): Promise<ActiveFeeConfig> {
    const [market] = await tx
      .select({
        id: markets.id,
        symbol: markets.symbol,
      })
      .from(markets)
      .where(eq(markets.id, marketId))
      .limit(1);

    if (!market) {
      throw new NotFoundException("Market was not found for fee lookup.");
    }

    const setting = await this.ensureActiveFeeSetting(tx, market.symbol);
    const adminUser = await this.getConfiguredAdminUser(tx);
    await this.ensureAdminFeeWallets(tx, adminUser.id);

    return {
      feeSettingId: setting.id,
      marketId: setting.marketId,
      marketSymbol: setting.marketSymbol,
      buyerFeeRateBps: setting.buyerFeeRateBps,
      sellerFeeRateBps: setting.sellerFeeRateBps,
      adminFeeUserId: adminUser.id,
    };
  }

  async ensureActiveFeeSetting(db: DbLike, marketSymbolInput = SUPPORTED_MARKET_SYMBOL) {
    const marketSymbol = this.normalizeMarketSymbol(marketSymbolInput);
    const [market] = await db
      .select({
        id: markets.id,
        symbol: markets.symbol,
      })
      .from(markets)
      .where(eq(markets.symbol, marketSymbol))
      .limit(1);

    if (!market) {
      throw new NotFoundException(`Market ${marketSymbol} was not found.`);
    }

    const [existing] = await db
      .select()
      .from(feeSettings)
      .where(eq(feeSettings.marketSymbol, market.symbol))
      .limit(1);

    if (existing) {
      if (existing.marketId !== market.id || !existing.isActive) {
        const [updated] = await db
          .update(feeSettings)
          .set({
            marketId: market.id,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(feeSettings.id, existing.id))
          .returning();

        if (!updated) {
          throw new Error("Failed to repair fee settings.");
        }

        return updated;
      }

      return existing;
    }

    const [created] = await db
      .insert(feeSettings)
      .values({
        marketId: market.id,
        marketSymbol: market.symbol,
        buyerFeeRateBps: DEFAULT_FEE_RATE_BPS,
        sellerFeeRateBps: DEFAULT_FEE_RATE_BPS,
        isActive: true,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create default fee settings.");
    }

    return created;
  }

  calculateFee(amount: bigint, feeRateBps: number) {
    if (amount <= 0n || feeRateBps <= 0) {
      return 0n;
    }

    return (amount * BigInt(feeRateBps)) / FEE_RATE_DENOMINATOR_BPS;
  }

  formatBpsAsPercent(bps: number) {
    const whole = Math.trunc(bps / 100);
    const fractional = String(bps % 100).padStart(2, "0").replace(/0+$/, "");

    return fractional ? `${whole}.${fractional}` : String(whole);
  }

  formatBpsAsHuman(bps: number) {
    return `${this.formatBpsAsPercent(bps)}%`;
  }

  private async getConfiguredAdminUser(db: DbLike) {
    const adminEmail = this.configService.getOrThrow<string>("ADMIN_EMAIL");
    const [adminUser] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, adminEmail), eq(users.role, "ADMIN"), eq(users.isSystem, false)))
      .limit(1);

    if (!adminUser) {
      throw new NotFoundException("Configured admin user was not found.");
    }

    return adminUser;
  }

  private async ensureAdminFeeWallets(db: DbLike, adminUserId: string) {
    const assetRows = await db
      .select()
      .from(assets)
      .where(and(eq(assets.isActive, true), or(eq(assets.symbol, "SWC"), eq(assets.symbol, "SWL"))));

    for (const asset of assetRows) {
      await db
        .insert(wallets)
        .values({
          userId: adminUserId,
          assetId: asset.id,
          walletType: "FEE",
          availableBalance: 0n,
          lockedBalance: 0n,
        })
        .onConflictDoNothing();
    }
  }

  private async getAdminFeeWalletBalances(db: DbLike, adminUserId: string) {
    const rows = await db
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
      .where(and(eq(wallets.userId, adminUserId), eq(wallets.walletType, "FEE")));

    return rows
      .filter((wallet) => wallet.symbol === "SWC" || wallet.symbol === "SWL")
      .sort((a, b) => a.symbol.localeCompare(b.symbol))
      .map((wallet) => {
        const total = wallet.availableBalance + wallet.lockedBalance;

        return {
          id: wallet.id,
          userId: wallet.userId,
          assetId: wallet.assetId,
          walletType: "FEE" as const,
          asset: wallet.symbol,
          symbol: wallet.symbol,
          name: wallet.name,
          displayName: wallet.displayName ?? wallet.name,
          iconUrl: wallet.iconUrl,
          iconSource: wallet.iconSource ?? (wallet.iconUrl ? "MANUAL" : "FALLBACK"),
          description: wallet.description,
          decimals: wallet.decimals,
          available: formatMinimalUnitsToHuman(wallet.availableBalance, wallet.decimals),
          locked: formatMinimalUnitsToHuman(wallet.lockedBalance, wallet.decimals),
          total: formatMinimalUnitsToHuman(total, wallet.decimals),
          availableRaw: wallet.availableBalance.toString(),
          lockedRaw: wallet.lockedBalance.toString(),
          totalRaw: total.toString(),
        };
      });
  }

  private formatAdminFeeSettings(
    setting: FeeSettingRow,
    balances: FeeWalletBalance[],
    adminUser: { id: string; email: string; username: string; isSystem: boolean },
  ) {
    return {
      id: setting.id,
      marketId: setting.marketId,
      marketSymbol: setting.marketSymbol,
      market: setting.marketSymbol,
      buyerFeeRateBps: setting.buyerFeeRateBps,
      sellerFeeRateBps: setting.sellerFeeRateBps,
      buyerFeeRatePercent: this.formatBpsAsPercent(setting.buyerFeeRateBps),
      sellerFeeRatePercent: this.formatBpsAsPercent(setting.sellerFeeRateBps),
      buyerFeeRateHuman: this.formatBpsAsHuman(setting.buyerFeeRateBps),
      sellerFeeRateHuman: this.formatBpsAsHuman(setting.sellerFeeRateBps),
      rateUnit: "basis_points",
      rateDenominator: Number(FEE_RATE_DENOMINATOR_BPS),
      maxFeeRateBps: MAX_FEE_RATE_BPS,
      maxFeeRateHuman: this.formatBpsAsHuman(MAX_FEE_RATE_BPS),
      isActive: setting.isActive,
      feeWallet: {
        userId: adminUser.id,
        email: adminUser.email,
        username: adminUser.username,
        walletType: "FEE",
        displayName: "Fee Wallet",
        status: "ACTIVE",
        balances,
      },
      createdAt: setting.createdAt,
      updatedAt: setting.updatedAt,
      created_at: setting.createdAt,
      updated_at: setting.updatedAt,
    };
  }

  private auditValueForSetting(setting: FeeSettingRow) {
    return {
      marketSymbol: setting.marketSymbol,
      buyerFeeRateBps: setting.buyerFeeRateBps,
      sellerFeeRateBps: setting.sellerFeeRateBps,
      buyerFeeRatePercent: this.formatBpsAsPercent(setting.buyerFeeRateBps),
      sellerFeeRatePercent: this.formatBpsAsPercent(setting.sellerFeeRateBps),
      buyerFeeRateHuman: this.formatBpsAsHuman(setting.buyerFeeRateBps),
      sellerFeeRateHuman: this.formatBpsAsHuman(setting.sellerFeeRateBps),
      rateUnit: "basis_points",
    };
  }

  private normalizeMarketSymbol(input: string) {
    const symbol = input.trim().toUpperCase();

    if (symbol !== SUPPORTED_MARKET_SYMBOL) {
      throw new BadRequestException("Only SWL/SWC is supported.");
    }

    return symbol;
  }

  private parseFeeRatePercentToBps(input: string, label: string) {
    const value = input.trim();

    if (!value) {
      throw new BadRequestException(`${label} is required.`);
    }

    if (value.startsWith("-")) {
      throw new BadRequestException(`${label} must be greater than or equal to 0%.`);
    }

    if (value.startsWith("+")) {
      throw new BadRequestException(`${label} must not include a plus sign.`);
    }

    if (/[eE]/.test(value)) {
      throw new BadRequestException(`${label} must be a plain decimal string, not scientific notation.`);
    }

    if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
      throw new BadRequestException(`${label} must be a plain decimal percent string.`);
    }

    const [wholePart = "0", fractionalPart = ""] = value.split(".");
    if (fractionalPart.length > 2) {
      throw new BadRequestException(`${label} supports at most 2 decimal places when stored as basis points.`);
    }

    const bpsRaw = BigInt(wholePart) * 100n + BigInt(fractionalPart.padEnd(2, "0") || "0");
    if (bpsRaw > BigInt(MAX_FEE_RATE_BPS)) {
      throw new BadRequestException(`${label} must be less than or equal to ${this.formatBpsAsHuman(MAX_FEE_RATE_BPS)}.`);
    }

    return Number(bpsRaw);
  }
}
