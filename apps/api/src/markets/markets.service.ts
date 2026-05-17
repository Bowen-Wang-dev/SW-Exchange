import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { aliasedTable } from "drizzle-orm/alias";
import { and, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import {
  formatMinimalUnitsToHuman,
  formatSignedMinimalUnitsToHuman,
} from "../common/money.js";
import { DRIZZLE_DB } from "../db/database.module.js";
import type { Database } from "../db/database.module.js";
import { assets, markets, orders, trades } from "../db/schema/index.js";

const SUPPORTED_MARKET_SYMBOL = "SWL/SWC";
const OPEN_ORDER_STATUSES = ["OPEN", "PARTIAL_FILLED"] as const;
const PERCENT_DECIMALS = 4;

type MarketDetails = {
  id: string;
  symbol: string;
  status: "ACTIVE" | "PAUSED";
  priceDecimals: number;
  amountDecimals: number;
  baseAssetId: string;
  baseAssetSymbol: string;
  baseAssetName: string;
  baseAssetDecimals: number;
  quoteAssetId: string;
  quoteAssetSymbol: string;
  quoteAssetName: string;
  quoteAssetDecimals: number;
};

type TradePriceRow = {
  id: string;
  price: bigint;
  amount: bigint;
  quoteAmount: bigint;
  createdAt: Date;
};

@Injectable()
export class MarketsService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Database) {}

  async findAll() {
    const baseAssets = aliasedTable(assets, "market_list_base_assets");
    const quoteAssets = aliasedTable(assets, "market_list_quote_assets");

    const rows = await this.db
      .select({
        id: markets.id,
        symbol: markets.symbol,
        baseAssetId: markets.baseAssetId,
        quoteAssetId: markets.quoteAssetId,
        status: markets.status,
        priceDecimals: markets.priceDecimals,
        amountDecimals: markets.amountDecimals,
        createdAt: markets.createdAt,
        updatedAt: markets.updatedAt,
        baseAssetSymbol: baseAssets.symbol,
        quoteAssetSymbol: quoteAssets.symbol,
      })
      .from(markets)
      .innerJoin(baseAssets, eq(markets.baseAssetId, baseAssets.id))
      .innerJoin(quoteAssets, eq(markets.quoteAssetId, quoteAssets.id));

    return rows.map((row) => ({
      ...row,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }));
  }

  async getTicker(marketSymbolInput = SUPPORTED_MARKET_SYMBOL) {
    const marketSymbol = this.normalizeMarketSymbol(marketSymbolInput);
    const market = await this.findMarketDetails(marketSymbol);

    if (!market) {
      throw new NotFoundException(`Market ${marketSymbol} was not found.`);
    }

    const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [lastTradeRows, trades24h, referenceTradeRows, openOrderRows, totalTradeCountRows] =
      await Promise.all([
        this.db
          .select({
            id: trades.id,
            price: trades.price,
            amount: trades.amount,
            quoteAmount: trades.quoteAmount,
            createdAt: trades.createdAt,
          })
          .from(trades)
          .where(and(eq(trades.marketId, market.id), eq(trades.status, "SETTLED")))
          .orderBy(desc(trades.createdAt), desc(trades.id))
          .limit(1),
        this.db
          .select({
            id: trades.id,
            price: trades.price,
            amount: trades.amount,
            quoteAmount: trades.quoteAmount,
            createdAt: trades.createdAt,
          })
          .from(trades)
          .where(
            and(
              eq(trades.marketId, market.id),
              eq(trades.status, "SETTLED"),
              gte(trades.createdAt, windowStart),
            ),
          )
          .orderBy(trades.createdAt, trades.id),
        this.db
          .select({
            id: trades.id,
            price: trades.price,
            amount: trades.amount,
            quoteAmount: trades.quoteAmount,
            createdAt: trades.createdAt,
          })
          .from(trades)
          .where(
            and(
              eq(trades.marketId, market.id),
              eq(trades.status, "SETTLED"),
              lte(trades.createdAt, windowStart),
            ),
          )
          .orderBy(desc(trades.createdAt), desc(trades.id))
          .limit(1),
        this.db
          .select({
            side: orders.side,
            price: orders.price,
          })
          .from(orders)
          .where(
            and(
              eq(orders.marketId, market.id),
              inArray(orders.status, OPEN_ORDER_STATUSES),
              sql`${orders.remainingAmount} > 0`,
            ),
          ),
        this.db
          .select({
            value: count(),
          })
          .from(trades)
          .where(and(eq(trades.marketId, market.id), eq(trades.status, "SETTLED"))),
      ]);

    const lastTrade = (lastTradeRows[0] as TradePriceRow | undefined) ?? null;
    const referenceTrade = (referenceTradeRows[0] as TradePriceRow | undefined) ?? null;
    const bestBid = this.findBestPrice(
      openOrderRows.filter((row) => row.side === "BUY").map((row) => row.price),
      "max",
    );
    const bestAsk = this.findBestPrice(
      openOrderRows.filter((row) => row.side === "SELL").map((row) => row.price),
      "min",
    );
    const stats24h = this.calculate24hStats(trades24h as TradePriceRow[]);
    const earliestTrade24h = (trades24h[0] as TradePriceRow | undefined) ?? null;
    const referencePrice = referenceTrade?.price ?? earliestTrade24h?.price ?? null;
    const priceChange =
      lastTrade && referencePrice !== null ? lastTrade.price - referencePrice : null;

    return {
      marketSymbol: market.symbol,
      baseAssetSymbol: market.baseAssetSymbol,
      quoteAssetSymbol: market.quoteAssetSymbol,
      lastPrice: this.formatNullable(lastTrade?.price ?? null, market.priceDecimals),
      bestBid: this.formatNullable(bestBid, market.priceDecimals),
      bestAsk: this.formatNullable(bestAsk, market.priceDecimals),
      high24h: this.formatNullable(stats24h.high, market.priceDecimals),
      low24h: this.formatNullable(stats24h.low, market.priceDecimals),
      volume24h: formatMinimalUnitsToHuman(stats24h.volume, market.baseAssetDecimals),
      quoteVolume24h: formatMinimalUnitsToHuman(
        stats24h.quoteVolume,
        market.quoteAssetDecimals,
      ),
      change24h:
        priceChange === null ? null : formatSignedMinimalUnitsToHuman(priceChange, market.priceDecimals),
      change24hPercent:
        priceChange === null || referencePrice === null || referencePrice <= 0n
          ? null
          : this.formatSignedPercent(priceChange, referencePrice),
      tradeCount24h: stats24h.tradeCount,
      totalTradeCount: totalTradeCountRows[0]?.value ?? 0,
      openOrderCount: openOrderRows.length,
      status: market.status,
      updatedAt: new Date(),
    };
  }

  async getSummary() {
    const marketRows = await this.findAll();

    return Promise.all(
      marketRows.filter((market) => market.symbol === SUPPORTED_MARKET_SYMBOL).map(async (market) => {
        const ticker = await this.getTicker(market.symbol);

        return {
          marketSymbol: ticker.marketSymbol,
          baseAssetSymbol: ticker.baseAssetSymbol,
          quoteAssetSymbol: ticker.quoteAssetSymbol,
          lastPrice: ticker.lastPrice,
          bestBid: ticker.bestBid,
          bestAsk: ticker.bestAsk,
          volume24h: ticker.volume24h,
          quoteVolume24h: ticker.quoteVolume24h,
          change24hPercent: ticker.change24hPercent,
          status: ticker.status,
        };
      }),
    );
  }

  async getLatestPrice(marketSymbolInput = SUPPORTED_MARKET_SYMBOL) {
    const marketSymbol = this.normalizeMarketSymbol(marketSymbolInput);
    const market = await this.findMarketDetails(marketSymbol);

    if (!market) {
      throw new NotFoundException(`Market ${marketSymbol} was not found.`);
    }

    const [lastTrade] = await this.db
      .select({
        price: trades.price,
        createdAt: trades.createdAt,
      })
      .from(trades)
      .where(and(eq(trades.marketId, market.id), eq(trades.status, "SETTLED")))
      .orderBy(desc(trades.createdAt), desc(trades.id))
      .limit(1);

    return {
      market,
      price: lastTrade?.price ?? null,
      priceDecimals: market.priceDecimals,
      pricedAt: lastTrade?.createdAt ?? null,
    };
  }

  private async findMarketDetails(marketSymbol: string) {
    const baseAssets = aliasedTable(assets, "market_details_base_assets");
    const quoteAssets = aliasedTable(assets, "market_details_quote_assets");

    const [market] = await this.db
      .select({
        id: markets.id,
        symbol: markets.symbol,
        status: markets.status,
        priceDecimals: markets.priceDecimals,
        amountDecimals: markets.amountDecimals,
        baseAssetId: markets.baseAssetId,
        baseAssetSymbol: baseAssets.symbol,
        baseAssetName: baseAssets.name,
        baseAssetDecimals: baseAssets.decimals,
        quoteAssetId: markets.quoteAssetId,
        quoteAssetSymbol: quoteAssets.symbol,
        quoteAssetName: quoteAssets.name,
        quoteAssetDecimals: quoteAssets.decimals,
      })
      .from(markets)
      .innerJoin(baseAssets, eq(markets.baseAssetId, baseAssets.id))
      .innerJoin(quoteAssets, eq(markets.quoteAssetId, quoteAssets.id))
      .where(eq(markets.symbol, marketSymbol))
      .limit(1);

    return (market as MarketDetails | undefined) ?? null;
  }

  private normalizeMarketSymbol(input = SUPPORTED_MARKET_SYMBOL) {
    const symbol = input.trim().toUpperCase();

    if (symbol !== SUPPORTED_MARKET_SYMBOL) {
      throw new BadRequestException("Only SWL/SWC is supported.");
    }

    return symbol;
  }

  private calculate24hStats(rows: TradePriceRow[]) {
    let high: bigint | null = null;
    let low: bigint | null = null;
    let volume = 0n;
    let quoteVolume = 0n;

    for (const row of rows) {
      high = high === null || row.price > high ? row.price : high;
      low = low === null || row.price < low ? row.price : low;
      volume += row.amount;
      quoteVolume += row.quoteAmount;
    }

    return {
      high,
      low,
      volume,
      quoteVolume,
      tradeCount: rows.length,
    };
  }

  private findBestPrice(prices: bigint[], direction: "max" | "min") {
    let best: bigint | null = null;

    for (const price of prices) {
      if (best === null) {
        best = price;
        continue;
      }

      if (direction === "max" ? price > best : price < best) {
        best = price;
      }
    }

    return best;
  }

  private formatNullable(value: bigint | null, decimals: number) {
    return value === null ? null : formatMinimalUnitsToHuman(value, decimals);
  }

  private formatSignedPercent(change: bigint, reference: bigint) {
    const sign = change > 0n ? "+" : change < 0n ? "-" : "";
    const absoluteChange = change < 0n ? -change : change;
    const scale = 10n ** BigInt(PERCENT_DECIMALS);
    const scaledPercent = (absoluteChange * 100n * scale) / reference;
    const whole = scaledPercent / scale;
    const fraction = (scaledPercent % scale)
      .toString()
      .padStart(PERCENT_DECIMALS, "0")
      .replace(/0+$/, "");

    return `${sign}${whole.toString()}${fraction ? `.${fraction}` : ""}`;
  }
}
