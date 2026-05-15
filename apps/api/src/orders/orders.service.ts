import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { aliasedTable } from "drizzle-orm/alias";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
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
import { TradesService } from "../trades/trades.service.js";
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

type WalletRecord = {
  id: string;
  userId: string;
  assetId: string;
  availableBalance: bigint;
  lockedBalance: bigint;
  assetSymbol: string;
  assetName: string;
  assetDecimals: number;
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

type RestingOrderRow = {
  id: string;
  userId: string;
  side: "BUY" | "SELL";
  price: bigint;
  filledAmount: bigint;
  remainingAmount: bigint;
  status: OrderStatus;
  lockedAssetId: string;
  lockedAmount: bigint;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class OrdersService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    @Inject(TradesService) private readonly tradesService: TradesService,
  ) {}

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
      const initialLockedAmount =
        side === "BUY"
          ? this.calculateBuyLockedAmount(price, amount, market)
          : amount;

      const wallet = await this.ensureWalletForUpdate(tx, userId, lockedAssetId);
      if (wallet.availableBalance < initialLockedAmount) {
        throw new BadRequestException("Insufficient available balance.");
      }

      const lockedUpdateAt = new Date();
      const lockAvailableAfter = wallet.availableBalance - initialLockedAmount;
      const lockLockedAfter = wallet.lockedBalance + initialLockedAmount;

      await this.updateWallet(tx, wallet, {
        availableBalance: lockAvailableAfter,
        lockedBalance: lockLockedAfter,
        updatedAt: lockedUpdateAt,
      });

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
          lockedAmount: initialLockedAmount,
          updatedAt: lockedUpdateAt,
        })
        .returning();

      if (!order) {
        throw new Error("Failed to create limit order.");
      }

      await tx.insert(ledgerEntries).values({
        userId,
        assetId: lockedAssetId,
        type: "ORDER_LOCK",
        amount: -initialLockedAmount,
        balanceAvailableAfter: lockAvailableAfter,
        balanceLockedAfter: lockLockedAfter,
        refType: "ORDER",
        refId: order.id,
        note: `Limit ${side} ${market.symbol}`,
      });

      const incomingOrder: OrderRow = {
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
      };

      const finalOrder = await this.matchIncomingOrder(tx, incomingOrder, market);

      return this.formatOrder(finalOrder);
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
      .orderBy(desc(orders.createdAt), desc(orders.id))
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

      if (order.lockedAmount <= 0n) {
        throw new BadRequestException("Order has no remaining locked balance to unlock.");
      }

      const wallet = await this.ensureWalletForUpdate(tx, userId, order.lockedAssetId);
      if (wallet.lockedBalance < order.lockedAmount) {
        throw new BadRequestException("Locked balance is lower than the order unlock amount.");
      }

      const cancelledAt = new Date();
      const availableAfter = wallet.availableBalance + order.lockedAmount;
      const lockedAfter = wallet.lockedBalance - order.lockedAmount;

      await this.updateWallet(tx, wallet, {
        availableBalance: availableAfter,
        lockedBalance: lockedAfter,
        updatedAt: cancelledAt,
      });

      const [cancelledOrder] = await tx
        .update(orders)
        .set({
          status: "CANCELLED",
          lockedAmount: 0n,
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
        amount: order.lockedAmount,
        balanceAvailableAfter: availableAfter,
        balanceLockedAfter: lockedAfter,
        refType: "ORDER",
        refId: order.id,
        note: "Cancel limit order",
      });

      return this.formatOrder({
        ...order,
        status: cancelledOrder.status,
        lockedAmount: cancelledOrder.lockedAmount,
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
      .where(
        and(
          eq(orders.marketId, market.id),
          inArray(orders.status, OPEN_ORDER_STATUSES),
          sql`${orders.remainingAmount} > 0`,
        ),
      );

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
      .orderBy(desc(orders.createdAt), desc(orders.id))
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

  private async matchIncomingOrder(tx: Transaction, incomingOrder: OrderRow, market: MarketDetails) {
    const oppositeSide = incomingOrder.side === "BUY" ? "SELL" : "BUY";
    const priceCondition =
      incomingOrder.side === "BUY"
        ? sql`${orders.price} <= ${incomingOrder.price}`
        : sql`${orders.price} >= ${incomingOrder.price}`;

    const restingOrders = await tx
      .select({
        id: orders.id,
        userId: orders.userId,
        side: orders.side,
        price: orders.price,
        filledAmount: orders.filledAmount,
        remainingAmount: orders.remainingAmount,
        status: orders.status,
        lockedAssetId: orders.lockedAssetId,
        lockedAmount: orders.lockedAmount,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
      })
      .from(orders)
      .where(
        and(
          eq(orders.marketId, market.id),
          eq(orders.side, oppositeSide),
          inArray(orders.status, OPEN_ORDER_STATUSES),
          sql`${orders.remainingAmount} > 0`,
          priceCondition,
        ),
      )
      .orderBy(
        ...(incomingOrder.side === "BUY"
          ? [asc(orders.price), asc(orders.createdAt), asc(orders.id)]
          : [desc(orders.price), asc(orders.createdAt), asc(orders.id)]),
      )
      .for("update");

    let incomingStatus: OrderStatus = "OPEN";
    let currentLockedAmount = incomingOrder.lockedAmount;
    let currentFilledAmount = incomingOrder.filledAmount;
    let currentRemainingAmount = incomingOrder.remainingAmount;

    for (const resting of restingOrders) {
      if (currentRemainingAmount <= 0n) {
        break;
      }

      if (resting.userId === incomingOrder.userId) {
        continue;
      }

      const restingState: RestingOrderRow = {
        id: resting.id,
        userId: resting.userId,
        side: resting.side,
        price: resting.price,
        filledAmount: resting.filledAmount,
        remainingAmount: resting.remainingAmount,
        status: resting.status,
        lockedAssetId: resting.lockedAssetId,
        lockedAmount: resting.lockedAmount,
        createdAt: resting.createdAt,
        updatedAt: resting.updatedAt,
      };

      const fillAmount = currentRemainingAmount < restingState.remainingAmount ? currentRemainingAmount : restingState.remainingAmount;
      if (fillAmount <= 0n) {
        continue;
      }

      const tradePrice = restingState.price;
      const quoteAmount = this.calculateQuoteTotalMinimalUnits(
        tradePrice,
        fillAmount,
        market.priceDecimals,
        market.baseAssetDecimals,
        market.quoteAssetDecimals,
      );
      const trade = await this.tradesService.createTradeRecord(tx, {
        marketId: market.id,
        buyOrderId: incomingOrder.side === "BUY" ? incomingOrder.id : restingState.id,
        sellOrderId: incomingOrder.side === "SELL" ? incomingOrder.id : restingState.id,
        buyerId: incomingOrder.side === "BUY" ? incomingOrder.userId : restingState.userId,
        sellerId: incomingOrder.side === "SELL" ? incomingOrder.userId : restingState.userId,
        price: tradePrice,
        amount: fillAmount,
        quoteAmount,
      });

      await this.settleBuyerSide(tx, {
        market,
        trade,
        buyerOrder: incomingOrder.side === "BUY" ? incomingOrder : restingState,
        buyerUserId: incomingOrder.side === "BUY" ? incomingOrder.userId : restingState.userId,
        fillAmount,
        tradePrice,
        quoteAmount,
        buyerSideIsIncoming: incomingOrder.side === "BUY",
      });

      await this.settleSellerSide(tx, {
        market,
        trade,
        sellerOrder: incomingOrder.side === "SELL" ? incomingOrder : restingState,
        sellerUserId: incomingOrder.side === "SELL" ? incomingOrder.userId : restingState.userId,
        fillAmount,
        tradePrice,
        quoteAmount,
        sellerSideIsIncoming: incomingOrder.side === "SELL",
      });

      currentFilledAmount += fillAmount;
      currentRemainingAmount -= fillAmount;
      currentLockedAmount = this.calculateRemainingLockedAmount(
        incomingOrder.side,
        currentRemainingAmount,
        incomingOrder.price,
        market,
      );

      if (restingState.status === "OPEN" || restingState.status === "PARTIAL_FILLED") {
        const restingUpdatedAt = new Date();
        const remainingAmount = restingState.remainingAmount - fillAmount;
        const filledAmount = restingState.filledAmount + fillAmount;
        const lockedAmount = this.calculateRemainingLockedAmount(
          restingState.side,
          remainingAmount,
          restingState.price,
          market,
        );
        const status: OrderStatus = remainingAmount === 0n ? "FILLED" : "PARTIAL_FILLED";

        await tx
          .update(orders)
          .set({
            filledAmount,
            remainingAmount,
            lockedAmount,
            status,
            updatedAt: restingUpdatedAt,
          })
          .where(eq(orders.id, restingState.id));
      }
    }

    if (currentFilledAmount === 0n) {
      incomingStatus = "OPEN";
    } else if (currentRemainingAmount === 0n) {
      incomingStatus = "FILLED";
    } else {
      incomingStatus = "PARTIAL_FILLED";
    }

    const updatedAt = new Date();
    const [updatedOrder] = await tx
      .update(orders)
      .set({
        filledAmount: currentFilledAmount,
        remainingAmount: currentRemainingAmount,
        lockedAmount: currentLockedAmount,
        status: incomingStatus,
        updatedAt,
      })
      .where(eq(orders.id, incomingOrder.id))
      .returning();

    if (!updatedOrder) {
      throw new Error("Failed to update order after matching.");
    }

    return {
      ...incomingOrder,
      filledAmount: updatedOrder.filledAmount,
      remainingAmount: updatedOrder.remainingAmount,
      lockedAmount: updatedOrder.lockedAmount,
      status: updatedOrder.status,
      updatedAt: updatedOrder.updatedAt,
    };
  }

  private async settleBuyerSide(
    tx: Transaction,
    input: {
      market: MarketDetails;
      trade: { id: string };
      buyerOrder: OrderRow | RestingOrderRow;
      buyerUserId: string;
      fillAmount: bigint;
      tradePrice: bigint;
      quoteAmount: bigint;
      buyerSideIsIncoming: boolean;
    },
  ) {
    const { market, trade, buyerOrder, buyerUserId, fillAmount, tradePrice, quoteAmount } = input;

    const quoteWallet = await this.ensureWalletForUpdate(tx, buyerUserId, market.quoteAssetId);
    const lockedQuoteForFill = this.calculateQuoteTotalMinimalUnits(
      buyerOrder.price,
      fillAmount,
      market.priceDecimals,
      market.baseAssetDecimals,
      market.quoteAssetDecimals,
    );
    const refundAmount = lockedQuoteForFill > quoteAmount ? lockedQuoteForFill - quoteAmount : 0n;
    const quoteWalletLockedAfterSpent = quoteWallet.lockedBalance - lockedQuoteForFill;

    if (quoteWallet.lockedBalance < lockedQuoteForFill) {
      throw new BadRequestException("Locked quote balance is lower than the buy fill amount.");
    }

    const quoteWalletAvailableAfterSpent = quoteWallet.availableBalance;
    const quoteWalletAvailableAfter = quoteWalletAvailableAfterSpent + refundAmount;
    const quoteWalletLockedAfter = quoteWalletLockedAfterSpent;

    await this.updateWallet(tx, quoteWallet, {
      availableBalance: quoteWalletAvailableAfter,
      lockedBalance: quoteWalletLockedAfter,
      updatedAt: new Date(),
    });

    await tx.insert(ledgerEntries).values({
      userId: buyerUserId,
      assetId: market.quoteAssetId,
      type: "TRADE_BUY",
      amount: -quoteAmount,
      balanceAvailableAfter: quoteWalletAvailableAfterSpent,
      balanceLockedAfter: quoteWalletLockedAfterSpent,
      refType: "TRADE",
      refId: trade.id,
      note: `Buy fill spent ${market.quoteAssetSymbol} at maker price ${formatMinimalUnitsToHuman(tradePrice, market.priceDecimals)} on ${market.symbol}`,
    });

    if (refundAmount > 0n) {
      await tx.insert(ledgerEntries).values({
        userId: buyerUserId,
        assetId: market.quoteAssetId,
        type: "ORDER_UNLOCK",
        amount: refundAmount,
        balanceAvailableAfter: quoteWalletAvailableAfter,
        balanceLockedAfter: quoteWalletLockedAfter,
        refType: "TRADE",
        refId: trade.id,
        note: `Better price refund for trade ${trade.id} on ${market.symbol}`,
      });
    }

    const baseWallet = await this.ensureWalletForUpdate(tx, buyerUserId, market.baseAssetId);
    const baseWalletAvailableAfter = baseWallet.availableBalance + fillAmount;

    await this.updateWallet(tx, baseWallet, {
      availableBalance: baseWalletAvailableAfter,
      lockedBalance: baseWallet.lockedBalance,
      updatedAt: new Date(),
    });

    await tx.insert(ledgerEntries).values({
      userId: buyerUserId,
      assetId: market.baseAssetId,
      type: "TRADE_BUY",
      amount: fillAmount,
      balanceAvailableAfter: baseWalletAvailableAfter,
      balanceLockedAfter: baseWallet.lockedBalance,
      refType: "TRADE",
      refId: trade.id,
      note: `Buy fill received ${market.baseAssetSymbol} at maker price ${formatMinimalUnitsToHuman(tradePrice, market.priceDecimals)} on ${market.symbol}`,
    });
  }

  private async settleSellerSide(
    tx: Transaction,
    input: {
      market: MarketDetails;
      trade: { id: string };
      sellerOrder: OrderRow | RestingOrderRow;
      sellerUserId: string;
      fillAmount: bigint;
      tradePrice: bigint;
      quoteAmount: bigint;
      sellerSideIsIncoming: boolean;
    },
  ) {
    const { market, trade, sellerUserId, fillAmount, tradePrice, quoteAmount } = input;

    const baseWallet = await this.ensureWalletForUpdate(tx, sellerUserId, market.baseAssetId);
    if (baseWallet.lockedBalance < fillAmount) {
      throw new BadRequestException("Locked base balance is lower than the sell fill amount.");
    }

    const baseWalletLockedAfter = baseWallet.lockedBalance - fillAmount;
    await this.updateWallet(tx, baseWallet, {
      availableBalance: baseWallet.availableBalance,
      lockedBalance: baseWalletLockedAfter,
      updatedAt: new Date(),
    });

    await tx.insert(ledgerEntries).values({
      userId: sellerUserId,
      assetId: market.baseAssetId,
      type: "ORDER_UNLOCK",
      amount: fillAmount,
      balanceAvailableAfter: baseWallet.availableBalance,
      balanceLockedAfter: baseWalletLockedAfter,
      refType: "TRADE",
      refId: trade.id,
      note: `Sell fill released ${market.baseAssetSymbol} lock on ${market.symbol}`,
    });

    const quoteWallet = await this.ensureWalletForUpdate(tx, sellerUserId, market.quoteAssetId);
    const quoteWalletAvailableAfter = quoteWallet.availableBalance + quoteAmount;

    await this.updateWallet(tx, quoteWallet, {
      availableBalance: quoteWalletAvailableAfter,
      lockedBalance: quoteWallet.lockedBalance,
      updatedAt: new Date(),
    });

    await tx.insert(ledgerEntries).values({
      userId: sellerUserId,
      assetId: market.quoteAssetId,
      type: "TRADE_SELL",
      amount: quoteAmount,
      balanceAvailableAfter: quoteWalletAvailableAfter,
      balanceLockedAfter: quoteWallet.lockedBalance,
      refType: "TRADE",
      refId: trade.id,
      note: `Sell fill at maker price ${formatMinimalUnitsToHuman(tradePrice, market.priceDecimals)} on ${market.symbol}`,
    });
  }

  private async ensureWalletForUpdate(tx: Transaction, userId: string, assetId: string) {
    await tx
      .insert(wallets)
      .values({
        userId,
        assetId,
        availableBalance: 0n,
        lockedBalance: 0n,
      })
      .onConflictDoNothing();

    const assetsAlias = aliasedTable(assets, "wallet_assets");
    const [wallet] = await tx
      .select({
        id: wallets.id,
        userId: wallets.userId,
        assetId: wallets.assetId,
        availableBalance: wallets.availableBalance,
        lockedBalance: wallets.lockedBalance,
        assetSymbol: assetsAlias.symbol,
        assetName: assetsAlias.name,
        assetDecimals: assetsAlias.decimals,
      })
      .from(wallets)
      .innerJoin(assetsAlias, eq(wallets.assetId, assetsAlias.id))
      .where(and(eq(wallets.userId, userId), eq(wallets.assetId, assetId)))
      .for("update")
      .limit(1);

    if (!wallet) {
      throw new Error("Failed to load wallet.");
    }

    return wallet as WalletRecord;
  }

  private async updateWallet(
    tx: Transaction,
    wallet: WalletRecord,
    values: {
      availableBalance: bigint;
      lockedBalance: bigint;
      updatedAt: Date;
    },
  ) {
    await tx
      .update(wallets)
      .set({
        availableBalance: values.availableBalance,
        lockedBalance: values.lockedBalance,
        updatedAt: values.updatedAt,
      })
      .where(eq(wallets.id, wallet.id));

    wallet.availableBalance = values.availableBalance;
    wallet.lockedBalance = values.lockedBalance;
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
      throw new BadRequestException("Only SWL/SWC is supported in v0.6.");
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

  private calculateQuoteTotalMinimalUnits(
    price: bigint,
    amount: bigint,
    priceDecimals: number,
    amountDecimals: number,
    quoteDecimals: number,
  ) {
    try {
      return calculateQuoteTotalMinimalUnits({
        price,
        amount,
        priceDecimals,
        amountDecimals,
        quoteDecimals,
      });
    } catch (error) {
      if (error instanceof MoneyFormatError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }

  private calculateRemainingLockedAmount(
    side: "BUY" | "SELL",
    remainingAmount: bigint,
    price: bigint,
    market: Pick<MarketDetails, "priceDecimals" | "baseAssetDecimals" | "quoteAssetDecimals">,
  ) {
    if (remainingAmount <= 0n) {
      return 0n;
    }

    if (side === "BUY") {
      return this.calculateBuyLockedAmount(price, remainingAmount, market);
    }

    return remainingAmount;
  }

  private buildBookSide(
    rows: Array<{ price: bigint; remainingAmount: bigint }>,
    market: MarketDetails,
    direction: "asc" | "desc",
  ) {
    const grouped = new Map<string, { price: bigint; amount: bigint; orderCount: number }>();

    for (const row of rows) {
      if (row.remainingAmount <= 0n) {
        continue;
      }

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
