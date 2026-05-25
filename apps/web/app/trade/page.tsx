"use client";

import type { ReactNode } from "react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { MarketSelector } from "@/components/trade/market-selector";
import { OrderConfirmationDialog, type OrderConfirmationView } from "@/components/trade/order-confirmation-dialog";
import { KlineChart } from "@/components/trade/kline-chart";
import { AssetIcon, AssetPairIcons } from "@/components/ui/asset-icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest, ApiError } from "@/lib/api-client";
import type {
  CandleInterval,
  MarketCandle,
  OrderBook,
  OrderBookLevel,
  LimitOrderPreview,
  MarketOrderPreview,
  MarketSummary,
  MarketTicker,
  OrderEntry,
  OrderSide,
  OrderStatus,
  OrderPreview,
  OrderType,
  TradeEntry,
  WalletBalance,
} from "@/lib/api-types";
import { shortId } from "@/lib/format";
import { CURRENT_MILESTONE_VERSION, TRADE_PAGE_COPY } from "@/lib/milestone-copy";

const DEFAULT_MARKET_SYMBOL = "SWL/SWC";
const MONEY_DECIMALS = 18;
const POLL_INTERVAL_MS = 5000;

type OrderSubmissionBody =
  | {
      marketSymbol: string;
      side: OrderSide;
      type: "LIMIT";
      price: string;
      amount: string;
    }
  | {
      marketSymbol: string;
      side: OrderSide;
      type: "MARKET";
      amount?: string;
      quoteAmount?: string;
      spendAmount?: string;
    };

type MarketSelectorEntry = Pick<
  MarketSummary,
  | "marketSymbol"
  | "baseAssetSymbol"
  | "quoteAssetSymbol"
  | "baseAssetName"
  | "quoteAssetName"
  | "baseAssetDisplayName"
  | "quoteAssetDisplayName"
  | "baseAssetIconUrl"
  | "quoteAssetIconUrl"
  | "lastPrice"
  | "volume24h"
  | "change24hPercent"
  | "status"
>;

type BottomPanelTab = "OPEN_ORDERS" | "ORDER_HISTORY" | "TRADE_HISTORY" | "ASSETS";
type BulkCancelScope = "ALL" | "BUY" | "SELL";

