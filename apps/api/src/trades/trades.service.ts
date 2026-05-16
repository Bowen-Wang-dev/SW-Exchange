import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { aliasedTable } from "drizzle-orm/alias";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { formatMinimalUnitsToHuman } from "../common/money.js";
import { DRIZZLE_DB } from "../db/database.module.js";
import type { Database } from "../db/database.module.js";
import { assets, markets, trades, users } from "../db/schema/index.js";

const SUPPORTED_MARKET_SYMBOL = "SWL/SWC";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

type TradeRow = {
  id: string;
  marketId: string;
  marketSymbol: string;
  buyOrderId: string;
  sellOrderId: string;
  buyerId: string;
  buyerEmail: string;
  buyerUsername: string;
  sellerId: string;
  sellerEmail: string;
  sellerUsername: string;
  price: bigint;
  priceDecimals: number;
  amount: bigint;
  quoteAmount: bigint;
  buyerFee: bigint;
  sellerFee: bigint;
  buyerFeeAssetId: string;
  buyerFeeAssetSymbol: string;
  buyerFeeAssetDecimals: number;
  sellerFeeAssetId: string;
  sellerFeeAssetSymbol: string;
  sellerFeeAssetDecimals: number;
  buyerFeeRateBps: number;
  sellerFeeRateBps: number;
  status: "SETTLED" | "REVERSED";
  createdAt: Date;
  baseAssetSymbol: string;
  baseAssetDecimals: number;
  quoteAssetSymbol: string;
  quoteAssetDecimals: number;
};

type TradeRecordInput = {
  marketId: string;
  buyOrderId: string;
  sellOrderId: string;
  buyerId: string;
  sellerId: string;
  price: bigint;
  amount: bigint;
  quoteAmount: bigint;
  buyerFee: bigint;
  sellerFee: bigint;
  buyerFeeAssetId: string;
  sellerFeeAssetId: string;
  buyerFeeRateBps: number;
  sellerFeeRateBps: number;
};

