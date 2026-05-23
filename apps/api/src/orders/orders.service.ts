import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { aliasedTable } from "drizzle-orm/alias";
import { and, asc, count, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import {
  calculateQuoteTotalMinimalUnits,
  formatMinimalUnitsToHuman,
  MoneyFormatError,
  parseHumanDecimalToMinimalUnits,
} from "../common/money.js";
import { DRIZZLE_DB } from "../db/database.module.js";
import type { Database } from "../db/database.module.js";
import { assets, feeSettings, ledgerEntries, markets, orders, users, wallets } from "../db/schema/index.js";
import type { WalletType } from "../db/schema/index.js";
import { DEFAULT_FEE_RATE_BPS, FeesService, type ActiveFeeConfig } from "../fees/fees.service.js";
import { TradesService } from "../trades/trades.service.js";
import type { CreateOrderDto } from "./dto/create-order.dto.js";

const SUPPORTED_MARKET_SYMBOL = "SWL/SWC";
const OPEN_ORDER_STATUSES = ["OPEN", "PARTIAL_FILLED"] as const;
const ORDER_STATUSES = [
  "OPEN",
  "PARTIAL_FILLED",
  "FILLED",
  "PARTIAL_FILLED_CANCELLED",
  "CANCELLED",
  "REJECTED",
] as const;
const PARTIAL_MARKET_WARNING =
  "Partially filled. Available liquidity was exhausted and the unfilled remainder was cancelled.";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type OrderStatus = (typeof ORDER_STATUSES)[number];
type OrderType = "LIMIT" | "MARKET";
type LiquidityStatus = "FULL" | "PARTIAL" | "NONE";

type MarketDetails = {
  id: string;
  symbol: string;
  status: "ACTIVE" | "PAUSED";
  priceDecimals: number;
  amountDecimals: number;
  minOrderAmount: bigint;
  minNotional: bigint;
  baseAssetId: string;
  baseAssetSymbol: string;
  baseAssetIsActive: boolean;
  baseAssetDecimals: number;
  quoteAssetId: string;
  quoteAssetSymbol: string;
  quoteAssetIsActive: boolean;
  quoteAssetDecimals: number;
};

type WalletRecord = {
  id: string;
  userId: string;
  assetId: string;
  availableBalance: bigint;
  lockedBalance: bigint;
  walletType: WalletType;
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
  quoteAssetSymbol: string;
  quoteAssetDecimals: number;
  side: "BUY" | "SELL";
  type: OrderType;
  price: bigint;
  amount: bigint;
  filledAmount: bigint;
  remainingAmount: bigint;
  requestedQuoteAmount: bigint;
  spentQuoteAmount: bigint;
  averagePrice: bigint;
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

type MarketExecutionSummary = {
  tradeCount: number;
  requestedQuoteAmount: bigint;
  spentQuoteAmount: bigint;
  receivedQuoteAmount: bigint;
  filledAmount: bigint;
  cancelledQuoteAmount: bigint;
  cancelledBaseAmount: bigint;
  averagePrice: bigint;
  buyerFee: bigint;
  sellerFee: bigint;
  status: OrderStatus;
  liquidityStatus: LiquidityStatus;
};

type MarketExecutionResult = {
  order: OrderRow;
  summary: MarketExecutionSummary;
};

type MarketOrderRequest = {
  quoteAmount: bigint;
  baseAmount: bigint;
};

@Injectable()
export class OrdersService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    @Inject(FeesService) private readonly feesService: FeesService,
    @Inject(TradesService) private readonly tradesService: TradesService,
  ) {}

  async createOrder(userId: string, dto: CreateOrderDto) {
    const type = this.normalizeOrderType(dto.type ?? "LIMIT");

    if (type === "MARKET") {
      return this.createMarketOrder(userId, dto);
    }

    return this.createLimitOrder(userId, dto);
  }

  async previewOrder(userId: string, dto: CreateOrderDto) {
    const type = this.normalizeOrderType(dto.type ?? "LIMIT");
    const marketSymbol = this.normalizeMarketSymbol(dto.marketSymbol);
    const side = this.normalizeSide(dto.side);

    const [user] = await this.db
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
      throw new ForbiddenException("USER_NOT_ACTIVE");
    }

    const market = await this.findMarketDetails(this.db, marketSymbol);
    if (!market) {
      throw new NotFoundException(`Market ${marketSymbol} was not found.`);
    }

    if (market.status !== "ACTIVE") {
      throw new BadRequestException("MARKET_PAUSED");
    }

    if (!market.baseAssetIsActive || !market.quoteAssetIsActive) {
      throw new BadRequestException("ASSET_PAUSED");
    }

    if (type === "MARKET") {
      const request = this.parseMarketOrderRequest(dto, market, side);
      const summary = await this.previewMarketOrder(this.db, userId, market, side, request);
      return this.formatMarketPreview(market, side, summary);
    }

    const price = this.parsePrice(this.requireString(dto.price, "price"), market.priceDecimals);
    const amount = this.parseAmount(this.requireString(dto.amount, "amount"), market.baseAssetDecimals);
    const quoteTotal = this.calculateQuoteTotalMinimalUnits(
      price,
      amount,
      market.priceDecimals,
      market.baseAssetDecimals,
      market.quoteAssetDecimals,
    );

    this.assertOrderMinimums(market, amount, quoteTotal);

    return this.previewLimitOrder(this.db, userId, market, side, price, amount, quoteTotal);
  }

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
        throw new ForbiddenException("USER_NOT_ACTIVE");
      }

      const market = await this.findMarketDetails(tx, marketSymbol);
      if (!market) {
        throw new NotFoundException(`Market ${marketSymbol} was not found.`);
      }

      if (market.status !== "ACTIVE") {
        throw new BadRequestException("MARKET_PAUSED");
      }

      if (!market.baseAssetIsActive || !market.quoteAssetIsActive) {
        throw new BadRequestException("ASSET_PAUSED");
      }

      const price = this.parsePrice(this.requireString(dto.price, "price"), market.priceDecimals);
      const amount = this.parseAmount(this.requireString(dto.amount, "amount"), market.baseAssetDecimals);
      const quoteTotal = this.calculateQuoteTotalMinimalUnits(
        price,
        amount,
        market.priceDecimals,
        market.baseAssetDecimals,
        market.quoteAssetDecimals,
      );

      this.assertOrderMinimums(market, amount, quoteTotal);

      const lockedAssetId = side === "BUY" ? market.quoteAssetId : market.baseAssetId;
      const lockedAssetSymbol = side === "BUY" ? market.quoteAssetSymbol : market.baseAssetSymbol;
      const lockedAssetDecimals =
        side === "BUY" ? market.quoteAssetDecimals : market.baseAssetDecimals;
      const initialLockedAmount = side === "BUY" ? quoteTotal : amount;

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
        quoteAssetSymbol: market.quoteAssetSymbol,
        quoteAssetDecimals: market.quoteAssetDecimals,
        side: order.side,
        type: order.type,
        price: order.price,
        amount: order.amount,
        filledAmount: order.filledAmount,
        remainingAmount: order.remainingAmount,
        requestedQuoteAmount: order.requestedQuoteAmount,
        spentQuoteAmount: order.spentQuoteAmount,
        averagePrice: order.averagePrice,
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

  async createMarketOrder(userId: string, dto: CreateOrderDto) {
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
        throw new ForbiddenException("USER_NOT_ACTIVE");
      }

      const market = await this.findMarketDetails(tx, marketSymbol);
      if (!market) {
        throw new NotFoundException(`Market ${marketSymbol} was not found.`);
      }

      if (market.status !== "ACTIVE") {
        throw new BadRequestException("MARKET_PAUSED");
      }

      if (!market.baseAssetIsActive || !market.quoteAssetIsActive) {
        throw new BadRequestException("ASSET_PAUSED");
      }

      const request = this.parseMarketOrderRequest(dto, market, side);
      const lockedAssetId = side === "BUY" ? market.quoteAssetId : market.baseAssetId;
      const lockedAssetSymbol = side === "BUY" ? market.quoteAssetSymbol : market.baseAssetSymbol;
      const lockedAssetDecimals =
        side === "BUY" ? market.quoteAssetDecimals : market.baseAssetDecimals;
      const orderAmount = side === "BUY" ? 0n : request.baseAmount;
      const orderRemainingAmount = side === "BUY" ? 0n : request.baseAmount;

      const spendAssetId = side === "BUY" ? market.quoteAssetId : market.baseAssetId;
      const requestedSpend = side === "BUY" ? request.quoteAmount : request.baseAmount;
      const spendWallet = await this.ensureWalletForUpdate(tx, userId, spendAssetId);
      if (spendWallet.availableBalance < requestedSpend) {
        throw new BadRequestException("Insufficient available balance.");
      }

      const createdAt = new Date();
      const [order] = await tx
        .insert(orders)
        .values({
          userId,
          marketId: market.id,
          side,
          type: "MARKET",
          status: "OPEN",
          price: 0n,
          amount: orderAmount,
          filledAmount: 0n,
          remainingAmount: orderRemainingAmount,
          requestedQuoteAmount: request.quoteAmount,
          spentQuoteAmount: 0n,
          averagePrice: 0n,
          lockedAssetId,
          lockedAmount: 0n,
          updatedAt: createdAt,
        })
        .returning();

      if (!order) {
        throw new Error("Failed to create market order.");
      }

      const incomingOrder: OrderRow = {
        id: order.id,
        userId: order.userId,
        marketId: order.marketId,
        marketSymbol: market.symbol,
        priceDecimals: market.priceDecimals,
        amountDecimals: market.amountDecimals,
        baseAssetSymbol: market.baseAssetSymbol,
        baseAssetDecimals: market.baseAssetDecimals,
        quoteAssetSymbol: market.quoteAssetSymbol,
        quoteAssetDecimals: market.quoteAssetDecimals,
        side: order.side,
        type: order.type,
        price: order.price,
        amount: order.amount,
        filledAmount: order.filledAmount,
        remainingAmount: order.remainingAmount,
        requestedQuoteAmount: order.requestedQuoteAmount,
        spentQuoteAmount: order.spentQuoteAmount,
        averagePrice: order.averagePrice,
        status: order.status,
        lockedAssetId: order.lockedAssetId,
        lockedAssetSymbol,
        lockedAssetDecimals,
        lockedAmount: order.lockedAmount,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        cancelledAt: order.cancelledAt,
      };

      const result = await this.matchIncomingMarketOrder(tx, incomingOrder, market, request);
      if (result.summary.tradeCount === 0) {
        throw new BadRequestException("NO_LIQUIDITY");
      }

      return this.formatMarketOrderResult(result.order, market, result.summary);
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
        throw new ForbiddenException("USER_NOT_ACTIVE");
      }

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

      if (order.type !== "LIMIT") {
        throw new BadRequestException("Market orders cannot be cancelled.");
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
          eq(orders.type, "LIMIT"),
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

  async listAllForAdmin(
    filters: {
      status?: string;
      marketSymbol?: string;
      user?: string;
    } = {},
  ) {
    const conditions: SQL[] = [];

    if (filters.status?.trim()) {
      conditions.push(eq(orders.status, this.normalizeStatus(filters.status)));
    }

    if (filters.marketSymbol?.trim()) {
      conditions.push(eq(markets.symbol, this.normalizeMarketSymbol(filters.marketSymbol)));
    }

    if (filters.user?.trim()) {
      const userFilter = filters.user.trim();
      const userConditions: SQL[] = [eq(users.email, userFilter), eq(users.username, userFilter)];
      if (this.isUuid(userFilter)) {
        userConditions.push(eq(users.id, userFilter));
      }

      const matchingUsers = await this.db
        .select({ id: users.id })
        .from(users)
        .where(or(...userConditions));

      if (matchingUsers.length === 0) {
        return [];
      }

      conditions.push(inArray(orders.userId, matchingUsers.map((user) => user.id)));
    }

    const rows = await this.selectOrderRows()
      .where(conditions.length > 0 ? and(...conditions) : undefined)
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
      .where(and(eq(orders.type, "LIMIT"), inArray(orders.status, OPEN_ORDER_STATUSES)));

    return row?.value ?? 0;
  }

  private async matchIncomingOrder(tx: Transaction, incomingOrder: OrderRow, market: MarketDetails) {
    if (
      market.status !== "ACTIVE" ||
      !market.baseAssetIsActive ||
      !market.quoteAssetIsActive
    ) {
      return incomingOrder;
    }

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
      .innerJoin(users, eq(orders.userId, users.id))
      .where(
        and(
          eq(orders.marketId, market.id),
          eq(orders.side, oppositeSide),
          eq(orders.type, "LIMIT"),
          eq(users.status, "ACTIVE"),
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
    let activeFeeConfig: ActiveFeeConfig | null = null;

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

      activeFeeConfig ??= await this.feesService.getActiveFeeConfigForMarket(tx, market.id);
      const buyerFee = this.feesService.calculateFee(
        fillAmount,
        activeFeeConfig.buyerFeeRateBps,
      );
      const sellerFee = this.feesService.calculateFee(
        quoteAmount,
        activeFeeConfig.sellerFeeRateBps,
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
        buyerFee,
        sellerFee,
        buyerFeeAssetId: market.baseAssetId,
        sellerFeeAssetId: market.quoteAssetId,
        buyerFeeRateBps: activeFeeConfig.buyerFeeRateBps,
        sellerFeeRateBps: activeFeeConfig.sellerFeeRateBps,
      });

      await this.settleBuyerSide(tx, {
        market,
        trade,
        buyerOrder: incomingOrder.side === "BUY" ? incomingOrder : restingState,
        buyerUserId: incomingOrder.side === "BUY" ? incomingOrder.userId : restingState.userId,
        fillAmount,
        tradePrice,
        quoteAmount,
        buyerFee,
        buyerFeeRateBps: activeFeeConfig.buyerFeeRateBps,
        adminFeeUserId: activeFeeConfig.adminFeeUserId,
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
        sellerFee,
        sellerFeeRateBps: activeFeeConfig.sellerFeeRateBps,
        adminFeeUserId: activeFeeConfig.adminFeeUserId,
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

  private async matchIncomingMarketOrder(
    tx: Transaction,
    incomingOrder: OrderRow,
    market: MarketDetails,
    request: MarketOrderRequest,
  ): Promise<MarketExecutionResult> {
    const oppositeSide = incomingOrder.side === "BUY" ? "SELL" : "BUY";
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
      .innerJoin(users, eq(orders.userId, users.id))
      .where(
        and(
          eq(orders.marketId, market.id),
          eq(orders.side, oppositeSide),
          eq(orders.type, "LIMIT"),
          eq(users.status, "ACTIVE"),
          inArray(orders.status, OPEN_ORDER_STATUSES),
          sql`${orders.remainingAmount} > 0`,
        ),
      )
      .orderBy(
        ...(incomingOrder.side === "BUY"
          ? [asc(orders.price), asc(orders.createdAt), asc(orders.id)]
          : [desc(orders.price), asc(orders.createdAt), asc(orders.id)]),
      )
      .for("update");

    let remainingQuoteAmount = request.quoteAmount;
    let remainingBaseAmount = request.baseAmount;
    let currentFilledAmount = 0n;
    let currentSpentQuoteAmount = 0n;
    let totalBuyerFee = 0n;
    let totalSellerFee = 0n;
    let tradeCount = 0;
    let activeFeeConfig: ActiveFeeConfig | null = null;

    for (const resting of restingOrders) {
      if (
        (incomingOrder.side === "BUY" && remainingQuoteAmount <= 0n) ||
        (incomingOrder.side === "SELL" && remainingBaseAmount <= 0n)
      ) {
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

      const tradePrice = restingState.price;
      const fillAmount =
        incomingOrder.side === "BUY"
          ? this.calculateMarketBuyFillAmount(remainingQuoteAmount, restingState, market)
          : remainingBaseAmount < restingState.remainingAmount
            ? remainingBaseAmount
            : restingState.remainingAmount;

      if (fillAmount <= 0n) {
        break;
      }

      const quoteAmount = this.calculateQuoteTotalMinimalUnitsRoundedDown(
        tradePrice,
        fillAmount,
        market.priceDecimals,
        market.baseAssetDecimals,
        market.quoteAssetDecimals,
      );

      if (quoteAmount <= 0n) {
        break;
      }

      if (incomingOrder.side === "BUY" && quoteAmount > remainingQuoteAmount) {
        throw new BadRequestException("Market buy would exceed the requested quote spend.");
      }

      activeFeeConfig ??= await this.feesService.getActiveFeeConfigForMarket(tx, market.id);
      const buyerFee = this.feesService.calculateFee(
        fillAmount,
        activeFeeConfig.buyerFeeRateBps,
      );
      const sellerFee = this.feesService.calculateFee(
        quoteAmount,
        activeFeeConfig.sellerFeeRateBps,
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
        buyerFee,
        sellerFee,
        buyerFeeAssetId: market.baseAssetId,
        sellerFeeAssetId: market.quoteAssetId,
        buyerFeeRateBps: activeFeeConfig.buyerFeeRateBps,
        sellerFeeRateBps: activeFeeConfig.sellerFeeRateBps,
      });

      await this.settleBuyerSide(tx, {
        market,
        trade,
        buyerOrder: incomingOrder.side === "BUY" ? incomingOrder : restingState,
        buyerUserId: incomingOrder.side === "BUY" ? incomingOrder.userId : restingState.userId,
        fillAmount,
        tradePrice,
        quoteAmount,
        buyerFee,
        buyerFeeRateBps: activeFeeConfig.buyerFeeRateBps,
        adminFeeUserId: activeFeeConfig.adminFeeUserId,
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
        sellerFee,
        sellerFeeRateBps: activeFeeConfig.sellerFeeRateBps,
        adminFeeUserId: activeFeeConfig.adminFeeUserId,
        sellerSideIsIncoming: incomingOrder.side === "SELL",
      });

      const restingUpdatedAt = new Date();
      const restingRemainingAmount = restingState.remainingAmount - fillAmount;
      const restingFilledAmount = restingState.filledAmount + fillAmount;
      const restingLockedAmount =
        restingState.side === "BUY"
          ? restingRemainingAmount <= 0n
            ? 0n
            : restingState.lockedAmount - quoteAmount
          : restingRemainingAmount;
      const restingStatus: OrderStatus =
        restingRemainingAmount === 0n ? "FILLED" : "PARTIAL_FILLED";

      await tx
        .update(orders)
        .set({
          filledAmount: restingFilledAmount,
          remainingAmount: restingRemainingAmount,
          lockedAmount: restingLockedAmount < 0n ? 0n : restingLockedAmount,
          status: restingStatus,
          updatedAt: restingUpdatedAt,
        })
        .where(eq(orders.id, restingState.id));

      currentFilledAmount += fillAmount;
      currentSpentQuoteAmount += quoteAmount;
      totalBuyerFee += buyerFee;
      totalSellerFee += sellerFee;
      tradeCount += 1;

      if (incomingOrder.side === "BUY") {
        remainingQuoteAmount -= quoteAmount;
      } else {
        remainingBaseAmount -= fillAmount;
      }
    }

    const averagePrice =
      currentFilledAmount > 0n
        ? this.calculateAveragePrice(currentSpentQuoteAmount, currentFilledAmount, market)
        : 0n;
    const status = this.determineMarketOrderStatus(
      incomingOrder.side,
      currentFilledAmount,
      remainingQuoteAmount,
      remainingBaseAmount,
    );
    const cancelledAt = status === "PARTIAL_FILLED_CANCELLED" ? new Date() : null;
    const updatedAt = new Date();

    const [updatedOrder] = await tx
      .update(orders)
      .set({
        amount: incomingOrder.side === "BUY" ? currentFilledAmount : incomingOrder.amount,
        filledAmount: currentFilledAmount,
        remainingAmount: incomingOrder.side === "BUY" ? 0n : remainingBaseAmount,
        requestedQuoteAmount: request.quoteAmount,
        spentQuoteAmount: currentSpentQuoteAmount,
        averagePrice,
        lockedAmount: 0n,
        status,
        updatedAt,
        cancelledAt,
      })
      .where(eq(orders.id, incomingOrder.id))
      .returning();

    if (!updatedOrder) {
      throw new Error("Failed to update market order after matching.");
    }

    const finalOrder: OrderRow = {
      ...incomingOrder,
      amount: updatedOrder.amount,
      filledAmount: updatedOrder.filledAmount,
      remainingAmount: updatedOrder.remainingAmount,
      requestedQuoteAmount: updatedOrder.requestedQuoteAmount,
      spentQuoteAmount: updatedOrder.spentQuoteAmount,
      averagePrice: updatedOrder.averagePrice,
      lockedAmount: updatedOrder.lockedAmount,
      status: updatedOrder.status,
      updatedAt: updatedOrder.updatedAt,
      cancelledAt: updatedOrder.cancelledAt,
    };

    const summary: MarketExecutionSummary = {
      tradeCount,
      requestedQuoteAmount: request.quoteAmount,
      spentQuoteAmount: currentSpentQuoteAmount,
      receivedQuoteAmount:
        incomingOrder.side === "SELL" ? currentSpentQuoteAmount - totalSellerFee : 0n,
      filledAmount: currentFilledAmount,
      cancelledQuoteAmount: remainingQuoteAmount,
      cancelledBaseAmount: remainingBaseAmount,
      averagePrice,
      buyerFee: totalBuyerFee,
      sellerFee: totalSellerFee,
      status,
      liquidityStatus:
        tradeCount === 0
          ? "NONE"
          : status === "FILLED"
            ? "FULL"
            : "PARTIAL",
    };

    return { order: finalOrder, summary };
  }

  private async previewMarketOrder(
    db: Database | Transaction,
    userId: string,
    market: MarketDetails,
    side: "BUY" | "SELL",
    request: MarketOrderRequest,
  ): Promise<MarketExecutionSummary> {
    const oppositeSide = side === "BUY" ? "SELL" : "BUY";
    const restingOrders = await db
      .select({
        id: orders.id,
        userId: orders.userId,
        side: orders.side,
        price: orders.price,
        remainingAmount: orders.remainingAmount,
      })
      .from(orders)
      .innerJoin(users, eq(orders.userId, users.id))
      .where(
        and(
          eq(orders.marketId, market.id),
          eq(orders.side, oppositeSide),
          eq(orders.type, "LIMIT"),
          eq(users.status, "ACTIVE"),
          inArray(orders.status, OPEN_ORDER_STATUSES),
          sql`${orders.remainingAmount} > 0`,
        ),
      )
      .orderBy(
        ...(side === "BUY"
          ? [asc(orders.price), asc(orders.createdAt), asc(orders.id)]
          : [desc(orders.price), asc(orders.createdAt), asc(orders.id)]),
      );

    let remainingQuoteAmount = request.quoteAmount;
    let remainingBaseAmount = request.baseAmount;
    let filledAmount = 0n;
    let spentQuoteAmount = 0n;
    let buyerFee = 0n;
    let sellerFee = 0n;
    let tradeCount = 0;
    const feeConfig = await this.getFeeRatesForPreview(db, market.id);

    for (const resting of restingOrders) {
      if ((side === "BUY" && remainingQuoteAmount <= 0n) || (side === "SELL" && remainingBaseAmount <= 0n)) {
        break;
      }

      if (resting.userId === userId) {
        continue;
      }

      const fillAmount =
        side === "BUY"
          ? this.calculateMarketBuyFillAmount(
              remainingQuoteAmount,
              {
                price: resting.price,
                remainingAmount: resting.remainingAmount,
              },
              market,
            )
          : remainingBaseAmount < resting.remainingAmount
            ? remainingBaseAmount
            : resting.remainingAmount;

      if (fillAmount <= 0n) {
        break;
      }

      const quoteAmount = this.calculateQuoteTotalMinimalUnitsRoundedDown(
        resting.price,
        fillAmount,
        market.priceDecimals,
        market.baseAssetDecimals,
        market.quoteAssetDecimals,
      );

      if (quoteAmount <= 0n) {
        break;
      }

      filledAmount += fillAmount;
      spentQuoteAmount += quoteAmount;
      buyerFee += this.feesService.calculateFee(fillAmount, feeConfig.buyerFeeRateBps);
      sellerFee += this.feesService.calculateFee(quoteAmount, feeConfig.sellerFeeRateBps);
      tradeCount += 1;

      if (side === "BUY") {
        remainingQuoteAmount -= quoteAmount;
      } else {
        remainingBaseAmount -= fillAmount;
      }
    }

    const averagePrice =
      filledAmount > 0n ? this.calculateAveragePrice(spentQuoteAmount, filledAmount, market) : 0n;
    const status = this.determineMarketOrderStatus(
      side,
      filledAmount,
      remainingQuoteAmount,
      remainingBaseAmount,
    );

    return {
      tradeCount,
      requestedQuoteAmount: request.quoteAmount,
      spentQuoteAmount,
      receivedQuoteAmount: side === "SELL" ? spentQuoteAmount - sellerFee : 0n,
      filledAmount,
      cancelledQuoteAmount: remainingQuoteAmount,
      cancelledBaseAmount: remainingBaseAmount,
      averagePrice,
      buyerFee,
      sellerFee,
      status,
      liquidityStatus:
        tradeCount === 0
          ? "NONE"
          : status === "FILLED"
            ? "FULL"
            : "PARTIAL",
    };
  }

  private async previewLimitOrder(
    db: Database | Transaction,
    userId: string,
    market: MarketDetails,
    side: "BUY" | "SELL",
    price: bigint,
    amount: bigint,
    quoteTotal: bigint,
  ) {
    const feeConfig = await this.getFeeRatesForPreview(db, market.id);
    const estimatedFee =
      side === "BUY"
        ? this.feesService.calculateFee(amount, feeConfig.buyerFeeRateBps)
        : this.feesService.calculateFee(quoteTotal, feeConfig.sellerFeeRateBps);
    const mayMatchImmediately = await this.limitOrderMayMatchImmediately(
      db,
      market.id,
      userId,
      side,
      price,
    );

    return this.formatLimitPreview(
      market,
      side,
      price,
      amount,
      quoteTotal,
      estimatedFee,
      mayMatchImmediately,
    );
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
      buyerFee: bigint;
      buyerFeeRateBps: number;
      adminFeeUserId: string;
      buyerSideIsIncoming: boolean;
    },
  ) {
    const {
      market,
      trade,
      buyerOrder,
      buyerUserId,
      fillAmount,
      tradePrice,
      quoteAmount,
      buyerFee,
      buyerFeeRateBps,
      adminFeeUserId,
    } = input;

    const quoteWallet = await this.ensureWalletForUpdate(tx, buyerUserId, market.quoteAssetId);
    const buyerUsesAvailableBalance =
      input.buyerSideIsIncoming && this.isMarketOrderRow(buyerOrder);
    const lockedQuoteForFill =
      buyerUsesAvailableBalance || buyerOrder.price === tradePrice
        ? quoteAmount
        : this.calculateQuoteTotalMinimalUnits(
            buyerOrder.price,
            fillAmount,
            market.priceDecimals,
            market.baseAssetDecimals,
            market.quoteAssetDecimals,
          );
    const refundAmount =
      !buyerUsesAvailableBalance && lockedQuoteForFill > quoteAmount
        ? lockedQuoteForFill - quoteAmount
        : 0n;

    if (buyerUsesAvailableBalance) {
      if (quoteWallet.availableBalance < quoteAmount) {
        throw new BadRequestException("Available quote balance is lower than the market buy fill amount.");
      }
    } else if (quoteWallet.lockedBalance < lockedQuoteForFill) {
      throw new BadRequestException("Locked quote balance is lower than the buy fill amount.");
    }

    const quoteWalletAvailableAfterSpent = buyerUsesAvailableBalance
      ? quoteWallet.availableBalance - quoteAmount
      : quoteWallet.availableBalance;
    const quoteWalletLockedAfterSpent = buyerUsesAvailableBalance
      ? quoteWallet.lockedBalance
      : quoteWallet.lockedBalance - lockedQuoteForFill;
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
    const baseWalletAvailableAfterGross = baseWallet.availableBalance + fillAmount;

    await this.updateWallet(tx, baseWallet, {
      availableBalance: baseWalletAvailableAfterGross,
      lockedBalance: baseWallet.lockedBalance,
      updatedAt: new Date(),
    });

    await tx.insert(ledgerEntries).values({
      userId: buyerUserId,
      assetId: market.baseAssetId,
      type: "TRADE_BUY",
      amount: fillAmount,
      balanceAvailableAfter: baseWalletAvailableAfterGross,
      balanceLockedAfter: baseWallet.lockedBalance,
      refType: "TRADE",
      refId: trade.id,
      note: `Buy fill received ${market.baseAssetSymbol} at maker price ${formatMinimalUnitsToHuman(tradePrice, market.priceDecimals)} on ${market.symbol}`,
    });

    if (buyerFee > 0n) {
      const baseWalletAvailableAfterFee = baseWalletAvailableAfterGross - buyerFee;

      await this.updateWallet(tx, baseWallet, {
        availableBalance: baseWalletAvailableAfterFee,
        lockedBalance: baseWallet.lockedBalance,
        updatedAt: new Date(),
      });

      await tx.insert(ledgerEntries).values({
        userId: buyerUserId,
        assetId: market.baseAssetId,
        type: "FEE",
        amount: -buyerFee,
        balanceAvailableAfter: baseWalletAvailableAfterFee,
        balanceLockedAfter: baseWallet.lockedBalance,
        refType: "TRADE",
        refId: trade.id,
        note: `Buyer fee ${this.feesService.formatBpsAsHuman(buyerFeeRateBps)} charged in ${market.baseAssetSymbol} on ${market.symbol}`,
      });

      await this.creditAdminFeeWallet(tx, {
        adminUserId: adminFeeUserId,
        assetId: market.baseAssetId,
        amount: buyerFee,
        tradeId: trade.id,
        note: `Fee income: buyer fee ${this.feesService.formatBpsAsHuman(buyerFeeRateBps)} in ${market.baseAssetSymbol} on ${market.symbol}`,
      });
    }
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
      sellerFee: bigint;
      sellerFeeRateBps: number;
      adminFeeUserId: string;
      sellerSideIsIncoming: boolean;
    },
  ) {
    const {
      market,
      trade,
      sellerUserId,
      fillAmount,
      tradePrice,
      quoteAmount,
      sellerFee,
      sellerFeeRateBps,
      adminFeeUserId,
    } = input;

    const baseWallet = await this.ensureWalletForUpdate(tx, sellerUserId, market.baseAssetId);
    const sellerUsesAvailableBalance =
      input.sellerSideIsIncoming && this.isMarketOrderRow(input.sellerOrder);

    if (sellerUsesAvailableBalance) {
      if (baseWallet.availableBalance < fillAmount) {
        throw new BadRequestException("Available base balance is lower than the market sell fill amount.");
      }

      const baseWalletAvailableAfter = baseWallet.availableBalance - fillAmount;
      await this.updateWallet(tx, baseWallet, {
        availableBalance: baseWalletAvailableAfter,
        lockedBalance: baseWallet.lockedBalance,
        updatedAt: new Date(),
      });

      await tx.insert(ledgerEntries).values({
        userId: sellerUserId,
        assetId: market.baseAssetId,
        type: "TRADE_SELL",
        amount: -fillAmount,
        balanceAvailableAfter: baseWalletAvailableAfter,
        balanceLockedAfter: baseWallet.lockedBalance,
        refType: "TRADE",
        refId: trade.id,
        note: `Market sell delivered ${market.baseAssetSymbol} at maker price ${formatMinimalUnitsToHuman(tradePrice, market.priceDecimals)} on ${market.symbol}`,
      });
    } else {
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
    }

    const quoteWallet = await this.ensureWalletForUpdate(tx, sellerUserId, market.quoteAssetId);
    const quoteWalletAvailableAfterGross = quoteWallet.availableBalance + quoteAmount;

    await this.updateWallet(tx, quoteWallet, {
      availableBalance: quoteWalletAvailableAfterGross,
      lockedBalance: quoteWallet.lockedBalance,
      updatedAt: new Date(),
    });

    await tx.insert(ledgerEntries).values({
      userId: sellerUserId,
      assetId: market.quoteAssetId,
      type: "TRADE_SELL",
      amount: quoteAmount,
      balanceAvailableAfter: quoteWalletAvailableAfterGross,
      balanceLockedAfter: quoteWallet.lockedBalance,
      refType: "TRADE",
      refId: trade.id,
      note: `Sell fill at maker price ${formatMinimalUnitsToHuman(tradePrice, market.priceDecimals)} on ${market.symbol}`,
    });

    if (sellerFee > 0n) {
      const quoteWalletAvailableAfterFee = quoteWalletAvailableAfterGross - sellerFee;

      await this.updateWallet(tx, quoteWallet, {
        availableBalance: quoteWalletAvailableAfterFee,
        lockedBalance: quoteWallet.lockedBalance,
        updatedAt: new Date(),
      });

      await tx.insert(ledgerEntries).values({
        userId: sellerUserId,
        assetId: market.quoteAssetId,
        type: "FEE",
        amount: -sellerFee,
        balanceAvailableAfter: quoteWalletAvailableAfterFee,
        balanceLockedAfter: quoteWallet.lockedBalance,
        refType: "TRADE",
        refId: trade.id,
        note: `Seller fee ${this.feesService.formatBpsAsHuman(sellerFeeRateBps)} charged in ${market.quoteAssetSymbol} on ${market.symbol}`,
      });

      await this.creditAdminFeeWallet(tx, {
        adminUserId: adminFeeUserId,
        assetId: market.quoteAssetId,
        amount: sellerFee,
        tradeId: trade.id,
        note: `Fee income: seller fee ${this.feesService.formatBpsAsHuman(sellerFeeRateBps)} in ${market.quoteAssetSymbol} on ${market.symbol}`,
      });
    }
  }

  private async creditAdminFeeWallet(
    tx: Transaction,
    input: {
      adminUserId: string;
      assetId: string;
      amount: bigint;
      tradeId: string;
      note: string;
    },
  ) {
    if (input.amount <= 0n) {
      return;
    }

    const feeWallet = await this.ensureWalletForUpdate(tx, input.adminUserId, input.assetId, "FEE");
    const availableAfter = feeWallet.availableBalance + input.amount;

    await this.updateWallet(tx, feeWallet, {
      availableBalance: availableAfter,
      lockedBalance: feeWallet.lockedBalance,
      updatedAt: new Date(),
    });

    await tx.insert(ledgerEntries).values({
      userId: input.adminUserId,
      assetId: input.assetId,
      type: "FEE",
      amount: input.amount,
      balanceAvailableAfter: availableAfter,
      balanceLockedAfter: feeWallet.lockedBalance,
      refType: "TRADE",
      refId: input.tradeId,
      note: input.note,
    });
  }

  private async ensureWalletForUpdate(
    tx: Transaction,
    userId: string,
    assetId: string,
    walletType: WalletType = "MAIN",
  ) {
    await tx
      .insert(wallets)
      .values({
        userId,
        assetId,
        walletType,
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
        walletType: wallets.walletType,
        availableBalance: wallets.availableBalance,
        lockedBalance: wallets.lockedBalance,
        assetSymbol: assetsAlias.symbol,
        assetName: assetsAlias.name,
        assetDecimals: assetsAlias.decimals,
      })
      .from(wallets)
      .innerJoin(assetsAlias, eq(wallets.assetId, assetsAlias.id))
      .where(and(eq(wallets.userId, userId), eq(wallets.assetId, assetId), eq(wallets.walletType, walletType)))
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
    const quoteAssets = aliasedTable(assets, "quote_assets");

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
        quoteAssetSymbol: quoteAssets.symbol,
        quoteAssetDecimals: quoteAssets.decimals,
        side: orders.side,
        type: orders.type,
        price: orders.price,
        amount: orders.amount,
        filledAmount: orders.filledAmount,
        remainingAmount: orders.remainingAmount,
        requestedQuoteAmount: orders.requestedQuoteAmount,
        spentQuoteAmount: orders.spentQuoteAmount,
        averagePrice: orders.averagePrice,
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
      .innerJoin(quoteAssets, eq(markets.quoteAssetId, quoteAssets.id))
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
        minOrderAmount: markets.minOrderAmount,
        minNotional: markets.minNotional,
        baseAssetId: markets.baseAssetId,
        baseAssetSymbol: baseAssets.symbol,
        baseAssetIsActive: baseAssets.isActive,
        baseAssetDecimals: baseAssets.decimals,
        quoteAssetId: markets.quoteAssetId,
        quoteAssetSymbol: quoteAssets.symbol,
        quoteAssetIsActive: quoteAssets.isActive,
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

    if (!symbol) {
      throw new BadRequestException("marketSymbol is required.");
    }

    if (symbol.length > 32) {
      throw new BadRequestException("marketSymbol is too long.");
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

  private normalizeOrderType(input: string) {
    const type = input.trim().toUpperCase();

    if (type !== "LIMIT" && type !== "MARKET") {
      throw new BadRequestException("type must be LIMIT or MARKET.");
    }

    return type as OrderType;
  }

  private requireString(input: string | undefined, fieldName: string) {
    if (typeof input !== "string") {
      throw new BadRequestException(`${fieldName} is required.`);
    }

    return input;
  }

  private parseMarketOrderRequest(
    dto: CreateOrderDto,
    market: MarketDetails,
    side: "BUY" | "SELL",
  ): MarketOrderRequest {
    if (side === "BUY") {
      const quoteInput = dto.quoteAmount ?? dto.spendAmount;
      return {
        quoteAmount: this.parseQuoteAmount(
          this.requireString(quoteInput, "quoteAmount"),
          market.quoteAssetDecimals,
        ),
        baseAmount: 0n,
      };
    }

    return {
      quoteAmount: 0n,
      baseAmount: this.parseAmount(
        this.requireString(dto.amount, "amount"),
        market.baseAssetDecimals,
      ),
    };
  }

  private normalizeStatus(input: string) {
    const status = input.trim().toUpperCase();

    if (!ORDER_STATUSES.includes(status as OrderStatus)) {
      throw new BadRequestException("Invalid order status filter.");
    }

    return status as OrderStatus;
  }

  private isUuid(input: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input,
    );
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

  private parseQuoteAmount(input: string, decimals: number) {
    try {
      return parseHumanDecimalToMinimalUnits(input, decimals, "Quote amount");
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

  private calculateQuoteTotalMinimalUnitsRoundedDown(
    price: bigint,
    amount: bigint,
    priceDecimals: number,
    amountDecimals: number,
    quoteDecimals: number,
  ) {
    if (price <= 0n || amount <= 0n) {
      return 0n;
    }

    const numerator = price * amount * 10n ** BigInt(quoteDecimals);
    const denominator = 10n ** BigInt(priceDecimals + amountDecimals);
    return numerator / denominator;
  }

  private calculateBaseAmountForQuoteRoundedDown(
    quoteAmount: bigint,
    price: bigint,
    market: Pick<MarketDetails, "priceDecimals" | "baseAssetDecimals" | "quoteAssetDecimals">,
  ) {
    if (quoteAmount <= 0n || price <= 0n) {
      return 0n;
    }

    const numerator =
      quoteAmount * 10n ** BigInt(market.priceDecimals + market.baseAssetDecimals);
    const denominator = price * 10n ** BigInt(market.quoteAssetDecimals);
    return numerator / denominator;
  }

  private calculateMarketBuyFillAmount(
    remainingQuoteAmount: bigint,
    restingOrder: Pick<RestingOrderRow, "price" | "remainingAmount">,
    market: MarketDetails,
  ) {
    const affordableAmount = this.calculateBaseAmountForQuoteRoundedDown(
      remainingQuoteAmount,
      restingOrder.price,
      market,
    );

    if (affordableAmount <= 0n) {
      return 0n;
    }

    return affordableAmount < restingOrder.remainingAmount
      ? affordableAmount
      : restingOrder.remainingAmount;
  }

  private calculateAveragePrice(spentQuoteAmount: bigint, filledAmount: bigint, market: MarketDetails) {
    if (spentQuoteAmount <= 0n || filledAmount <= 0n) {
      return 0n;
    }

    const numerator =
      spentQuoteAmount * 10n ** BigInt(market.priceDecimals + market.baseAssetDecimals);
    const denominator = filledAmount * 10n ** BigInt(market.quoteAssetDecimals);
    return numerator / denominator;
  }

  private determineMarketOrderStatus(
    side: "BUY" | "SELL",
    filledAmount: bigint,
    remainingQuoteAmount: bigint,
    remainingBaseAmount: bigint,
  ): OrderStatus {
    if (filledAmount <= 0n) {
      return "REJECTED";
    }

    if (side === "BUY") {
      return remainingQuoteAmount === 0n ? "FILLED" : "PARTIAL_FILLED_CANCELLED";
    }

    return remainingBaseAmount === 0n ? "FILLED" : "PARTIAL_FILLED_CANCELLED";
  }

  private isMarketOrderRow(order: OrderRow | RestingOrderRow): order is OrderRow {
    return "type" in order && order.type === "MARKET";
  }

  private async limitOrderMayMatchImmediately(
    db: Database | Transaction,
    marketId: string,
    userId: string,
    side: "BUY" | "SELL",
    price: bigint,
  ) {
    const oppositeSide = side === "BUY" ? "SELL" : "BUY";
    const priceCondition =
      side === "BUY" ? sql`${orders.price} <= ${price}` : sql`${orders.price} >= ${price}`;

    const [match] = await db
      .select({
        id: orders.id,
      })
      .from(orders)
      .innerJoin(users, eq(orders.userId, users.id))
      .where(
        and(
          eq(orders.marketId, marketId),
          eq(orders.side, oppositeSide),
          eq(orders.type, "LIMIT"),
          eq(users.status, "ACTIVE"),
          inArray(orders.status, OPEN_ORDER_STATUSES),
          sql`${orders.remainingAmount} > 0`,
          ne(orders.userId, userId),
          priceCondition,
        ),
      )
      .limit(1);

    return Boolean(match);
  }

  private async getFeeRatesForPreview(db: Database | Transaction, marketId: string) {
    const [setting] = await db
      .select({
        buyerFeeRateBps: feeSettings.buyerFeeRateBps,
        sellerFeeRateBps: feeSettings.sellerFeeRateBps,
      })
      .from(feeSettings)
      .where(and(eq(feeSettings.marketId, marketId), eq(feeSettings.isActive, true)))
      .limit(1);

    return {
      buyerFeeRateBps: setting?.buyerFeeRateBps ?? DEFAULT_FEE_RATE_BPS,
      sellerFeeRateBps: setting?.sellerFeeRateBps ?? DEFAULT_FEE_RATE_BPS,
    };
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

  private assertOrderMinimums(
    market: Pick<
      MarketDetails,
      "minOrderAmount" | "minNotional" | "baseAssetDecimals" | "quoteAssetDecimals"
    >,
    amount: bigint,
    quoteTotal: bigint,
  ) {
    if (market.minOrderAmount > 0n && amount < market.minOrderAmount) {
      throw new BadRequestException(
        `Amount must be at least ${formatMinimalUnitsToHuman(
          market.minOrderAmount,
          market.baseAssetDecimals,
        )}.`,
      );
    }

    if (market.minNotional > 0n && quoteTotal < market.minNotional) {
      throw new BadRequestException(
        `Order notional must be at least ${formatMinimalUnitsToHuman(
          market.minNotional,
          market.quoteAssetDecimals,
        )}.`,
      );
    }
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
    const cancelledQuoteAmount =
      row.type === "MARKET" && row.side === "BUY" && row.requestedQuoteAmount > row.spentQuoteAmount
        ? row.requestedQuoteAmount - row.spentQuoteAmount
        : 0n;

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
      requestedQuoteAmount:
        row.requestedQuoteAmount > 0n
          ? formatMinimalUnitsToHuman(row.requestedQuoteAmount, row.quoteAssetDecimals)
          : null,
      requestedQuoteAmountRaw:
        row.requestedQuoteAmount > 0n ? row.requestedQuoteAmount.toString() : null,
      spentQuoteAmount: formatMinimalUnitsToHuman(row.spentQuoteAmount, row.quoteAssetDecimals),
      spentQuoteAmountRaw: row.spentQuoteAmount.toString(),
      averagePrice:
        row.averagePrice > 0n
          ? formatMinimalUnitsToHuman(row.averagePrice, row.priceDecimals)
          : null,
      averagePriceRaw: row.averagePrice > 0n ? row.averagePrice.toString() : null,
      cancelledQuoteAmount:
        cancelledQuoteAmount > 0n
          ? formatMinimalUnitsToHuman(cancelledQuoteAmount, row.quoteAssetDecimals)
          : null,
      cancelledQuoteAmountRaw:
        cancelledQuoteAmount > 0n ? cancelledQuoteAmount.toString() : null,
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

  private formatMarketOrderResult(
    row: OrderRow,
    market: MarketDetails,
    summary: MarketExecutionSummary,
  ) {
    const formattedOrder = this.formatOrder(row);
    const feeSummary = {
      buyerFee: formatMinimalUnitsToHuman(summary.buyerFee, market.baseAssetDecimals),
      buyerFeeRaw: summary.buyerFee.toString(),
      buyerFeeAssetSymbol: market.baseAssetSymbol,
      sellerFee: formatMinimalUnitsToHuman(summary.sellerFee, market.quoteAssetDecimals),
      sellerFeeRaw: summary.sellerFee.toString(),
      sellerFeeAssetSymbol: market.quoteAssetSymbol,
    };

    return {
      ...formattedOrder,
      tradeCount: summary.tradeCount,
      spentQuoteAmount: formatMinimalUnitsToHuman(
        summary.spentQuoteAmount,
        market.quoteAssetDecimals,
      ),
      spentQuoteAmountRaw: summary.spentQuoteAmount.toString(),
      receivedQuoteAmount:
        row.side === "SELL"
          ? formatMinimalUnitsToHuman(summary.receivedQuoteAmount, market.quoteAssetDecimals)
          : null,
      receivedQuoteAmountRaw:
        row.side === "SELL" ? summary.receivedQuoteAmount.toString() : null,
      averagePrice:
        summary.averagePrice > 0n
          ? formatMinimalUnitsToHuman(summary.averagePrice, market.priceDecimals)
          : null,
      averagePriceRaw: summary.averagePrice > 0n ? summary.averagePrice.toString() : null,
      cancelledQuoteAmount:
        row.side === "BUY" && summary.cancelledQuoteAmount > 0n
          ? formatMinimalUnitsToHuman(summary.cancelledQuoteAmount, market.quoteAssetDecimals)
          : null,
      cancelledQuoteAmountRaw:
        row.side === "BUY" && summary.cancelledQuoteAmount > 0n
          ? summary.cancelledQuoteAmount.toString()
          : null,
      cancelledAmount:
        row.side === "SELL" && summary.cancelledBaseAmount > 0n
          ? formatMinimalUnitsToHuman(summary.cancelledBaseAmount, market.baseAssetDecimals)
          : null,
      cancelledAmountRaw:
        row.side === "SELL" && summary.cancelledBaseAmount > 0n
          ? summary.cancelledBaseAmount.toString()
          : null,
      feeSummary,
      warning: summary.status === "PARTIAL_FILLED_CANCELLED" ? PARTIAL_MARKET_WARNING : null,
    };
  }

  private formatMarketPreview(
    market: MarketDetails,
    side: "BUY" | "SELL",
    summary: MarketExecutionSummary,
  ) {
    const buyerFee = formatMinimalUnitsToHuman(summary.buyerFee, market.baseAssetDecimals);
    const sellerFee = formatMinimalUnitsToHuman(summary.sellerFee, market.quoteAssetDecimals);
    const estimatedReceiveBase =
      summary.filledAmount > summary.buyerFee ? summary.filledAmount - summary.buyerFee : 0n;

    return {
      marketSymbol: market.symbol,
      market: market.symbol,
      side,
      type: "MARKET" as const,
      estimatedFilledAmount: formatMinimalUnitsToHuman(
        summary.filledAmount,
        market.baseAssetDecimals,
      ),
      estimatedFilledAmountRaw: summary.filledAmount.toString(),
      estimatedReceiveAmount:
        side === "BUY"
          ? formatMinimalUnitsToHuman(estimatedReceiveBase, market.baseAssetDecimals)
          : null,
      estimatedReceiveAmountRaw: side === "BUY" ? estimatedReceiveBase.toString() : null,
      estimatedSpentQuote: formatMinimalUnitsToHuman(
        summary.spentQuoteAmount,
        market.quoteAssetDecimals,
      ),
      estimatedSpentQuoteRaw: summary.spentQuoteAmount.toString(),
      estimatedReceivedQuote:
        side === "SELL"
          ? formatMinimalUnitsToHuman(summary.receivedQuoteAmount, market.quoteAssetDecimals)
          : null,
      estimatedReceivedQuoteRaw:
        side === "SELL" ? summary.receivedQuoteAmount.toString() : null,
      estimatedAveragePrice:
        summary.averagePrice > 0n
          ? formatMinimalUnitsToHuman(summary.averagePrice, market.priceDecimals)
          : null,
      estimatedAveragePriceRaw: summary.averagePrice > 0n ? summary.averagePrice.toString() : null,
      estimatedBuyerFee: buyerFee,
      estimatedBuyerFeeRaw: summary.buyerFee.toString(),
      estimatedBuyerFeeAssetSymbol: market.baseAssetSymbol,
      estimatedSellerFee: sellerFee,
      estimatedSellerFeeRaw: summary.sellerFee.toString(),
      estimatedSellerFeeAssetSymbol: market.quoteAssetSymbol,
      estimatedTradeCount: summary.tradeCount,
      liquidityStatus: summary.liquidityStatus,
      warning:
        summary.liquidityStatus === "NONE"
          ? "No available liquidity for this market order."
          : summary.status === "PARTIAL_FILLED_CANCELLED"
            ? PARTIAL_MARKET_WARNING
            : null,
    };
  }

  private formatLimitPreview(
    market: MarketDetails,
    side: "BUY" | "SELL",
    price: bigint,
    amount: bigint,
    quoteTotal: bigint,
    estimatedFee: bigint,
    mayMatchImmediately: boolean,
  ) {
    return {
      marketSymbol: market.symbol,
      market: market.symbol,
      side,
      type: "LIMIT" as const,
      price: formatMinimalUnitsToHuman(price, market.priceDecimals),
      priceRaw: price.toString(),
      amount: formatMinimalUnitsToHuman(amount, market.baseAssetDecimals),
      amountRaw: amount.toString(),
      total: formatMinimalUnitsToHuman(quoteTotal, market.quoteAssetDecimals),
      totalRaw: quoteTotal.toString(),
      estimatedFee: formatMinimalUnitsToHuman(
        estimatedFee,
        side === "BUY" ? market.baseAssetDecimals : market.quoteAssetDecimals,
      ),
      estimatedFeeRaw: estimatedFee.toString(),
      estimatedFeeAssetSymbol: side === "BUY" ? market.baseAssetSymbol : market.quoteAssetSymbol,
      mayMatchImmediately,
      warning: mayMatchImmediately
        ? "This limit order may immediately match against resting liquidity."
        : null,
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