export default function TradePage() {
  const [selectedMarketSymbol, setSelectedMarketSymbol] = useState(DEFAULT_MARKET_SYMBOL);
  const [orderType, setOrderType] = useState<OrderType>("LIMIT");
  const [side, setSide] = useState<OrderSide>("BUY");
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [marketInput, setMarketInput] = useState("");
  const [marketPreview, setMarketPreview] = useState<MarketOrderPreview | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<OrderConfirmationView | null>(null);
  const [pendingOrderBody, setPendingOrderBody] = useState<OrderSubmissionBody | null>(null);
  const [wallets, setWallets] = useState<WalletBalance[]>([]);
  const [markets, setMarkets] = useState<MarketSummary[]>([]);
  const [ticker, setTicker] = useState<MarketTicker | null>(null);
  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  const [myOrders, setMyOrders] = useState<OrderEntry[]>([]);
  const [orderHistory, setOrderHistory] = useState<OrderEntry[]>([]);
  const [recentTrades, setRecentTrades] = useState<TradeEntry[]>([]);
  const [myTradeHistory, setMyTradeHistory] = useState<TradeEntry[]>([]);
  const [candles, setCandles] = useState<MarketCandle[]>([]);
  const [candleInterval, setCandleInterval] = useState<CandleInterval>("1m");
  const [isCandlesLoading, setIsCandlesLoading] = useState(true);
  const [candleError, setCandleError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [bulkCancellingScope, setBulkCancellingScope] = useState<BulkCancelScope | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastExecutionOrder, setLastExecutionOrder] = useState<OrderEntry | null>(null);
  const [bottomPanelTab, setBottomPanelTab] = useState<BottomPanelTab>("OPEN_ORDERS");

  useEffect(() => {
    const requestedMarket = new URLSearchParams(window.location.search)
      .get("market")
      ?.trim()
      .toUpperCase();

    if (requestedMarket) {
      setSelectedMarketSymbol(requestedMarket);
    }
  }, []);

  const selectedMarket = markets.find((market) => market.marketSymbol === selectedMarketSymbol) ?? null;
  const baseSymbol =
    ticker?.baseAssetSymbol ?? selectedMarket?.baseAssetSymbol ?? marketBaseSymbol(selectedMarketSymbol);
  const quoteSymbol =
    ticker?.quoteAssetSymbol ?? selectedMarket?.quoteAssetSymbol ?? marketQuoteSymbol(selectedMarketSymbol);
  const baseName =
    ticker?.baseAssetDisplayName ??
    ticker?.baseAssetName ??
    selectedMarket?.baseAssetDisplayName ??
    selectedMarket?.baseAssetName ??
    baseSymbol;
  const quoteName =
    ticker?.quoteAssetDisplayName ??
    ticker?.quoteAssetName ??
    selectedMarket?.quoteAssetDisplayName ??
    selectedMarket?.quoteAssetName ??
    quoteSymbol;
  const baseIconUrl = ticker?.baseAssetIconUrl ?? selectedMarket?.baseAssetIconUrl ?? null;
  const quoteIconUrl = ticker?.quoteAssetIconUrl ?? selectedMarket?.quoteAssetIconUrl ?? null;
  const marketStatus = ticker?.status ?? selectedMarket?.status ?? "ACTIVE";
  const lockedAssetSymbol = side === "BUY" ? quoteSymbol : baseSymbol;
  const selectedWallet =
    wallets.find((wallet) => wallet.asset === lockedAssetSymbol || wallet.symbol === lockedAssetSymbol) ??
    null;
  const baseWallet = wallets.find((wallet) => wallet.asset === baseSymbol || wallet.symbol === baseSymbol) ?? null;
  const quoteWallet =
    wallets.find((wallet) => wallet.asset === quoteSymbol || wallet.symbol === quoteSymbol) ?? null;
  const totalPreview = useMemo(() => calculateTotalPreview(price, amount), [price, amount]);
  const marketSelectorSelection: MarketSelectorEntry | null = selectedMarket
    ? selectedMarket
    : ticker
      ? {
          marketSymbol: ticker.marketSymbol,
          baseAssetSymbol: ticker.baseAssetSymbol,
          quoteAssetSymbol: ticker.quoteAssetSymbol,
          baseAssetName: ticker.baseAssetName,
          quoteAssetName: ticker.quoteAssetName,
          baseAssetDisplayName: ticker.baseAssetDisplayName,
          quoteAssetDisplayName: ticker.quoteAssetDisplayName,
          baseAssetIconUrl: ticker.baseAssetIconUrl,
          quoteAssetIconUrl: ticker.quoteAssetIconUrl,
          lastPrice: ticker.lastPrice,
          volume24h: ticker.volume24h,
          change24hPercent: ticker.change24hPercent,
          status: ticker.status ?? "ACTIVE",
        }
      : null;

  useEffect(() => {
    void loadTradeData();
    const intervalId = window.setInterval(() => {
      void loadTradeData({ silent: true });
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [selectedMarketSymbol]);

  useEffect(() => {
    void loadCandles();
    const intervalId = window.setInterval(() => {
      void loadCandles({ silent: true });
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [selectedMarketSymbol, candleInterval]);

  useEffect(() => {
    if (orderType !== "MARKET" || !marketInput.trim()) {
      setMarketPreview(null);
      setPreviewError(null);
      setIsPreviewLoading(false);
      return;
    }

    let active = true;
    const timeoutId = window.setTimeout(() => {
      void loadMarketPreview(() => active);
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [orderType, side, marketInput, selectedMarketSymbol]);

  useEffect(() => {
    if (markets.length === 0) {
      return;
    }

    if (markets.some((market) => market.marketSymbol === selectedMarketSymbol)) {
      return;
    }

    handleMarketChange(DEFAULT_MARKET_SYMBOL);
  }, [markets, selectedMarketSymbol]);

  async function loadTradeData(options: { silent?: boolean } = {}) {
    try {
      if (!options.silent) {
        setIsLoading(true);
      }

      const marketQuery = encodeURIComponent(selectedMarketSymbol);
      const [
        bookResponse,
        ordersResponse,
        walletResponse,
        tradesResponse,
        myTradesResponse,
        summaryResponse,
        tickerResponse,
      ] =
        await Promise.all([
          apiRequest<OrderBook>(`/order-book?marketSymbol=${marketQuery}`),
          apiRequest<OrderEntry[]>(`/orders/me?marketSymbol=${marketQuery}`),
          apiRequest<WalletBalance[]>("/wallets/me"),
          apiRequest<TradeEntry[]>(`/trades/recent?marketSymbol=${marketQuery}`),
          apiRequest<TradeEntry[]>(`/trades/me?marketSymbol=${marketQuery}`),
          apiRequest<MarketSummary[]>("/markets/summary"),
          apiRequest<MarketTicker>(`/markets/ticker?marketSymbol=${marketQuery}`),
        ]);

      const sortedOrders = ordersResponse
        .slice()
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
      const sortedRecentTrades = tradesResponse
        .slice()
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
      const sortedMyTrades = myTradesResponse
        .slice()
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

      setOrderBook(bookResponse);
      setTicker(tickerResponse);
      setMarkets(summaryResponse);
      setOrderHistory(sortedOrders);
      setMyOrders(
        sortedOrders.filter(
          (order) => isOpenOrder(order.status) && BigInt(order.remainingAmountRaw) > 0n,
        ),
      );
      setWallets(walletResponse);
      setRecentTrades(sortedRecentTrades);
      setMyTradeHistory(sortedMyTrades);
      if (!options.silent) {
        setError(null);
      }
    } catch (loadError) {
      if (!options.silent) {
        setError(loadError instanceof ApiError ? loadError.message : "Unable to load trade data.");
      }
    } finally {
      if (!options.silent) {
        setIsLoading(false);
      }
    }
  }

  async function loadCandles(options: { silent?: boolean } = {}) {
    try {
      if (!options.silent) {
        setIsCandlesLoading(true);
      }

      const marketQuery = encodeURIComponent(selectedMarketSymbol);
      const candlesResponse = await apiRequest<MarketCandle[]>(
        `/markets/candles?marketSymbol=${marketQuery}&interval=${candleInterval}&limit=100`,
      );

      setCandles(candlesResponse);
      if (!options.silent) {
        setCandleError(null);
      }
    } catch (loadError) {
      if (!options.silent) {
        setCandleError(loadError instanceof ApiError ? loadError.message : "Unable to load candles.");
      }
    } finally {
      if (!options.silent) {
        setIsCandlesLoading(false);
      }
    }
  }

  async function loadMarketPreview(isActive: () => boolean) {
    try {
      setIsPreviewLoading(true);
      const body =
        side === "BUY"
          ? {
              marketSymbol: selectedMarketSymbol,
              side,
              type: "MARKET",
              quoteAmount: marketInput.trim(),
            }
          : {
              marketSymbol: selectedMarketSymbol,
              side,
              type: "MARKET",
              amount: marketInput.trim(),
            };
      const preview = await apiRequest<MarketOrderPreview>("/orders/preview", {
        method: "POST",
        body,
      });

      if (isActive()) {
        setMarketPreview(preview);
        setPreviewError(null);
      }
    } catch (loadError) {
      if (isActive()) {
        setMarketPreview(null);
        setPreviewError(
          loadError instanceof ApiError ? loadError.message : "Unable to estimate market order.",
        );
      }
    } finally {
      if (isActive()) {
        setIsPreviewLoading(false);
      }
    }
  }

  function handleMarketChange(nextMarketSymbol: string) {
    const normalizedMarketSymbol = nextMarketSymbol.trim().toUpperCase();
    setSelectedMarketSymbol(normalizedMarketSymbol);
    setTicker(null);
    setOrderBook(null);
    setMyOrders([]);
    setOrderHistory([]);
    setRecentTrades([]);
    setMyTradeHistory([]);
    setCandles([]);
    setCandleError(null);
    setIsCandlesLoading(true);
    setPrice("");
    setAmount("");
    setMarketInput("");
    setMarketPreview(null);
    setPreviewError(null);
    setSuccess(null);
    setError(null);
    setLastExecutionOrder(null);
    setPendingConfirmation(null);
    setPendingOrderBody(null);
    setBottomPanelTab("OPEN_ORDERS");

    const url = new URL(window.location.href);
    url.searchParams.set("market", normalizedMarketSymbol);
    window.history.replaceState({}, "", `${url.pathname}?${url.searchParams.toString()}${url.hash}`);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLastExecutionOrder(null);

    try {
      const previewResponse = await apiRequest<OrderPreview>("/orders/preview", {
        method: "POST",
        body:
          orderType === "MARKET"
            ? side === "BUY"
              ? {
                  marketSymbol: selectedMarketSymbol,
                  side,
                  type: "MARKET",
                  quoteAmount: marketInput.trim(),
                }
              : {
                  marketSymbol: selectedMarketSymbol,
                  side,
                  type: "MARKET",
                  amount: marketInput.trim(),
                }
            : {
                marketSymbol: selectedMarketSymbol,
                side,
                type: "LIMIT",
                price: price.trim(),
                amount: amount.trim(),
              },
      });

      const orderBody: OrderSubmissionBody =
        orderType === "MARKET"
          ? side === "BUY"
            ? {
                marketSymbol: selectedMarketSymbol,
                side,
                type: "MARKET",
                quoteAmount: marketInput.trim(),
              }
            : {
                marketSymbol: selectedMarketSymbol,
                side,
                type: "MARKET",
                amount: marketInput.trim(),
              }
          : {
              marketSymbol: selectedMarketSymbol,
              side,
              type: "LIMIT",
              price: price.trim(),
              amount: amount.trim(),
            };

      if (previewResponse.type === "MARKET") {
        if (previewResponse.liquidityStatus === "NONE") {
          setError("No available liquidity for this market order.");
          return;
        }

        setPendingConfirmation(
          buildMarketConfirmation(
            previewResponse,
            orderBody as Extract<OrderSubmissionBody, { type: "MARKET" }>,
            baseSymbol,
            quoteSymbol,
          ),
        );
      } else {
        setPendingConfirmation(
          buildLimitConfirmation(
            previewResponse,
            orderBody as Extract<OrderSubmissionBody, { type: "LIMIT" }>,
            baseSymbol,
            quoteSymbol,
          ),
        );
      }

      setPendingOrderBody(orderBody);
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Unable to review order.");
    }
  }

  async function confirmOrder() {
    if (!pendingOrderBody) {
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const order = await apiRequest<OrderEntry>("/orders", {
        method: "POST",
        body: pendingOrderBody,
      });

      setLastExecutionOrder(order);
      if (order.type === "MARKET") {
        setMarketInput("");
        setMarketPreview(null);
        setSuccess("Market order executed and data refreshed.");
      } else {
        setAmount("");
        setPrice("");
        setSuccess("Limit order placed and data refreshed.");
      }
      setPendingConfirmation(null);
      setPendingOrderBody(null);
      await Promise.all([loadTradeData(), loadCandles()]);
    } catch (submitError) {
      const message =
        submitError instanceof ApiError ? submitError.message : "Unable to place order.";
      setError(message === "NO_LIQUIDITY" ? "No available liquidity for this market order." : message);
      setPendingConfirmation(null);
      setPendingOrderBody(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  function applyLimitQuickFill(percent: number) {
    if (!selectedWallet) {
      return;
    }

    if (side === "BUY") {
      const nextAmount = calculateLimitBuyQuickAmount(selectedWallet.available, price, percent);
      if (nextAmount) {
        setAmount(nextAmount);
      }
      return;
    }

    const nextAmount = calculatePercentageFromDisplayValue(selectedWallet.available, percent);
    if (nextAmount) {
      setAmount(nextAmount);
    }
  }

  function applyMarketQuickFill(percent: number) {
    if (!selectedWallet) {
      return;
    }

    const nextValue = calculatePercentageFromDisplayValue(selectedWallet.available, percent);
    if (nextValue) {
      setMarketInput(nextValue);
    }
  }

  function fillLimitPrice(nextPrice: string | null | undefined, source: string) {
    if (!nextPrice) {
      return;
    }

    setOrderType("LIMIT");
    setPrice(nextPrice);
    setSuccess(`Price filled from ${source}.`);
    setError(null);
  }

  async function cancelOrderRequest(orderId: string) {
    return apiRequest<OrderEntry>(`/orders/${orderId}/cancel`, {
      method: "POST",
    });
  }

  async function cancelOrder(orderId: string) {
    setError(null);
    setSuccess(null);

    try {
      setCancellingId(orderId);
      const order = await cancelOrderRequest(orderId);
      setSuccess(`Order ${shortId(order.id)} cancelled.`);
      await Promise.all([loadTradeData(), loadCandles()]);
    } catch (cancelError) {
      setError(cancelError instanceof ApiError ? cancelError.message : "Unable to cancel order.");
    } finally {
      setCancellingId(null);
    }
  }

  async function cancelOpenOrders(scope: BulkCancelScope) {
    const cancellableOrders = myOrders.filter(
      (order) =>
        order.type === "LIMIT" &&
        isOpenOrder(order.status) &&
        BigInt(order.remainingAmountRaw) > 0n &&
        (scope === "ALL" || order.side === scope),
    );

    if (cancellableOrders.length === 0) {
      setSuccess(scope === "ALL" ? "No cancellable open orders for this market." : `No open ${scope.toLowerCase()} orders to cancel.`);
      setError(null);
      return;
    }

    const label =
      scope === "ALL"
        ? "all open limit orders"
        : `open ${scope.toLowerCase()} limit orders`;
    const confirmed = window.confirm(
      `Cancel ${cancellableOrders.length} ${label} on ${selectedMarketSymbol}?`,
    );

    if (!confirmed) {
      return;
    }

    setError(null);
    setSuccess(null);
    setBulkCancellingScope(scope);

    let cancelledCount = 0;
    let failedCount = 0;

    try {
      for (const order of cancellableOrders) {
        try {
          setCancellingId(order.id);
          await cancelOrderRequest(order.id);
          cancelledCount += 1;
        } catch {
          failedCount += 1;
        }
      }

      await Promise.all([loadTradeData(), loadCandles()]);

      if (failedCount > 0) {
        setError(`Cancelled ${cancelledCount} order${cancelledCount === 1 ? "" : "s"}; ${failedCount} failed.`);
      } else {
        setSuccess(`Cancelled ${cancelledCount} ${scope === "ALL" ? "open" : scope.toLowerCase()} order${cancelledCount === 1 ? "" : "s"} on ${selectedMarketSymbol}.`);
      }
    } finally {
      setCancellingId(null);
      setBulkCancellingScope(null);
    }
  }

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-3 xl:flex xl:min-h-full xl:flex-col">
          <TradeTerminalHeader marketStatus={marketStatus} />
          {error ? <Notice tone="danger" message={error} /> : null}
          {success ? <Notice tone="success" message={success} /> : null}
          {marketStatus === "PAUSED" ? <Notice tone="info" message="Market paused by admin." /> : null}
          {isLoading ? <Notice tone="info" message="Loading trade data..." /> : null}
          {lastExecutionOrder ? (
            <ExecutionSummaryPanel
              order={lastExecutionOrder}
              baseSymbol={baseSymbol}
              quoteSymbol={quoteSymbol}
            />
          ) : null}

          <TradeTickerBar
            markets={markets}
            selectedMarketSymbol={selectedMarketSymbol}
            selectedMarket={marketSelectorSelection}
            onSelect={handleMarketChange}
            ticker={ticker}
            baseSymbol={baseSymbol}
            quoteSymbol={quoteSymbol}
          />

          <div className="grid gap-3 xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="grid gap-3 xl:min-h-0 xl:grid-rows-[minmax(0,1fr)_minmax(320px,0.76fr)]">
              <div className="grid gap-3 xl:min-h-0 xl:grid-cols-[minmax(0,1.72fr)_320px]">
                <KlineChart
                  marketSymbol={selectedMarketSymbol}
                  baseSymbol={baseSymbol}
                  quoteSymbol={quoteSymbol}
                  candles={candles}
                  interval={candleInterval}
                  isLoading={isCandlesLoading}
                  error={candleError}
                  chartHeightClassName="h-[400px] xl:h-[470px]"
                  onIntervalChange={(nextInterval) => {
                    setCandleInterval(nextInterval);
                    setCandles([]);
                    setIsCandlesLoading(true);
                    setCandleError(null);
                  }}
                />

                <OrderBookTradesColumn
                  orderBook={orderBook}
                  recentTrades={recentTrades}
                  baseSymbol={baseSymbol}
                  quoteSymbol={quoteSymbol}
                  lastPrice={ticker?.lastPrice ?? null}
                  lastPriceTone={changeTone(ticker?.change24hPercent)}
                  onPriceSelect={fillLimitPrice}
                />
              </div>

              <BottomTerminalPanel
                activeTab={bottomPanelTab}
                onTabChange={setBottomPanelTab}
                openOrders={myOrders}
                orderHistory={orderHistory}
                tradeHistory={myTradeHistory}
                baseWallet={baseWallet}
                quoteWallet={quoteWallet}
                baseSymbol={baseSymbol}
                quoteSymbol={quoteSymbol}
                cancellingId={cancellingId}
                bulkCancellingScope={bulkCancellingScope}
                onCancelOrder={(orderId) => void cancelOrder(orderId)}
                onCancelOpenOrders={(scope) => void cancelOpenOrders(scope)}
              />
            </div>

            <section className="panel rounded-3xl p-3 xl:sticky xl:top-0 xl:self-start">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
                    Execution
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Place order</h2>
                </div>
                <StatusBadge label="Spot" tone="info" />
              </div>

              <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-3">
                <div className="flex items-center gap-3">
                  <AssetPairIcons
                    baseSymbol={baseSymbol}
                    quoteSymbol={quoteSymbol}
                    baseName={baseName}
                    quoteName={quoteName}
                    baseIconUrl={baseIconUrl}
                    quoteIconUrl={quoteIconUrl}
                    size={26}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                      Selected market
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-[var(--foreground)]">
                      {selectedMarketSymbol}
                    </p>
                    <p className="mt-1 text-xs text-[var(--foreground-soft)]">
                      {formatTickerValue(ticker?.lastPrice, quoteSymbol)}
                    </p>
                  </div>
                  <StatusBadge
                    label={marketStatus === "ACTIVE" ? "Live" : marketStatus}
                    tone={marketStatusTone(marketStatus)}
                  />
                </div>
              </div>

              <div className="mt-3 grid gap-2">
                <div className="grid grid-cols-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-1">
                  {(["LIMIT", "MARKET"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setOrderType(option);
                        setSuccess(null);
                        setError(null);
                      }}
                      className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                        orderType === option
                          ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                          : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {option === "LIMIT" ? "Limit" : "Market"}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-1">
                  {(["BUY", "SELL"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSide(option)}
                      className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                        side === option
                          ? option === "BUY"
                            ? "bg-[var(--notice-success-bg)] text-[var(--notice-success-text)]"
                            : "bg-[var(--notice-danger-bg)] text-[var(--notice-danger-text)]"
                          : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="mt-3 grid gap-3">
                {orderType === "LIMIT" ? (
                  <>
                    <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                      Price in {quoteSymbol}
                      <input
                        value={price}
                        onChange={(event) => setPrice(event.target.value)}
                        placeholder="2"
                        inputMode="decimal"
                        className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                      />
                    </label>

                    <PriceQuickFillControls
                      bestBid={ticker?.bestBid ?? null}
                      bestAsk={ticker?.bestAsk ?? null}
                      lastPrice={ticker?.lastPrice ?? null}
                      quoteSymbol={quoteSymbol}
                      onFill={fillLimitPrice}
                    />

                    <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                      Amount in {baseSymbol}
                      <input
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        placeholder="10"
                        inputMode="decimal"
                        className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                      />
                    </label>

                    <QuickFillControls
                      disabled={!selectedWallet}
                      onFill={(pct) => applyLimitQuickFill(pct)}
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <BalanceTile label="Total" value={`${totalPreview ?? "—"} ${quoteSymbol}`} />
                      <BalanceTile
                        label={
                          <AssetBalanceLabel
                            symbol={lockedAssetSymbol}
                            name={selectedWallet?.displayName ?? selectedWallet?.name}
                            iconUrl={selectedWallet?.iconUrl}
                            label="Available"
                          />
                        }
                        value={`${selectedWallet?.available ?? "0"} ${lockedAssetSymbol}`}
                      />
                      <BalanceTile
                        label={
                          <AssetBalanceLabel
                            symbol={lockedAssetSymbol}
                            name={selectedWallet?.displayName ?? selectedWallet?.name}
                            iconUrl={selectedWallet?.iconUrl}
                            label="Locked"
                          />
                        }
                        value={`${selectedWallet?.locked ?? "0"} ${lockedAssetSymbol}`}
                      />
                      <BalanceTile
                        label="Estimated fee"
                        value={
                          selectedWallet && price.trim() && amount.trim() && totalPreview
                            ? "Shown in confirm"
                            : "—"
                        }
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                      {side === "BUY" ? `Spend ${quoteSymbol}` : `Sell ${baseSymbol}`}
                      <input
                        value={marketInput}
                        onChange={(event) => setMarketInput(event.target.value)}
                        placeholder={side === "BUY" ? "100" : "50"}
                        inputMode="decimal"
                        className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                      />
                    </label>

                    <QuickFillControls
                      disabled={!selectedWallet}
                      onFill={(pct) => applyMarketQuickFill(pct)}
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <BalanceTile
                        label={side === "BUY" ? `Est. receive ${baseSymbol}` : `Est. receive ${quoteSymbol}`}
                        value={
                          side === "BUY"
                            ? `${marketPreview?.estimatedReceiveAmount ?? "—"} ${baseSymbol}`
                            : `${marketPreview?.estimatedReceivedQuote ?? "—"} ${quoteSymbol}`
                        }
                      />
                      <BalanceTile
                        label="Est. average"
                        value={`${marketPreview?.estimatedAveragePrice ?? "—"} ${quoteSymbol}`}
                      />
                      <BalanceTile
                        label="Est. fee"
                        value={
                          side === "BUY"
                            ? `${marketPreview?.estimatedBuyerFee ?? "—"} ${baseSymbol}`
                            : `${marketPreview?.estimatedSellerFee ?? "—"} ${quoteSymbol}`
                        }
                      />
                      <BalanceTile
                        label="Est. trade count"
                        value={isPreviewLoading ? "Estimating..." : `${marketPreview?.estimatedTradeCount ?? "—"}`}
                      />
                      <BalanceTile
                        label={
                          <AssetBalanceLabel
                            symbol={lockedAssetSymbol}
                            name={selectedWallet?.displayName ?? selectedWallet?.name}
                            iconUrl={selectedWallet?.iconUrl}
                            label="Available"
                          />
                        }
                        value={`${selectedWallet?.available ?? "0"} ${lockedAssetSymbol}`}
                      />
                      <BalanceTile
                        label="Liquidity"
                        value={isPreviewLoading ? "Estimating..." : marketPreview?.liquidityStatus ?? "—"}
                      />
                    </div>

                    {previewError ? <Notice tone="danger" message={previewError} /> : null}
                    {marketPreview ? (
                      <Notice
                        tone={
                          marketPreview.liquidityStatus === "FULL"
                            ? "success"
                            : marketPreview.liquidityStatus === "PARTIAL"
                              ? "info"
                              : "danger"
                        }
                        message={marketPreviewNotice(marketPreview)}
                      />
                    ) : null}
                  </>
                )}

                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    marketStatus === "PAUSED" ||
                    (orderType === "MARKET" &&
                      (isPreviewLoading ||
                        !marketInput.trim() ||
                        previewError !== null ||
                        marketPreview?.liquidityStatus === "NONE")) ||
                    (orderType === "LIMIT" && (!price.trim() || !amount.trim()))
                  }
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    side === "BUY"
                      ? "bg-[var(--success)] hover:bg-emerald-300"
                      : "bg-[var(--danger)] text-white hover:bg-rose-400"
                  }`}
                >
                  {isSubmitting
                    ? "Submitting..."
                    : marketStatus === "PAUSED"
                      ? "Market paused"
                      : `Review ${orderType.toLowerCase()} order`}
                </button>
              </form>
            </section>
          </div>
        </div>
      </AppShell>
      <OrderConfirmationDialog
        confirmation={pendingConfirmation}
        isSubmitting={isSubmitting}
        onCancel={() => {
          setPendingConfirmation(null);
          setPendingOrderBody(null);
        }}
        onConfirm={() => void confirmOrder()}
      />
    </ProtectedRoute>
  );
}

function BalanceTile({ label, value }: { label: ReactNode; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
        {typeof label === "string" ? label : label}
      </div>
      <p className="mt-1 break-words text-sm font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function AssetBalanceLabel({
  symbol,
  name,
  iconUrl,
  label,
}: {
  symbol: string;
  name?: string | null;
  iconUrl?: string | null;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <AssetIcon symbol={symbol} name={name} iconUrl={iconUrl} size={20} />
      <span>
        {symbol} {label}
      </span>
    </span>
  );
}

function TickerMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-[var(--success)]"
      : tone === "negative"
        ? "text-[var(--danger)]"
        : "text-[var(--foreground)]";

  return (
    <div className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
        {label}
      </p>
      <p className={`mt-1 truncate text-sm font-semibold ${toneClass}`} title={value}>
        {value}
      </p>
    </div>
  );
}

function SideText({ side }: { side: OrderSide }) {
  return (
    <span className={side === "BUY" ? "text-[var(--success)]" : "text-[var(--danger)]"}>{side}</span>
  );
}

function RecentTradesTable({
  trades,
  compact = false,
  onPriceSelect,
}: {
  trades: TradeEntry[];
  compact?: boolean;
  onPriceSelect?: (price: string, source: string) => void;
}) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-[var(--border)] ${compact ? "h-full" : "mt-4"}`}>
      <div className="grid grid-cols-[0.95fr_1fr_1fr_1fr] gap-2 bg-[var(--surface-strong)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--foreground-muted)]">
        <span>Time</span>
        <span>Price</span>
        <span>Amount</span>
        <span className="text-right">Total</span>
      </div>
      <div className={`exchange-scrollbar ${compact ? "h-[220px] overflow-y-auto xl:h-full" : ""}`}>
        {trades.length > 0 ? (
          trades.slice(0, compact ? 18 : 12).map((trade) => (
            <div
              key={trade.id}
              className="grid grid-cols-[0.95fr_1fr_1fr_1fr] gap-2 border-t border-[var(--border)] px-3 py-2 text-sm first:border-t-0"
            >
              <span className="truncate text-[var(--foreground-muted)]">{formatCompactDateTime(trade.createdAt)}</span>
              <button
                type="button"
                onClick={() => onPriceSelect?.(trade.price, "recent trade")}
                className="truncate rounded-md text-left text-[var(--foreground)] transition hover:bg-[var(--surface-hover-strong)] hover:text-[var(--accent-strong)]"
                title="Use this trade price"
              >
                {trade.price}
              </button>
              <span className="truncate text-[var(--foreground-soft)]">{trade.amount}</span>
              <span className="truncate text-right text-[var(--foreground-soft)]">{trade.quoteAmount}</span>
            </div>
          ))
        ) : (
          <div className="px-3 py-6 text-center text-sm text-[var(--foreground-muted)]">
            No trades yet.
          </div>
        )}
      </div>
    </div>
  );
}

function ExecutionSummaryPanel({
  order,
  baseSymbol,
  quoteSymbol,
}: {
  order: OrderEntry;
  baseSymbol: string;
  quoteSymbol: string;
}) {
  const isMarket = order.type === "MARKET";
  const feeText = order.feeSummary
    ? order.side === "BUY"
      ? `${order.feeSummary.buyerFee} ${order.feeSummary.buyerFeeAssetSymbol}`
      : `${order.feeSummary.sellerFee} ${order.feeSummary.sellerFeeAssetSymbol}`
    : "—";

  return (
    <section className="panel rounded-3xl p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
            Execution summary
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">{order.marketSymbol}</h2>
        </div>
        <StatusBadge label={order.status} tone={orderStatusTone(order.status)} />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <BalanceTile label="Side" value={order.side} />
        <BalanceTile label="Type" value={order.type} />
        <BalanceTile
          label={isMarket ? "Average price" : "Limit price"}
          value={isMarket ? maybePrice(order.averagePrice, quoteSymbol) : `${order.price} ${quoteSymbol}`}
        />
        <BalanceTile label="Filled" value={`${order.filledAmount} ${baseSymbol}`} />
        <BalanceTile
          label={isMarket ? "Quote flow" : "Remaining"}
          value={
            isMarket
              ? order.side === "BUY"
                ? `${order.spentQuoteAmount} ${quoteSymbol} spent`
                : `${order.receivedQuoteAmount ?? "0"} ${quoteSymbol} received`
              : `${order.remainingAmount} ${baseSymbol}`
          }
        />
        <BalanceTile label="Fee" value={feeText} />
        <BalanceTile label="Status" value={order.status} />
        <BalanceTile label="Locked" value={`${order.lockedAmount} ${order.lockedAssetSymbol}`} />
      </div>

      {isMarket && order.tradeCount !== undefined ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <BalanceTile label="Trade count" value={String(order.tradeCount)} />
          <BalanceTile
            label="Cancelled remainder"
            value={
              order.side === "BUY"
                ? `${order.cancelledQuoteAmount ?? "0"} ${quoteSymbol}`
                : `${order.cancelledAmount ?? "0"} ${baseSymbol}`
            }
          />
        </div>
      ) : null}

      {order.warning ? <Notice tone="info" message={order.warning} /> : null}
    </section>
  );
}

function QuickFillControls({
  disabled,
  onFill,
}: {
  disabled?: boolean;
  onFill: (percent: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {[25, 50, 75, 100].map((percent) => (
        <button
          key={percent}
          type="button"
          disabled={disabled}
          onClick={() => onFill(percent)}
          className="rounded-full border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground-soft)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {percent}%
        </button>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onFill(100)}
        className="rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Max
      </button>
    </div>
  );
}

function PriceQuickFillControls({
  bestBid,
  bestAsk,
  lastPrice,
  quoteSymbol,
  onFill,
}: {
  bestBid: string | null;
  bestAsk: string | null;
  lastPrice: string | null;
  quoteSymbol: string;
  onFill: (price: string | null | undefined, source: string) => void;
}) {
  const options = [
    { label: "Best Bid", value: bestBid, source: "best bid" },
    { label: "Best Ask", value: bestAsk, source: "best ask" },
    { label: "Last", value: lastPrice, source: "last trade" },
  ];

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-2">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--foreground-muted)]">
        Quick price
      </p>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => (
          <button
            key={option.label}
            type="button"
            disabled={!option.value}
            onClick={() => onFill(option.value, option.source)}
            className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-2 py-2 text-left transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-muted)]">
              {option.label}
            </span>
            <span className="mt-1 block truncate text-xs font-semibold text-[var(--foreground)]" title={formatTickerValue(option.value, quoteSymbol)}>
              {formatTickerValue(option.value, quoteSymbol)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function buildLimitConfirmation(
  preview: LimitOrderPreview,
  orderBody: Extract<OrderSubmissionBody, { type: "LIMIT" }>,
  baseSymbol: string,
  quoteSymbol: string,
): OrderConfirmationView {
  return {
    marketSymbol: preview.marketSymbol,
    side: preview.side,
    type: "LIMIT",
    fields: [
      { label: "Market", value: preview.marketSymbol },
      { label: "Side", value: preview.side },
      { label: "Type", value: "LIMIT" },
      { label: "Price", value: `${orderBody.price} ${quoteSymbol}` },
      { label: "Amount", value: `${orderBody.amount} ${baseSymbol}` },
      { label: "Total", value: `${preview.total} ${quoteSymbol}` },
      { label: "Estimated fee", value: `${preview.estimatedFee} ${preview.estimatedFeeAssetSymbol}` },
      { label: "Immediate match", value: preview.mayMatchImmediately ? "Yes" : "No" },
    ],
    warning: preview.warning,
    helperText: "Review the limit order carefully before it is submitted.",
  };
}

function buildMarketConfirmation(
  preview: MarketOrderPreview,
  orderBody: Extract<OrderSubmissionBody, { type: "MARKET" }>,
  baseSymbol: string,
  quoteSymbol: string,
): OrderConfirmationView {
  const isBuy = preview.side === "BUY";
  return {
    marketSymbol: preview.marketSymbol,
    side: preview.side,
    type: "MARKET",
    liquidityStatus: preview.liquidityStatus,
    fields: [
      { label: "Market", value: preview.marketSymbol },
      { label: "Side", value: preview.side },
      { label: "Type", value: "MARKET" },
      {
        label: isBuy ? "Spend amount" : "Sell amount",
        value: isBuy
          ? `${orderBody.quoteAmount ?? "0"} ${quoteSymbol}`
          : `${orderBody.amount ?? "0"} ${baseSymbol}`,
      },
      { label: "Estimated filled", value: `${preview.estimatedFilledAmount} ${baseSymbol}` },
      {
        label: isBuy ? "Estimated receive" : "Estimated received",
        value: isBuy
          ? `${preview.estimatedReceiveAmount ?? "0"} ${baseSymbol}`
          : `${preview.estimatedReceivedQuote ?? "0"} ${quoteSymbol}`,
      },
      { label: "Estimated average", value: maybePrice(preview.estimatedAveragePrice, quoteSymbol) },
      {
        label: "Estimated fee",
        value: isBuy
          ? `${preview.estimatedBuyerFee} ${preview.estimatedBuyerFeeAssetSymbol}`
          : `${preview.estimatedSellerFee} ${preview.estimatedSellerFeeAssetSymbol}`,
      },
      { label: "Trade count", value: String(preview.estimatedTradeCount) },
      { label: "Liquidity", value: preview.liquidityStatus },
    ],
    warning:
      preview.liquidityStatus === "PARTIAL"
        ? "Available liquidity may not fully fill this order. Any unfilled remainder will be cancelled."
        : null,
    helperText: "Market orders execute immediately against available liquidity.",
  };
}

function marketPreviewNotice(preview: MarketOrderPreview) {
  if (preview.liquidityStatus === "FULL") {
    return `Estimated to fill fully across ${preview.estimatedTradeCount} trade levels.`;
  }

  if (preview.liquidityStatus === "PARTIAL") {
    return "Available liquidity may not fully fill this order. Any unfilled remainder will be cancelled.";
  }

  return "No available liquidity for this market order.";
}

function calculatePercentageFromDisplayValue(value: string, percent: number) {
  const parsed = parseDecimalToUnits(value, MONEY_DECIMALS);
  if (parsed === null) {
    return null;
  }

  const result = (parsed * BigInt(percent)) / 100n;
  return result > 0n ? formatUnits(result, MONEY_DECIMALS) : null;
}

function calculateLimitBuyQuickAmount(availableQuote: string, price: string, percent: number) {
  const quoteUnits = parseDecimalToUnits(availableQuote, MONEY_DECIMALS);
  const priceUnits = parseDecimalToUnits(price, MONEY_DECIMALS);

  if (quoteUnits === null || priceUnits === null || priceUnits <= 0n) {
    return null;
  }

  const spendUnits = (quoteUnits * BigInt(percent)) / 100n;
  const amountUnits = (spendUnits * 10n ** BigInt(MONEY_DECIMALS)) / priceUnits;

  return amountUnits > 0n ? formatUnits(amountUnits, MONEY_DECIMALS) : null;
}

function maybePrice(value: string | null, suffix: string) {
  return value ? `${value} ${suffix}` : "—";
}

function isOpenOrder(status: OrderStatus) {
  return status === "OPEN" || status === "PARTIAL_FILLED";
}

function formatTickerValue(value?: string | null, suffix?: string) {
  if (!value) {
    return "—";
  }

  return suffix ? `${value} ${suffix}` : value;
}

function formatCompactDateTime(value?: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  return `${month}-${day} ${hours}:${minutes}`;
}

function formatPercent(value?: string | null) {
  if (!value) {
    return "—";
  }

  return `${value}%`;
}

function changeTone(value?: string | null): "neutral" | "positive" | "negative" {
  if (!value || value === "0") {
    return "neutral";
  }

  return value.startsWith("-") ? "negative" : "positive";
}

function orderStatusTone(status: OrderStatus): "neutral" | "success" | "warning" | "danger" | "info" {
  if (status === "OPEN" || status === "PARTIAL_FILLED") {
    return "info";
  }

  if (status === "CANCELLED" || status === "PARTIAL_FILLED_CANCELLED") {
    return "warning";
  }

  if (status === "FILLED") {
    return "success";
  }

  if (status === "REJECTED") {
    return "danger";
  }

  return "neutral";
}

function Notice({
  tone,
  message,
}: {
  tone: "success" | "danger" | "info";
  message: string;
}) {
  const classes =
    tone === "danger"
      ? "border-[var(--notice-danger-border)] bg-[var(--notice-danger-bg)] text-[var(--notice-danger-text)]"
      : tone === "success"
        ? "border-[var(--notice-success-border)] bg-[var(--notice-success-bg)] text-[var(--notice-success-text)]"
        : "border-[var(--notice-info-border)] bg-[var(--notice-info-bg)] text-[var(--notice-info-text)]";

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${classes}`}>{message}</div>;
}

function calculateTotalPreview(price: string, amount: string) {
  const priceUnits = parseDecimalToUnits(price, MONEY_DECIMALS);
  const amountUnits = parseDecimalToUnits(amount, MONEY_DECIMALS);

  if (priceUnits === null || amountUnits === null) {
    return null;
  }

  const denominator = 10n ** BigInt(MONEY_DECIMALS);
  const totalUnits = (priceUnits * amountUnits) / denominator;
  const remainder = (priceUnits * amountUnits) % denominator;

  if (totalUnits <= 0n || remainder !== 0n) {
    return null;
  }

  return formatUnits(totalUnits, MONEY_DECIMALS);
}

function parseDecimalToUnits(value: string, decimals: number) {
  const trimmed = value.trim();

  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(trimmed) || /[eE+-]/.test(trimmed)) {
    return null;
  }

  const [whole = "0", fraction = ""] = trimmed.split(".");

  if (fraction.length > decimals) {
    return null;
  }

  const units = BigInt(`${whole}${fraction.padEnd(decimals, "0")}`);
  return units > 0n ? units : null;
}

function formatUnits(value: bigint, decimals: number) {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = (value % base).toString().padStart(decimals, "0").replace(/0+$/, "");

  return fraction ? `${whole.toString()}.${fraction}` : whole.toString();
}

function marketBaseSymbol(marketSymbol: string) {
  return marketSymbol.split("/")[0] || "SWL";
}

function marketQuoteSymbol(marketSymbol: string) {
  return marketSymbol.split("/")[1] || "SWC";
}

function TradeTerminalHeader({ marketStatus }: { marketStatus: string }) {
  return (
    <section className="panel-strong rounded-3xl px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
            Trade
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)] sm:text-2xl">
              Spot terminal
            </h1>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-emphasis)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--foreground-soft)]">
              {CURRENT_MILESTONE_VERSION}
            </span>
            <StatusBadge
              label={marketStatus === "ACTIVE" ? "Markets live" : "Market paused"}
              tone={marketStatusTone(marketStatus)}
            />
          </div>
        </div>
        <p className="max-w-3xl text-sm leading-6 text-[var(--foreground-soft)]">{TRADE_PAGE_COPY}</p>
      </div>
    </section>
  );
}

function TradeTickerBar({
  markets,
  selectedMarketSymbol,
  selectedMarket,
  onSelect,
  ticker,
  baseSymbol,
  quoteSymbol,
}: {
  markets: MarketSummary[];
  selectedMarketSymbol: string;
  selectedMarket: MarketSelectorEntry | null;
  onSelect: (marketSymbol: string) => void;
  ticker: MarketTicker | null;
  baseSymbol: string;
  quoteSymbol: string;
}) {
  return (
    <section className="panel rounded-3xl px-3 py-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="shrink-0">
          <MarketSelector
            markets={markets}
            selectedMarketSymbol={selectedMarketSymbol}
            selectedMarket={selectedMarket}
            onSelect={onSelect}
          />
        </div>
        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
          <TickerMetric
            label="Last Price"
            value={formatTickerValue(ticker?.lastPrice, quoteSymbol)}
          />
          <TickerMetric
            label="24h Change"
            value={formatPercent(ticker?.change24hPercent)}
            tone={changeTone(ticker?.change24hPercent)}
          />
          <TickerMetric label="24h High" value={formatTickerValue(ticker?.high24h, quoteSymbol)} />
          <TickerMetric label="24h Low" value={formatTickerValue(ticker?.low24h, quoteSymbol)} />
          <TickerMetric label="24h Volume" value={formatTickerValue(ticker?.volume24h, baseSymbol)} />
          <TickerMetric
            label="Quote Volume"
            value={formatTickerValue(ticker?.quoteVolume24h, quoteSymbol)}
          />
          <TickerMetric label="Best Bid" value={formatTickerValue(ticker?.bestBid, quoteSymbol)} />
          <TickerMetric label="Best Ask" value={formatTickerValue(ticker?.bestAsk, quoteSymbol)} />
        </div>
      </div>
    </section>
  );
}

function OrderBookTradesColumn({
  orderBook,
  recentTrades,
  baseSymbol,
  quoteSymbol,
  lastPrice,
  lastPriceTone,
  onPriceSelect,
}: {
  orderBook: OrderBook | null;
  recentTrades: TradeEntry[];
  baseSymbol: string;
  quoteSymbol: string;
  lastPrice: string | null;
  lastPriceTone: "neutral" | "positive" | "negative";
  onPriceSelect: (price: string, source: string) => void;
}) {
  return (
    <section className="panel flex min-h-0 flex-col rounded-3xl p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
            Market depth
          </p>
          <h2 className="mt-1 text-base font-semibold text-[var(--foreground)]">Order book</h2>
        </div>
        <StatusBadge label="Live tape" tone="info" />
      </div>

      <div className="mt-3 grid min-h-0 flex-1 gap-3 xl:grid-rows-[minmax(0,1.2fr)_minmax(0,0.88fr)]">
        <div className="min-h-0 rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-2">
          <div className="grid grid-cols-[1fr_1fr_64px] gap-2 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--foreground-muted)]">
            <span>Price {quoteSymbol}</span>
            <span>Amount {baseSymbol}</span>
            <span className="text-right">Orders</span>
          </div>

          <div className="mt-1 grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2">
            <CompactOrderBookList
              side="SELL"
              levels={orderBook?.asks ?? []}
              onPriceSelect={onPriceSelect}
            />
            <div className="rounded-xl border border-[var(--border)] bg-[var(--chart-header)] px-3 py-2 text-center">
              <p className={`text-sm font-semibold ${toneClassForChange(lastPriceTone)}`}>
                {formatTickerValue(lastPrice, quoteSymbol)}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--foreground-muted)]">
                Last price
              </p>
            </div>
            <CompactOrderBookList
              side="BUY"
              levels={orderBook?.bids ?? []}
              onPriceSelect={onPriceSelect}
            />
          </div>
        </div>

        <div className="min-h-0 rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-2">
          <div className="flex items-center justify-between gap-3 px-1 pb-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--foreground-muted)]">
                Recent trades
              </p>
              <p className="mt-1 text-xs text-[var(--foreground-soft)]">Market tape near execution.</p>
            </div>
          </div>
          <RecentTradesTable trades={recentTrades} compact onPriceSelect={onPriceSelect} />
        </div>
      </div>
    </section>
  );
}

function BottomTerminalPanel({
  activeTab,
  onTabChange,
  openOrders,
  orderHistory,
  tradeHistory,
  baseWallet,
  quoteWallet,
  baseSymbol,
  quoteSymbol,
  cancellingId,
  bulkCancellingScope,
  onCancelOrder,
  onCancelOpenOrders,
}: {
  activeTab: BottomPanelTab;
  onTabChange: (tab: BottomPanelTab) => void;
  openOrders: OrderEntry[];
  orderHistory: OrderEntry[];
  tradeHistory: TradeEntry[];
  baseWallet: WalletBalance | null;
  quoteWallet: WalletBalance | null;
  baseSymbol: string;
  quoteSymbol: string;
  cancellingId: string | null;
  bulkCancellingScope: BulkCancelScope | null;
  onCancelOrder: (orderId: string) => void;
  onCancelOpenOrders: (scope: BulkCancelScope) => void;
}) {
  return (
    <section className="panel flex min-h-0 flex-col rounded-3xl p-3">
      <div className="flex flex-col gap-3 border-b border-[var(--border)] pb-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2 overflow-x-auto exchange-scrollbar">
          {([
            ["OPEN_ORDERS", "Open Orders"],
            ["ORDER_HISTORY", "Order History"],
            ["TRADE_HISTORY", "Trade History"],
            ["ASSETS", "Assets"],
          ] as const).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => onTabChange(tab)}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                activeTab === tab
                  ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                  : "bg-[var(--surface-strong)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--foreground-soft)]">
          Activity stays docked below the chart to keep execution tools visible.
        </p>
      </div>

      <div className="min-h-0 flex-1 pt-3">
        {activeTab === "OPEN_ORDERS" ? (
          <OrdersActivityTable
            variant="open"
            orders={openOrders}
            quoteSymbol={quoteSymbol}
            baseSymbol={baseSymbol}
            cancellingId={cancellingId}
            bulkCancellingScope={bulkCancellingScope}
            onCancelOrder={onCancelOrder}
            onCancelOpenOrders={onCancelOpenOrders}
          />
        ) : null}
        {activeTab === "ORDER_HISTORY" ? (
          <OrdersActivityTable
            variant="history"
            orders={orderHistory}
            quoteSymbol={quoteSymbol}
            baseSymbol={baseSymbol}
            cancellingId={cancellingId}
            onCancelOrder={onCancelOrder}
          />
        ) : null}
        {activeTab === "TRADE_HISTORY" ? (
          <TradeHistoryTable trades={tradeHistory} />
        ) : null}
        {activeTab === "ASSETS" ? (
          <TradeAssetsPanel
            baseWallet={baseWallet}
            quoteWallet={quoteWallet}
            baseSymbol={baseSymbol}
            quoteSymbol={quoteSymbol}
          />
        ) : null}
      </div>
    </section>
  );
}

function CompactOrderBookList({
  side,
  levels,
  onPriceSelect,
}: {
  side: OrderSide;
  levels: OrderBookLevel[];
  onPriceSelect: (price: string, source: string) => void;
}) {
  return (
    <div className="exchange-scrollbar min-h-0 overflow-y-auto">
      {levels.length > 0 ? (
        levels.map((level) => (
          <button
            key={`${side}-${level.priceRaw}`}
            type="button"
            onClick={() => onPriceSelect(level.price, side === "BUY" ? "best bid row" : "best ask row")}
            className="grid w-full grid-cols-[1fr_1fr_64px] gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] transition hover:bg-[var(--surface-hover-strong)]"
            title={`Use ${level.price} as limit price`}
          >
            <span className={side === "BUY" ? "text-[var(--success)]" : "text-[var(--danger)]"}>
              {level.price}
            </span>
            <span className="truncate text-[var(--foreground-soft)]">{level.amount}</span>
            <span className="text-right text-[var(--foreground-muted)]">{level.orderCount}</span>
          </button>
        ))
      ) : (
        <div className="px-2 py-6 text-center text-sm text-[var(--foreground-muted)]">No depth yet.</div>
      )}
    </div>
  );
}

function OrdersActivityTable({
  variant,
  orders,
  quoteSymbol,
  baseSymbol,
  cancellingId,
  bulkCancellingScope,
  onCancelOrder,
  onCancelOpenOrders,
}: {
  variant: "open" | "history";
  orders: OrderEntry[];
  quoteSymbol: string;
  baseSymbol: string;
  cancellingId: string | null;
  bulkCancellingScope?: BulkCancelScope | null;
  onCancelOrder: (orderId: string) => void;
  onCancelOpenOrders?: (scope: BulkCancelScope) => void;
}) {
  const cancellableOrders = orders.filter(
    (order) =>
      variant === "open" &&
      order.type === "LIMIT" &&
      isOpenOrder(order.status) &&
      BigInt(order.remainingAmountRaw) > 0n,
  );
  const cancellableBuyCount = cancellableOrders.filter((order) => order.side === "BUY").length;
  const cancellableSellCount = cancellableOrders.filter((order) => order.side === "SELL").length;

  if (orders.length === 0) {
    return (
      <EmptyTerminalState
        message={variant === "open" ? "No open orders." : "No order history for this market yet."}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {variant === "open" && cancellableOrders.length > 0 && onCancelOpenOrders ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
          <p className="text-xs text-[var(--foreground-soft)]">
            {cancellableOrders.length} cancellable limit order{cancellableOrders.length === 1 ? "" : "s"} on this market.
          </p>
          <div className="flex flex-wrap gap-2">
            <BulkCancelButton
              label="Cancel All"
              count={cancellableOrders.length}
              scope="ALL"
              activeScope={bulkCancellingScope ?? null}
              onCancel={onCancelOpenOrders}
            />
            <BulkCancelButton
              label="Cancel Buy"
              count={cancellableBuyCount}
              scope="BUY"
              activeScope={bulkCancellingScope ?? null}
              onCancel={onCancelOpenOrders}
            />
            <BulkCancelButton
              label="Cancel Sell"
              count={cancellableSellCount}
              scope="SELL"
              activeScope={bulkCancellingScope ?? null}
              onCancel={onCancelOpenOrders}
            />
          </div>
        </div>
      ) : null}

      <div className="exchange-scrollbar min-h-0 flex-1 overflow-y-auto rounded-2xl border border-[var(--border)]">
        <div className="grid gap-2">
          {orders.map((order) => {
            const canCancel =
              variant === "open" &&
              order.type === "LIMIT" &&
              isOpenOrder(order.status) &&
              BigInt(order.remainingAmountRaw) > 0n;

            const priceLabel =
              order.type === "MARKET"
                ? maybePrice(order.averagePrice, quoteSymbol)
                : `${order.price} ${quoteSymbol}`;
            const quoteLabel =
              order.type === "MARKET"
                ? order.side === "BUY"
                  ? `${order.spentQuoteAmount} ${quoteSymbol}`
                  : `${order.receivedQuoteAmount ?? "0"} ${quoteSymbol}`
                : formatMaybeQuotedValue(calculateOrderHistoryQuote(order), quoteSymbol);

            return (
              <article
                key={order.id}
                className="grid gap-3 border-t border-[var(--border)] bg-[var(--surface-faint)] px-3 py-3 first:border-t-0 xl:grid-cols-[minmax(100px,0.8fr)_72px_70px_minmax(100px,0.8fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(110px,0.8fr)_auto] xl:items-center"
              >
                <OrderMiniMetric label="Time" value={formatCompactDateTime(order.createdAt)} />
                <OrderMiniMetric label="Type" value={order.type} strong />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--foreground-muted)] xl:hidden">Side</p>
                  <p className="mt-1 text-sm font-semibold xl:mt-0"><SideText side={order.side} /></p>
                </div>
                <OrderMiniMetric label="Price" value={priceLabel} strong />
                <OrderMiniMetric label="Amount" value={`${order.amount} ${baseSymbol}`} />
                <OrderMiniMetric label="Filled / Rem." value={`${order.filledAmount} / ${order.remainingAmount} ${baseSymbol}`} />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--foreground-muted)] xl:hidden">Status</p>
                  <div className="mt-1 xl:mt-0"><StatusBadge label={order.status} tone={orderStatusTone(order.status)} /></div>
                  <p className="mt-1 truncate text-xs text-[var(--foreground-muted)]" title={quoteLabel}>{quoteLabel}</p>
                </div>
                <div className="text-sm text-[var(--foreground-soft)] xl:text-right">
                  {canCancel ? (
                    <button
                      type="button"
                      onClick={() => onCancelOrder(order.id)}
                      disabled={cancellingId === order.id}
                      className="rounded-xl border border-[var(--notice-danger-border)] bg-[var(--notice-danger-bg)] px-3 py-1.5 text-xs font-medium text-[var(--notice-danger-text)] transition hover:border-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {cancellingId === order.id ? "Cancelling..." : "Cancel"}
                    </button>
                  ) : (
                    <span className="text-[var(--foreground-muted)]">
                      {order.type === "MARKET" ? "Executed" : "Closed"}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BulkCancelButton({
  label,
  count,
  scope,
  activeScope,
  onCancel,
}: {
  label: string;
  count: number;
  scope: BulkCancelScope;
  activeScope: BulkCancelScope | null;
  onCancel: (scope: BulkCancelScope) => void;
}) {
  return (
    <button
      type="button"
      disabled={count === 0 || activeScope !== null}
      onClick={() => onCancel(scope)}
      className="rounded-xl border border-[var(--notice-danger-border)] bg-[var(--notice-danger-bg)] px-3 py-1.5 text-xs font-medium text-[var(--notice-danger-text)] transition hover:border-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {activeScope === scope ? "Cancelling..." : `${label} (${count})`}
    </button>
  );
}

function OrderMiniMetric({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--foreground-muted)] xl:hidden">{label}</p>
      <p
        className={`mt-1 truncate text-sm xl:mt-0 ${strong ? "font-semibold text-[var(--foreground)]" : "text-[var(--foreground-soft)]"}`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function TradeHistoryTable({ trades }: { trades: TradeEntry[] }) {
  if (trades.length === 0) {
    return <EmptyTerminalState message="No user trades for this market yet." />;
  }

  return (
    <div className="exchange-scrollbar h-full overflow-y-auto rounded-2xl border border-[var(--border)]">
      <table className="w-full table-fixed border-collapse text-left">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--surface-strong)]">
            {["Time", "Side", "Price", "Amount", "Total", "Buyer Fee", "Seller Fee"].map((column) => (
              <th
                key={column}
                className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--foreground-muted)]"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr key={trade.id} className="border-t border-[var(--border)] first:border-t-0">
              <td className="px-3 py-2 text-sm text-[var(--foreground-soft)]">
                <span className="block truncate">{formatCompactDateTime(trade.createdAt)}</span>
              </td>
              <td className="px-3 py-2 text-sm">
                {trade.side ? <SideText side={trade.side} /> : <span className="text-[var(--foreground)]">—</span>}
              </td>
              <td className="px-3 py-2 text-sm text-[var(--foreground)]"><span className="block truncate">{trade.price}</span></td>
              <td className="px-3 py-2 text-sm text-[var(--foreground-soft)]"><span className="block truncate">{trade.amount}</span></td>
              <td className="px-3 py-2 text-sm text-[var(--foreground-soft)]"><span className="block truncate">{trade.quoteAmount}</span></td>
              <td className="px-3 py-2 text-sm text-[var(--foreground-soft)]">
                <span className="block truncate">{trade.buyerFee} {trade.buyerFeeAssetSymbol}</span>
              </td>
              <td className="px-3 py-2 text-sm text-[var(--foreground-soft)]">
                <span className="block truncate">{trade.sellerFee} {trade.sellerFeeAssetSymbol}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TradeAssetsPanel({
  baseWallet,
  quoteWallet,
  baseSymbol,
  quoteSymbol,
}: {
  baseWallet: WalletBalance | null;
  quoteWallet: WalletBalance | null;
  baseSymbol: string;
  quoteSymbol: string;
}) {
  return (
    <div className="grid h-full gap-3 lg:grid-cols-2">
      <AssetBalanceCard wallet={baseWallet} symbol={baseSymbol} />
      <AssetBalanceCard wallet={quoteWallet} symbol={quoteSymbol} />
    </div>
  );
}

function AssetBalanceCard({
  wallet,
  symbol,
}: {
  wallet: WalletBalance | null;
  symbol: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4">
      <div className="flex items-center gap-3">
        <AssetIcon
          symbol={symbol}
          name={wallet?.displayName ?? wallet?.name ?? symbol}
          iconUrl={wallet?.iconUrl}
          size={28}
        />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
            Asset balance
          </p>
          <h3 className="mt-1 text-base font-semibold text-[var(--foreground)]">{symbol}</h3>
        </div>
      </div>
      <div className="mt-4 grid gap-2">
        <BalanceTile label="Available" value={`${wallet?.available ?? "0"} ${symbol}`} />
        <BalanceTile label="Locked" value={`${wallet?.locked ?? "0"} ${symbol}`} />
        <BalanceTile label="Total" value={`${wallet?.total ?? "0"} ${symbol}`} />
      </div>
    </div>
  );
}

function EmptyTerminalState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] px-4 text-center text-sm text-[var(--foreground-muted)]">
      {message}
    </div>
  );
}

function calculateOrderHistoryQuote(order: OrderEntry) {
  if (order.spentQuoteAmount && order.spentQuoteAmount !== "0") {
    return order.spentQuoteAmount;
  }

  if (order.receivedQuoteAmount && order.receivedQuoteAmount !== "0") {
    return order.receivedQuoteAmount;
  }

  return "—";
}

function formatMaybeQuotedValue(value: string, symbol: string) {
  return value === "—" ? value : `${value} ${symbol}`;
}

function marketStatusTone(status: string): "success" | "warning" {
  return status === "ACTIVE" ? "success" : "warning";
}

function toneClassForChange(tone: "neutral" | "positive" | "negative") {
  if (tone === "positive") {
    return "text-[var(--success)]";
  }

  if (tone === "negative") {
    return "text-[var(--danger)]";
  }

  return "text-[var(--foreground)]";
}