@Injectable()
export class TradesService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Database) {}

  async createTradeRecord(tx: Transaction, input: TradeRecordInput) {
    const [trade] = await tx
      .insert(trades)
      .values({
        marketId: input.marketId,
        buyOrderId: input.buyOrderId,
        sellOrderId: input.sellOrderId,
        buyerId: input.buyerId,
        sellerId: input.sellerId,
        price: input.price,
        amount: input.amount,
        quoteAmount: input.quoteAmount,
        buyerFee: input.buyerFee,
        sellerFee: input.sellerFee,
        buyerFeeAssetId: input.buyerFeeAssetId,
        sellerFeeAssetId: input.sellerFeeAssetId,
        buyerFeeRateBps: input.buyerFeeRateBps,
        sellerFeeRateBps: input.sellerFeeRateBps,
        status: "SETTLED",
      })
      .returning();

    if (!trade) {
      throw new Error("Failed to create trade record.");
    }

    return trade;
  }

  async listRecent(marketSymbolInput = SUPPORTED_MARKET_SYMBOL) {
    const marketSymbol = this.normalizeMarketSymbol(marketSymbolInput);
    const rows = await this.selectTradeRows()
      .where(eq(markets.symbol, marketSymbol))
      .orderBy(desc(trades.createdAt), desc(trades.id))
      .limit(100);

    return rows.map((row) => this.formatPublicTrade(row));
  }

  async listMine(userId: string) {
    const rows = await this.selectTradeRows()
      .where(or(eq(trades.buyerId, userId), eq(trades.sellerId, userId)))
      .orderBy(desc(trades.createdAt), desc(trades.id))
      .limit(300);

    return rows.map((row) =>
      this.formatUserTrade(row, row.buyerId === userId ? "BUY" : "SELL"),
    );
  }

  async listAllForAdmin() {
    const rows = await this.selectTradeRows()
      .orderBy(desc(trades.createdAt), desc(trades.id))
      .limit(500);

    return rows.map((row) => this.formatAdminTrade(row));
  }

  private selectTradeRows(db: Database | Transaction = this.db) {
    const baseAssets = aliasedTable(assets, "trade_base_assets");
    const quoteAssets = aliasedTable(assets, "trade_quote_assets");
    const buyerFeeAssets = aliasedTable(assets, "trade_buyer_fee_assets");
    const sellerFeeAssets = aliasedTable(assets, "trade_seller_fee_assets");
    const buyerUsers = aliasedTable(users, "trade_buyer_users");
    const sellerUsers = aliasedTable(users, "trade_seller_users");

    return db
      .select({
        id: trades.id,
        marketId: trades.marketId,
        marketSymbol: markets.symbol,
        buyOrderId: trades.buyOrderId,
        sellOrderId: trades.sellOrderId,
        buyerId: trades.buyerId,
        buyerEmail: buyerUsers.email,
        buyerUsername: buyerUsers.username,
        sellerId: trades.sellerId,
        sellerEmail: sellerUsers.email,
        sellerUsername: sellerUsers.username,
        price: trades.price,
        priceDecimals: markets.priceDecimals,
        amount: trades.amount,
        quoteAmount: trades.quoteAmount,
        buyerFee: trades.buyerFee,
        sellerFee: trades.sellerFee,
        buyerFeeAssetId: trades.buyerFeeAssetId,
        buyerFeeAssetSymbol: buyerFeeAssets.symbol,
        buyerFeeAssetDecimals: buyerFeeAssets.decimals,
        sellerFeeAssetId: trades.sellerFeeAssetId,
        sellerFeeAssetSymbol: sellerFeeAssets.symbol,
        sellerFeeAssetDecimals: sellerFeeAssets.decimals,
        buyerFeeRateBps: trades.buyerFeeRateBps,
        sellerFeeRateBps: trades.sellerFeeRateBps,
        status: trades.status,
        createdAt: trades.createdAt,
        baseAssetSymbol: baseAssets.symbol,
        baseAssetDecimals: baseAssets.decimals,
        quoteAssetSymbol: quoteAssets.symbol,
        quoteAssetDecimals: quoteAssets.decimals,
      })
      .from(trades)
      .innerJoin(markets, eq(trades.marketId, markets.id))
      .innerJoin(baseAssets, eq(markets.baseAssetId, baseAssets.id))
      .innerJoin(quoteAssets, eq(markets.quoteAssetId, quoteAssets.id))
      .innerJoin(buyerFeeAssets, eq(trades.buyerFeeAssetId, buyerFeeAssets.id))
      .innerJoin(sellerFeeAssets, eq(trades.sellerFeeAssetId, sellerFeeAssets.id))
      .innerJoin(buyerUsers, eq(trades.buyerId, buyerUsers.id))
      .innerJoin(sellerUsers, eq(trades.sellerId, sellerUsers.id));
  }

  private normalizeMarketSymbol(input: string) {
    const symbol = input.trim().toUpperCase();

    if (symbol !== SUPPORTED_MARKET_SYMBOL) {
      throw new BadRequestException("Only SWL/SWC is supported in v0.7.");
    }

    return symbol;
  }

  private formatPublicTrade(row: TradeRow) {
    return {
      id: row.id,
      marketId: row.marketId,
      marketSymbol: row.marketSymbol,
      market: row.marketSymbol,
      price: formatMinimalUnitsToHuman(row.price, row.priceDecimals),
      priceRaw: row.price.toString(),
      amount: formatMinimalUnitsToHuman(row.amount, row.baseAssetDecimals),
      amountRaw: row.amount.toString(),
      quoteAmount: formatMinimalUnitsToHuman(row.quoteAmount, row.quoteAssetDecimals),
      quoteAmountRaw: row.quoteAmount.toString(),
      buyerFee: formatMinimalUnitsToHuman(row.buyerFee, row.buyerFeeAssetDecimals),
      buyerFeeRaw: row.buyerFee.toString(),
      buyerFeeAssetId: row.buyerFeeAssetId,
      buyerFeeAssetSymbol: row.buyerFeeAssetSymbol,
      buyerFeeRateBps: row.buyerFeeRateBps,
      sellerFee: formatMinimalUnitsToHuman(row.sellerFee, row.sellerFeeAssetDecimals),
      sellerFeeRaw: row.sellerFee.toString(),
      sellerFeeAssetId: row.sellerFeeAssetId,
      sellerFeeAssetSymbol: row.sellerFeeAssetSymbol,
      sellerFeeRateBps: row.sellerFeeRateBps,
      createdAt: row.createdAt,
      created_at: row.createdAt,
    };
  }

  private formatUserTrade(row: TradeRow, side: "BUY" | "SELL") {
    return {
      ...this.formatPublicTrade(row),
      side,
      buyerId: row.buyerId,
      sellerId: row.sellerId,
      buyer: {
        id: row.buyerId,
        email: row.buyerEmail,
        username: row.buyerUsername,
      },
      seller: {
        id: row.sellerId,
        email: row.sellerEmail,
        username: row.sellerUsername,
      },
      fee:
        side === "BUY"
          ? formatMinimalUnitsToHuman(row.buyerFee, row.buyerFeeAssetDecimals)
          : formatMinimalUnitsToHuman(row.sellerFee, row.sellerFeeAssetDecimals),
      feeRaw: side === "BUY" ? row.buyerFee.toString() : row.sellerFee.toString(),
      feeAssetSymbol: side === "BUY" ? row.buyerFeeAssetSymbol : row.sellerFeeAssetSymbol,
      feeRateBps: side === "BUY" ? row.buyerFeeRateBps : row.sellerFeeRateBps,
    };
  }

  private formatAdminTrade(row: TradeRow) {
    return {
      ...this.formatPublicTrade(row),
      buyer: {
        id: row.buyerId,
        email: row.buyerEmail,
        username: row.buyerUsername,
      },
      seller: {
        id: row.sellerId,
        email: row.sellerEmail,
        username: row.sellerUsername,
      },
    };
  }
}
