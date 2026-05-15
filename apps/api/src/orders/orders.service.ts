import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { aliasedTable } from "drizzle-orm/alias";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import {
  calculateQuoteTotalMinimalUnits,
  formatMinimalUnitsToHuman,
  MoneyFormatError,
  parseHumanDecimalToMinimalUnits,
} from "../common/money.js";
import { DRIZZLE_DB } from "../db/database.module.js";
import type { Database } from "../db/database.module.js";
import { assets, ledgerEntries, markets, orders, users, wallets } from "../db/schema/index.js";
import type { CreateOrderDto } from "./dto/create-order.dto.js";

const SUPPORTED_MARKET_SYMBOL = "SWL/SWC";
const OPEN_ORDER_STATUSES = ["OPEN", "PARTIAL_FILLED"] as const;
const ORDER_STATUSES = ["OPEN", "PARTIAL_FILLED", "FILLED", "CANCELLED", "REJECTED"] as const;

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type OrderStatus = (typeof ORDER_STATUSES)[number];

type MarketDetails = {
  id: string;
  symbol: string;
  status: "ACTIVE" | "PAUSED";
  priceDecimals: number;
  amountDecimals: number;
  baseAssetId: string;
  baseAssetSymbol: string;
  baseAssetDecimals: number;
  quoteAssetId: string;
  quoteAssetSymbol: string;
  quoteAssetDecimals: number;
};

type OrderRow = {
  id: string;
  userId: string;
  marketId: string;
  marketSymbol: string;
  priceDecimals: number;
  amountDecimals: number;
  baseAssetSymbol: string;
  baseAssetDecimals: number;
  side: "BUY" | "SELL";
  type: "LIMIT";
  price: bigint;
  amount: bigint;
  filledAmount: bigint;
  remainingAmount: bigint;
  status: OrderStatus;
  lockedAssetId: string;
  lockedAssetSymbol: string;
  lockedAssetDecimals: number;
  lockedAmount: bigint;
  createdAt: Date;
  updatedAt: Date;
  cancelledAt: Date | null;
};

type AdminOrderRow = OrderRow & {
  userEmail: string;
  username: string;
};

