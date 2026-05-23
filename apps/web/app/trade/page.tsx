"use client";

import type { ReactNode } from "react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { MarketSelector } from "@/components/trade/market-selector";
import { OrderConfirmationDialog, type OrderConfirmationView } from "@/components/trade/order-confirmation-dialog";
import { KlineChart } from "@/components/trade/kline-chart";
import { AssetIcon } from "@/components/ui/asset-icon";
import { DataTable } from "@/components/ui/data-table";
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
import { formatDateTime, shortId } from "@/lib/format";
import { TRADE_PAGE_COPY } from "@/lib/milestone-copy";

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
  const [recentTrades, setRecentTrades] = useState<TradeEntry[]>([]);
  const [candles, setCandles] = useState<MarketCandle[]>([]);
  const [candleInterval, setCandleInterval] = useState<CandleInterval>("1m");
  const [isCandlesLoading, setIsCandlesLoading] = useState(true);
  const [candleError, setCandleError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastExecutionOrder, setLastExecutionOrder] = useState<OrderEntry | null>(null);

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
  const selectedWallet = wallets.find((wallet) => wallet.asset === lockedAssetSymbol);
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
      const [bookResponse, ordersResponse, walletResponse, tradesResponse, summaryResponse, tickerResponse] =
        await Promise.all([
          apiRequest<OrderBook>(`/order-book?marketSymbol=${marketQuery}`),
          apiRequest<OrderEntry[]>(`/orders/me?marketSymbol=${marketQuery}`),
          apiRequest<WalletBalance[]>("/wallets/me"),
          apiRequest<TradeEntry[]>(`/trades/recent?marketSymbol=${marketQuery}`),
          apiRequest<MarketSummary[]>("/markets/summary"),
          apiRequest<MarketTicker>(`/markets/ticker?marketSymbol=${marketQuery}`),
        ]);

      setOrderBook(bookResponse);
      setTicker(tickerResponse);
      setMarkets(summaryResponse);
      setMyOrders(
        ordersResponse.filter(
          (order) => isOpenOrder(order.status) && BigInt(order.remainingAmountRaw) > 0n,
        ),
      );
      setWallets(walletResponse);
      setRecentTrades(tradesResponse);
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
    setRecentTrades([]);
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

  async function cancelOrder(orderId: string) {
    setError(null);
    setSuccess(null);

    try {
      setCancellingId(orderId);
      const order = await apiRequest<OrderEntry>(`/orders/${orderId}/cancel`, {
        method: "POST",
      });
      setSuccess(`Order ${shortId(order.id)} cancelled.`);
      await Promise.all([loadTradeData(), loadCandles()]);
    } catch (cancelError) {
      setError(cancelError instanceof ApiError ? cancelError.message : "Unable to cancel order.");
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Trade"
            title="Spot terminal"
            description={TRADE_PAGE_COPY}
            action={
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <StatusBadge label="v0.16 Live" tone="success" />
                <MarketSelector
                  markets={markets}
                  selectedMarketSymbol={selectedMarketSymbol}
                  selectedMarket={marketSelectorSelection}
                  onSelect={handleMarketChange}
                />
              </div>
            }
          />

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

          <section className="panel rounded-3xl p-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <TickerMetric
                label="Last Price"
                value={formatTickerValue(ticker?.lastPrice, quoteSymbol)}
              />
              <TickerMetric
                label="24h Change"
                value={formatPercent(ticker?.change24hPercent)}
                tone={changeTone(ticker?.change24hPercent)}
              />
              <TickerMetric
                label="24h High"
                value={formatTickerValue(ticker?.high24h, quoteSymbol)}
              />
              <TickerMetric label="24h Low" value={formatTickerValue(ticker?.low24h, quoteSymbol)} />
              <TickerMetric
                label="24h Volume"
                value={formatTickerValue(ticker?.volume24h, baseSymbol)}
              />
              <TickerMetric label="Best Bid" value={formatTickerValue(ticker?.bestBid, quoteSymbol)} />
              <TickerMetric label="Best Ask" value={formatTickerValue(ticker?.bestAsk, quoteSymbol)} />
              <TickerMetric label="Status" value={marketStatus} />
            </div>
          </section>

          <KlineChart
            marketSymbol={selectedMarketSymbol}
            baseSymbol={baseSymbol}
            quoteSymbol={quoteSymbol}
            candles={candles}
            interval={candleInterval}
            isLoading={isCandlesLoading}
            error={candleError}
            onIntervalChange={(nextInterval) => {
              setCandleInterval(nextInterval);
              setCandles([]);
              setIsCandlesLoading(true);
              setCandleError(null);
            }}
          />

          <div className="grid gap-4 xl:grid-cols-[0.9fr_1fr_0.85fr]">
            <section className="panel rounded-3xl p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex -space-x-2">
                    <AssetIcon symbol={baseSymbol} name={baseName} iconUrl={baseIconUrl} size={28} />
                    <AssetIcon symbol={quoteSymbol} name={quoteName} iconUrl={quoteIconUrl} size={28} />
                  </span>
                  <span>
                    <p className="text-xs uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                      Market
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-white">{selectedMarketSymbol}</h2>
                  </span>
                </div>
                <StatusBadge label="Spot" tone="info" />
              </div>

              <div className="mt-5 grid gap-5">
                <OrderBookTable
                  title="Asks"
                  side="SELL"
                  levels={orderBook?.asks ?? []}
                  baseSymbol={baseSymbol}
                />
                <div className="rounded-2xl border border-[var(--border)] bg-white/[0.03] px-4 py-3 text-center text-sm font-semibold text-white">
                  {quoteSymbol} per {baseSymbol}
                </div>
                <OrderBookTable
                  title="Bids"
                  side="BUY"
                  levels={orderBook?.bids ?? []}
                  baseSymbol={baseSymbol}
                />
              </div>
            </section>

            <section className="panel rounded-3xl p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="grid grid-cols-2 rounded-2xl border border-[var(--border)] bg-white/[0.03] p-1">
                  {(["LIMIT", "MARKET"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setOrderType(option);
                        setSuccess(null);
                        setError(null);
                      }}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                        orderType === option
                          ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                          : "text-[var(--foreground-muted)] hover:text-white"
                      }`}
                    >
                      {option === "LIMIT" ? "Limit" : "Market"}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 rounded-2xl border border-[var(--border)] bg-white/[0.03] p-1">
                  {(["BUY", "SELL"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSide(option)}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                        side === option
                          ? option === "BUY"
                            ? "bg-emerald-400/14 text-emerald-200"
                            : "bg-rose-400/14 text-rose-200"
                          : "text-[var(--foreground-muted)] hover:text-white"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
                {orderType === "LIMIT" ? (
                  <>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                        Price in {quoteSymbol}
                        <input
                          value={price}
                          onChange={(event) => setPrice(event.target.value)}
                          placeholder="2"
                          inputMode="decimal"
                          className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
                        />
                      </label>
                      <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                        Amount in {baseSymbol}
                        <input
                          value={amount}
                          onChange={(event) => setAmount(event.target.value)}
                          placeholder="10"
                          inputMode="decimal"
                          className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
                        />
                      </label>
                    </div>

                    <QuickFillControls
                      disabled={!selectedWallet}
                      onFill={(pct) => applyLimitQuickFill(pct)}
                    />

                    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
                      <BalanceTile label="Total" value={`${totalPreview ?? "-"} ${quoteSymbol}`} />
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
                            ? "Shown in confirm step"
                            : "-"
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
                          className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
                        />
                    </label>

                    <QuickFillControls
                      disabled={!selectedWallet}
                      onFill={(pct) => applyMarketQuickFill(pct)}
                    />

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <BalanceTile
                        label={side === "BUY" ? `Est. receive ${baseSymbol}` : `Est. receive ${quoteSymbol}`}
                        value={
                          side === "BUY"
                            ? `${marketPreview?.estimatedReceiveAmount ?? "-"} ${baseSymbol}`
                            : `${marketPreview?.estimatedReceivedQuote ?? "-"} ${quoteSymbol}`
                        }
                      />
                      <BalanceTile
                        label="Est. average"
                        value={`${marketPreview?.estimatedAveragePrice ?? "-"} ${quoteSymbol}`}
                      />
                      <BalanceTile
                        label="Est. fee"
                        value={
                          side === "BUY"
                            ? `${marketPreview?.estimatedBuyerFee ?? "-"} ${baseSymbol}`
                            : `${marketPreview?.estimatedSellerFee ?? "-"} ${quoteSymbol}`
                        }
                      />
                      <BalanceTile
                        label="Est. trade count"
                        value={isPreviewLoading ? "Estimating..." : `${marketPreview?.estimatedTradeCount ?? "-"}`}
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
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
                        value={
                          isPreviewLoading
                            ? "Estimating..."
                            : marketPreview?.liquidityStatus ?? "-"
                        }
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

            <section className="panel rounded-3xl p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Recent Trades</h2>
                <StatusBadge label="Polling Sync" tone="info" />
              </div>
              <RecentTradesTable trades={recentTrades} />
            </section>
          </div>

          {myOrders.length > 0 ? (
            <DataTable
              columns={["Time", "Market", "Side", "Price", "Amount", "Filled", "Remaining", "Status", "Action"]}
              rows={myOrders.map((order) => [
                formatDateTime(order.createdAt),
                order.marketSymbol,
                <SideText key={`${order.id}-side`} side={order.side} />,
                order.price,
                order.amount,
                order.filledAmount,
                order.remainingAmount,
                <StatusBadge
                  key={`${order.id}-status`}
                  label={order.status}
                  tone={orderStatusTone(order.status)}
                />,
                order.type === "LIMIT" && isOpenOrder(order.status) && BigInt(order.remainingAmountRaw) > 0n ? (
                  <button
                    key={`${order.id}-cancel`}
                    type="button"
                    onClick={() => void cancelOrder(order.id)}
                    disabled={cancellingId === order.id}
                    className="rounded-xl border border-rose-300/30 bg-rose-300/10 px-3 py-1.5 text-xs font-medium text-rose-200 transition hover:border-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {cancellingId === order.id ? "Cancelling..." : "Cancel"}
                  </button>
                ) : (
                  "-"
                ),
              ])}
            />
          ) : !isLoading ? (
            <Notice tone="info" message="No open orders." />
          ) : null}
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

function OrderBookTable({
  title,
  side,
  levels,
  baseSymbol,
}: {
  title: string;
  side: OrderSide;
  levels: OrderBookLevel[];
  baseSymbol: string;
}) {
  const toneClass = side === "BUY" ? "text-emerald-300" : "text-rose-300";

  return (
    <div>
      <div className="grid grid-cols-[1fr_1fr_80px] gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--foreground-muted)]">
        <span>{title}</span>
        <span>Amount {baseSymbol}</span>
        <span className="text-right">Orders</span>
      </div>
      <div className="data-divider mt-2 overflow-hidden rounded-2xl border border-[var(--border)]">
        {levels.length > 0 ? (
          levels.map((level) => (
            <div
              key={`${side}-${level.priceRaw}`}
              className="grid grid-cols-[1fr_1fr_80px] gap-2 bg-white/[0.02] px-3 py-2 text-sm"
            >
              <span className={toneClass}>{level.price}</span>
              <span className="text-[var(--foreground-soft)]">{level.amount}</span>
              <span className="text-right text-[var(--foreground-muted)]">{level.orderCount}</span>
            </div>
          ))
        ) : (
          <div className="px-3 py-4 text-sm text-[var(--foreground-muted)]">Empty</div>
        )}
      </div>
    </div>
  );
}

function BalanceTile({ label, value }: { label: ReactNode; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white/[0.03] px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
        {typeof label === "string" ? label : label}
      </div>
      <p className="mt-1 break-words text-sm font-semibold text-white">{value}</p>
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
      ? "text-emerald-300"
      : tone === "negative"
        ? "text-rose-300"
        : "text-white";

  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
        {label}
      </p>
      <p className={`mt-1 break-words text-sm font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function SideText({ side }: { side: OrderSide }) {
  return (
    <span className={side === "BUY" ? "text-emerald-300" : "text-rose-300"}>{side}</span>
  );
}

function RecentTradesTable({ trades }: { trades: TradeEntry[] }) {
  return (
    <div className="data-divider mt-5 overflow-hidden rounded-2xl border border-[var(--border)]">
      <div className="grid grid-cols-[1.1fr_1fr_1fr_1fr] gap-2 bg-white/[0.03] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
        <span>Time</span>
        <span>Price</span>
        <span>Amount</span>
        <span className="text-right">Total</span>
      </div>
      {trades.length > 0 ? (
        trades.slice(0, 12).map((trade) => (
          <div
            key={trade.id}
            className="grid grid-cols-[1.1fr_1fr_1fr_1fr] gap-2 px-3 py-2 text-sm"
          >
            <span className="text-[var(--foreground-muted)]">{formatDateTime(trade.createdAt)}</span>
            <span className="text-white">{trade.price}</span>
            <span className="text-[var(--foreground-soft)]">{trade.amount}</span>
            <span className="text-right text-[var(--foreground-soft)]">{trade.quoteAmount}</span>
          </div>
        ))
      ) : (
        <div className="px-3 py-6 text-center text-sm text-[var(--foreground-muted)]">
          No trades yet.
        </div>
      )}
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
          <h2 className="mt-1 text-lg font-semibold text-white">{order.marketSymbol}</h2>
        </div>
        <StatusBadge label={order.status} tone={orderStatusTone(order.status)} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
          className="rounded-full border border-[var(--border)] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-[var(--foreground-soft)] transition hover:border-[var(--accent)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
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
      ? "border-rose-300/20 bg-rose-300/10 text-rose-100"
      : tone === "success"
        ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
        : "border-blue-300/20 bg-blue-300/10 text-blue-100";

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
