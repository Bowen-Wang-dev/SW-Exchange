import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, inArray } from "drizzle-orm";
import { DEFAULT_ASSETS } from "@sw-exchange/shared";
import { formatMinimalUnitsToHuman } from "../common/money.js";
import { DRIZZLE_DB } from "../db/database.module.js";
import type { Database } from "../db/database.module.js";
import { assets, users, wallets, walletTypeValues } from "../db/schema/index.js";
import type { WalletType } from "../db/schema/index.js";
import { MarketsService } from "../markets/markets.service.js";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DbLike = Database | Transaction;

@Injectable()
export class WalletsService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    @Inject(MarketsService) private readonly marketsService: MarketsService,
  ) {}

  async ensureWalletsForUser(userId: string, db: DbLike = this.db) {
    const activeSymbols = DEFAULT_ASSETS.map((asset) => asset.symbol);
    const assetRows = await db
      .select()
      .from(assets)
      .where(and(eq(assets.isActive, true), inArray(assets.symbol, activeSymbols)));

    for (const asset of assetRows) {
      await db
        .insert(wallets)
        .values({
          userId,
          assetId: asset.id,
          walletType: "MAIN",
          availableBalance: 0n,
          lockedBalance: 0n,
        })
        .onConflictDoNothing();
    }
  }

  async ensureAdminBucketWallets(userId: string, db: DbLike = this.db) {
    const activeSymbols = DEFAULT_ASSETS.map((asset) => asset.symbol);
    const assetRows = await db
      .select()
      .from(assets)
      .where(and(eq(assets.isActive, true), inArray(assets.symbol, activeSymbols)));

    for (const asset of assetRows) {
      for (const walletType of walletTypeValues) {
        await db
          .insert(wallets)
          .values({
            userId,
            assetId: asset.id,
            walletType,
            availableBalance: 0n,
            lockedBalance: 0n,
          })
          .onConflictDoNothing();
      }
    }
  }

  async ensureWalletsForAllUsers() {
    const userRows = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.isSystem, false));

    for (const user of userRows) {
      await this.ensureWalletsForUser(user.id);
    }
  }

  async findByUserId(userId: string) {
    await this.ensureWalletsForUser(userId);

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
      .where(and(eq(wallets.userId, userId), eq(wallets.walletType, "MAIN")))
      .orderBy(asc(assets.symbol));

    return rows.map((wallet) => this.formatWalletRow(wallet));
  }

  async getValuationByUserId(userId: string) {
    await this.ensureWalletsForUser(userId);

    const [walletRows, latestPrice] = await Promise.all([
      this.db
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
        .where(and(eq(wallets.userId, userId), eq(wallets.walletType, "MAIN")))
        .orderBy(asc(assets.symbol)),
      this.marketsService.getLatestPrice("SWL/SWC"),
    ]);

    const quoteAssetDecimals = latestPrice.market.quoteAssetDecimals;
    let totalEquity = 0n;
    let hasUnpricedBalance = false;

    const valuationAssets = walletRows.map((wallet) => {
      const total = wallet.availableBalance + wallet.lockedBalance;
      const priceInSwc = this.getAssetPriceInSwc(
        wallet.symbol,
        latestPrice.price,
        quoteAssetDecimals,
      );
      const valueInSwc =
        priceInSwc === null
          ? null
          : this.calculateValueInQuoteUnits({
              amount: total,
              price: priceInSwc,
              amountDecimals: wallet.decimals,
              priceDecimals: wallet.symbol === "SWC" ? quoteAssetDecimals : latestPrice.priceDecimals,
              quoteDecimals: quoteAssetDecimals,
            });

      if (valueInSwc === null && total > 0n) {
        hasUnpricedBalance = true;
      } else if (valueInSwc !== null) {
        totalEquity += valueInSwc;
      }

      return {
        assetSymbol: wallet.symbol,
        asset: wallet.symbol,
        assetName: wallet.name,
        name: wallet.name,
        displayName: wallet.displayName ?? wallet.name,
        iconUrl: wallet.iconUrl,
        iconSource: wallet.iconSource ?? (wallet.iconUrl ? "MANUAL" : "FALLBACK"),
        description: wallet.description,
        available: formatMinimalUnitsToHuman(wallet.availableBalance, wallet.decimals),
        locked: formatMinimalUnitsToHuman(wallet.lockedBalance, wallet.decimals),
        total: formatMinimalUnitsToHuman(total, wallet.decimals),
        availableRaw: wallet.availableBalance.toString(),
        lockedRaw: wallet.lockedBalance.toString(),
        totalRaw: total.toString(),
        priceInSWC:
          priceInSwc === null
            ? null
            : formatMinimalUnitsToHuman(
                priceInSwc,
                wallet.symbol === "SWC" ? quoteAssetDecimals : latestPrice.priceDecimals,
              ),
        priceInSWCRaw: priceInSwc?.toString() ?? null,
        valueInSWC:
          valueInSwc === null
            ? null
            : formatMinimalUnitsToHuman(valueInSwc, quoteAssetDecimals),
        valueInSWCRaw: valueInSwc?.toString() ?? null,
      };
    });

    return {
      quoteAssetSymbol: latestPrice.market.quoteAssetSymbol,
      totalEquity: formatMinimalUnitsToHuman(totalEquity, quoteAssetDecimals),
      totalEquityRaw: totalEquity.toString(),
      hasUnpricedAssets: hasUnpricedBalance,
      assets: valuationAssets,
      updatedAt: new Date(),
    };
  }

  formatWalletRow(wallet: {
    id?: string;
    userId?: string;
    assetId?: string;
    walletType?: WalletType;
    availableBalance: bigint;
    lockedBalance: bigint;
    symbol: string;
    name: string;
    displayName?: string | null;
    iconUrl?: string | null;
    iconSource?: string | null;
    description?: string | null;
    decimals: number;
  }) {
    const total = wallet.availableBalance + wallet.lockedBalance;

    return {
      id: wallet.id,
      userId: wallet.userId,
      assetId: wallet.assetId,
      walletType: wallet.walletType ?? "MAIN",
      asset: wallet.symbol,
      symbol: wallet.symbol,
      name: wallet.name,
      displayName: wallet.displayName ?? wallet.name,
      iconUrl: wallet.iconUrl ?? null,
      iconSource: wallet.iconSource ?? (wallet.iconUrl ? "MANUAL" : "FALLBACK"),
      description: wallet.description ?? null,
      decimals: wallet.decimals,
      available: formatMinimalUnitsToHuman(wallet.availableBalance, wallet.decimals),
      locked: formatMinimalUnitsToHuman(wallet.lockedBalance, wallet.decimals),
      total: formatMinimalUnitsToHuman(total, wallet.decimals),
      availableRaw: wallet.availableBalance.toString(),
      lockedRaw: wallet.lockedBalance.toString(),
      totalRaw: total.toString(),
    };
  }

  private getAssetPriceInSwc(
    symbol: string,
    latestSwlPrice: bigint | null,
    quoteAssetDecimals: number,
  ) {
    if (symbol === "SWC") {
      return 10n ** BigInt(quoteAssetDecimals);
    }

    if (symbol === "SWL") {
      return latestSwlPrice;
    }

    return null;
  }

  private calculateValueInQuoteUnits(input: {
    amount: bigint;
    price: bigint;
    amountDecimals: number;
    priceDecimals: number;
    quoteDecimals: number;
  }) {
    if (input.amount <= 0n) {
      return 0n;
    }

    return (
      (input.amount * input.price * 10n ** BigInt(input.quoteDecimals)) /
      10n ** BigInt(input.amountDecimals + input.priceDecimals)
    );
  }
}