@Injectable()
export class OrdersService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Database) {}

  async createLimitOrder(userId: string, dto: CreateOrderDto) {
    const marketSymbol = this.normalizeMarketSymbol(dto.marketSymbol);
    const side = this.normalizeSide(dto.side);

    return this.db.transaction(async (tx) => {
      const [user] = await tx
        .select({
          id: users.id,
          status: users.status,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        throw new NotFoundException("User was not found.");
      }

      if (user.status !== "ACTIVE") {
        throw new ForbiddenException("Only ACTIVE users can place orders.");
      }

      const market = await this.findMarketDetails(tx, marketSymbol);
      if (!market) {
        throw new NotFoundException(`Market ${marketSymbol} was not found.`);
      }

      if (market.status !== "ACTIVE") {
        throw new BadRequestException(`Market ${marketSymbol} is not active.`);
      }

      const price = this.parsePrice(dto.price, market.priceDecimals);
      const amount = this.parseAmount(dto.amount, market.baseAssetDecimals);
      const lockedAssetId = side === "BUY" ? market.quoteAssetId : market.baseAssetId;
      const lockedAssetSymbol = side === "BUY" ? market.quoteAssetSymbol : market.baseAssetSymbol;
      const lockedAssetDecimals =
        side === "BUY" ? market.quoteAssetDecimals : market.baseAssetDecimals;
      const lockedAmount =
        side === "BUY"
          ? this.calculateBuyLockedAmount(price, amount, market)
          : amount;

      await tx
        .insert(wallets)
        .values({
          userId,
          assetId: lockedAssetId,
          availableBalance: 0n,
          lockedBalance: 0n,
        })
        .onConflictDoNothing();

      const [wallet] = await tx
        .select()
        .from(wallets)
        .where(and(eq(wallets.userId, userId), eq(wallets.assetId, lockedAssetId)))
        .for("update")
        .limit(1);

      if (!wallet) {
        throw new Error(`Failed to load ${lockedAssetSymbol} wallet.`);
      }

      if (wallet.availableBalance < lockedAmount) {
        throw new BadRequestException("Insufficient available balance.");
      }

      const availableAfter = wallet.availableBalance - lockedAmount;
      const lockedAfter = wallet.lockedBalance + lockedAmount;
      const updatedAt = new Date();

      await tx
        .update(wallets)
        .set({
          availableBalance: availableAfter,
          lockedBalance: lockedAfter,
          updatedAt,
        })
        .where(eq(wallets.id, wallet.id));

      const [order] = await tx
        .insert(orders)
        .values({
          userId,
          marketId: market.id,
          side,
          type: "LIMIT",
          status: "OPEN",
          price,
          amount,
          filledAmount: 0n,
          remainingAmount: amount,
          lockedAssetId,
          lockedAmount,
          updatedAt,
        })
        .returning();

      if (!order) {
        throw new Error("Failed to create limit order.");
      }

      await tx.insert(ledgerEntries).values({
        userId,
        assetId: lockedAssetId,
        type: "ORDER_LOCK",
        amount: -lockedAmount,
        balanceAvailableAfter: availableAfter,
        balanceLockedAfter: lockedAfter,
        refType: "ORDER",
        refId: order.id,
        note: `Limit ${side} ${market.symbol}`,
      });

      return this.formatOrder({
        id: order.id,
        userId: order.userId,
        marketId: order.marketId,
        marketSymbol: market.symbol,
        priceDecimals: market.priceDecimals,
        amountDecimals: market.amountDecimals,
        baseAssetSymbol: market.baseAssetSymbol,
        baseAssetDecimals: market.baseAssetDecimals,
        side: order.side,
        type: order.type,
        price: order.price,
        amount: order.amount,
        filledAmount: order.filledAmount,
        remainingAmount: order.remainingAmount,
        status: order.status,
        lockedAssetId: order.lockedAssetId,
        lockedAssetSymbol,
        lockedAssetDecimals,
        lockedAmount: order.lockedAmount,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        cancelledAt: order.cancelledAt,
      });
    });
  }

  async listForUser(
    userId: string,
    filters: {
      status?: string;
      marketSymbol?: string;
    } = {},
  ) {
    const conditions: SQL[] = [eq(orders.userId, userId)];

    if (filters.status?.trim()) {
      conditions.push(eq(orders.status, this.normalizeStatus(filters.status)));
    }

    if (filters.marketSymbol?.trim()) {
      conditions.push(eq(markets.symbol, this.normalizeMarketSymbol(filters.marketSymbol)));
    }

    const rows = await this.selectOrderRows()
      .where(and(...conditions))
      .orderBy(desc(orders.createdAt))
      .limit(300);

    return rows.map((row) => this.formatOrder(row));
  }

  async cancelOrder(userId: string, orderId: string) {
    return this.db.transaction(async (tx) => {
      const [order] = await this.selectOrderRows(tx)
        .where(eq(orders.id, orderId))
        .for("update")
        .limit(1);

      if (!order) {
        throw new NotFoundException("Order was not found.");
      }

      if (order.userId !== userId) {
        throw new ForbiddenException("You can only cancel your own orders.");
      }

      if (!OPEN_ORDER_STATUSES.includes(order.status as (typeof OPEN_ORDER_STATUSES)[number])) {
        throw new BadRequestException(`Order cannot be cancelled because it is ${order.status}.`);
      }

      const unlockAmount =
        order.side === "BUY"
          ? this.calculateBuyLockedAmount(order.price, order.remainingAmount, {
              priceDecimals: order.priceDecimals,
              baseAssetDecimals: order.baseAssetDecimals,
              quoteAssetDecimals: order.lockedAssetDecimals,
            })
          : order.remainingAmount;

      const [wallet] = await tx
        .select()
        .from(wallets)
        .where(and(eq(wallets.userId, userId), eq(wallets.assetId, order.lockedAssetId)))
        .for("update")
        .limit(1);

      if (!wallet) {
        throw new Error("Failed to load locked asset wallet.");
      }

      if (unlockAmount <= 0n) {
        throw new BadRequestException("Order has no remaining locked balance to unlock.");
      }

      if (wallet.lockedBalance < unlockAmount) {
        throw new BadRequestException("Locked balance is lower than the order unlock amount.");
      }

      const availableAfter = wallet.availableBalance + unlockAmount;
      const lockedAfter = wallet.lockedBalance - unlockAmount;
      const cancelledAt = new Date();

      await tx
        .update(wallets)
        .set({
          availableBalance: availableAfter,
          lockedBalance: lockedAfter,
          updatedAt: cancelledAt,
        })
        .where(eq(wallets.id, wallet.id));

      const [cancelledOrder] = await tx
        .update(orders)
        .set({
          status: "CANCELLED",
          updatedAt: cancelledAt,
          cancelledAt,
        })
        .where(eq(orders.id, order.id))
        .returning();

      if (!cancelledOrder) {
        throw new Error("Failed to cancel order.");
      }

      await tx.insert(ledgerEntries).values({
        userId,
        assetId: order.lockedAssetId,
        type: "ORDER_UNLOCK",
        amount: unlockAmount,
        balanceAvailableAfter: availableAfter,
        balanceLockedAfter: lockedAfter,
        refType: "ORDER",
        refId: order.id,
        note: "Cancel limit order",
      });

      return this.formatOrder({
        ...order,
        status: cancelledOrder.status,
        updatedAt: cancelledOrder.updatedAt,
        cancelledAt: cancelledOrder.cancelledAt,
      });
    });
  }

  async getOrderBook(marketSymbolInput = SUPPORTED_MARKET_SYMBOL) {
    const marketSymbol = this.normalizeMarketSymbol(marketSymbolInput);
    const market = await this.findMarketDetails(this.db, marketSymbol);

    if (!market) {
      throw new NotFoundException(`Market ${marketSymbol} was not found.`);
    }

    const rows = await this.db
      .select({
        id: orders.id,
        side: orders.side,
        price: orders.price,
        remainingAmount: orders.remainingAmount,
      })
      .from(orders)
      .where(and(eq(orders.marketId, market.id), inArray(orders.status, OPEN_ORDER_STATUSES)));

    const bids = this.buildBookSide(
      rows.filter((row) => row.side === "BUY"),
      market,
      "desc",
    );
    const asks = this.buildBookSide(
      rows.filter((row) => row.side === "SELL"),
      market,
      "asc",
    );

    return {
      marketSymbol: market.symbol,
      market: market.symbol,
      bids,
      asks,
    };
  }

  async listAllForAdmin() {
    const rows = await this.selectOrderRows()
      .orderBy(desc(orders.createdAt))
      .limit(500);

    return rows.map((row) => this.formatAdminOrder(row));
  }

  async countOpenOrders() {
    const [row] = await this.db
      .select({
        value: count(),
      })
      .from(orders)
      .where(inArray(orders.status, OPEN_ORDER_STATUSES));

    return row?.value ?? 0;
  }

  private selectOrderRows(db: Database | Transaction = this.db) {
    const lockedAssets = aliasedTable(assets, "locked_assets");
    const baseAssets = aliasedTable(assets, "base_assets");

    return db
      .select({
        id: orders.id,
        userId: orders.userId,
        userEmail: users.email,
        username: users.username,
        marketId: orders.marketId,
        marketSymbol: markets.symbol,
        priceDecimals: markets.priceDecimals,
        amountDecimals: markets.amountDecimals,
        baseAssetSymbol: baseAssets.symbol,
        baseAssetDecimals: baseAssets.decimals,
        side: orders.side,
        type: orders.type,
        price: orders.price,
        amount: orders.amount,
        filledAmount: orders.filledAmount,
        remainingAmount: orders.remainingAmount,
        status: orders.status,
        lockedAssetId: orders.lockedAssetId,
        lockedAssetSymbol: lockedAssets.symbol,
        lockedAssetDecimals: lockedAssets.decimals,
        lockedAmount: orders.lockedAmount,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
        cancelledAt: orders.cancelledAt,
      })
      .from(orders)
      .innerJoin(users, eq(orders.userId, users.id))
      .innerJoin(markets, eq(orders.marketId, markets.id))
      .innerJoin(baseAssets, eq(markets.baseAssetId, baseAssets.id))
      .innerJoin(lockedAssets, eq(orders.lockedAssetId, lockedAssets.id));
  }

  private async findMarketDetails(db: Database | Transaction, marketSymbol: string) {
    const baseAssets = aliasedTable(assets, "market_base_assets");
    const quoteAssets = aliasedTable(assets, "market_quote_assets");

    const [market] = await db
      .select({
        id: markets.id,
        symbol: markets.symbol,
        status: markets.status,
        priceDecimals: markets.priceDecimals,
        amountDecimals: markets.amountDecimals,
        baseAssetId: markets.baseAssetId,
        baseAssetSymbol: baseAssets.symbol,
        baseAssetDecimals: baseAssets.decimals,
        quoteAssetId: markets.quoteAssetId,
        quoteAssetSymbol: quoteAssets.symbol,
        quoteAssetDecimals: quoteAssets.decimals,
      })
      .from(markets)
      .innerJoin(baseAssets, eq(markets.baseAssetId, baseAssets.id))
      .innerJoin(quoteAssets, eq(markets.quoteAssetId, quoteAssets.id))
      .where(eq(markets.symbol, marketSymbol))
      .limit(1);

    return (market as MarketDetails | undefined) ?? null;
  }

  private normalizeMarketSymbol(input: string) {
    const symbol = input.trim().toUpperCase();

    if (symbol !== SUPPORTED_MARKET_SYMBOL) {
      throw new BadRequestException("Only SWL/SWC is supported in v0.5.");
    }

    return symbol;
  }

  private normalizeSide(input: string) {
    const side = input.trim().toUpperCase();

    if (side !== "BUY" && side !== "SELL") {
      throw new BadRequestException("side must be BUY or SELL.");
    }

    return side;
  }

  private normalizeStatus(input: string) {
    const status = input.trim().toUpperCase();

    if (!ORDER_STATUSES.includes(status as OrderStatus)) {
      throw new BadRequestException("Invalid order status filter.");
    }

    return status as OrderStatus;
  }

  private parsePrice(input: string, decimals: number) {
    try {
      return parseHumanDecimalToMinimalUnits(input, decimals, "Price");
    } catch (error) {
      if (error instanceof MoneyFormatError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }

  private parseAmount(input: string, decimals: number) {
    try {
      return parseHumanDecimalToMinimalUnits(input, decimals, "Amount");
    } catch (error) {
      if (error instanceof MoneyFormatError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }

  private calculateBuyLockedAmount(
    price: bigint,
    amount: bigint,
    market: Pick<MarketDetails, "priceDecimals" | "baseAssetDecimals" | "quoteAssetDecimals">,
  ) {
    try {
      return calculateQuoteTotalMinimalUnits({
        price,
        amount,
        priceDecimals: market.priceDecimals,
        amountDecimals: market.baseAssetDecimals,
        quoteDecimals: market.quoteAssetDecimals,
      });
    } catch (error) {
      if (error instanceof MoneyFormatError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }

  private buildBookSide(
    rows: Array<{ price: bigint; remainingAmount: bigint }>,
    market: MarketDetails,
    direction: "asc" | "desc",
  ) {
    const grouped = new Map<string, { price: bigint; amount: bigint; orderCount: number }>();

    for (const row of rows) {
      const key = row.price.toString();
      const current = grouped.get(key);

      if (current) {
        current.amount += row.remainingAmount;
        current.orderCount += 1;
      } else {
        grouped.set(key, {
          price: row.price,
          amount: row.remainingAmount,
          orderCount: 1,
        });
      }
    }

    return [...grouped.values()]
      .sort((left, right) => {
        if (left.price === right.price) {
          return 0;
        }

        const isLeftFirst = direction === "asc" ? left.price < right.price : left.price > right.price;
        return isLeftFirst ? -1 : 1;
      })
      .map((level) => ({
        price: formatMinimalUnitsToHuman(level.price, market.priceDecimals),
        priceRaw: level.price.toString(),
        amount: formatMinimalUnitsToHuman(level.amount, market.baseAssetDecimals),
        amountRaw: level.amount.toString(),
        orderCount: level.orderCount,
      }));
  }

  private formatOrder(row: OrderRow) {
    return {
      id: row.id,
      userId: row.userId,
      marketId: row.marketId,
      marketSymbol: row.marketSymbol,
      market: row.marketSymbol,
      side: row.side,
      type: row.type,
      price: formatMinimalUnitsToHuman(row.price, row.priceDecimals),
      priceRaw: row.price.toString(),
      amount: formatMinimalUnitsToHuman(row.amount, row.baseAssetDecimals),
      amountRaw: row.amount.toString(),
      filledAmount: formatMinimalUnitsToHuman(row.filledAmount, row.baseAssetDecimals),
      filledAmountRaw: row.filledAmount.toString(),
      remainingAmount: formatMinimalUnitsToHuman(row.remainingAmount, row.baseAssetDecimals),
      remainingAmountRaw: row.remainingAmount.toString(),
      status: row.status,
      lockedAssetId: row.lockedAssetId,
      lockedAssetSymbol: row.lockedAssetSymbol,
      lockedAsset: {
        id: row.lockedAssetId,
        symbol: row.lockedAssetSymbol,
      },
      lockedAmount: formatMinimalUnitsToHuman(row.lockedAmount, row.lockedAssetDecimals),
      lockedAmountRaw: row.lockedAmount.toString(),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      cancelledAt: row.cancelledAt,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      cancelled_at: row.cancelledAt,
    };
  }

  private formatAdminOrder(row: AdminOrderRow) {
    return {
      ...this.formatOrder(row),
      user: {
        id: row.userId,
        email: row.userEmail,
        username: row.username,
      },
      userEmail: row.userEmail,
      username: row.username,
    };
  }
}
