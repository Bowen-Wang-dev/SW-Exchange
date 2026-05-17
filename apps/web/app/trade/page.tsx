"use client";

import type { ReactNode } from "react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { AssetIcon } from "@/components/ui/asset-icon";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest, ApiError } from "@/lib/api-client";
import type {
  OrderBook,
  OrderBookLevel,
  MarketSummary,
  MarketTicker,
  OrderEntry,
  OrderSide,
  OrderStatus,
  TradeEntry,
  WalletBalance,
} from "@/lib/api-types";
import { formatDateTime, shortId } from "@/lib/format";
import { TRADE_PAGE_COPY } from "@/lib/milestone-copy";

const DEFAULT_MARKET_SYMBOL = "SWL/SWC";
const MONEY_DECIMALS = 18;
const POLL_INTERVAL_MS = 5000;

export default function TradePage() {
  const [selectedMarketSymbol, setSelectedMarketSymbol] = useState(DEFAULT_MARKET_SYMBOL);
  const [side, setSide] = useState<OrderSide>("BUY");
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [wallets, setWallets] = useState<WalletBalance[]>([]);
  const [markets, setMarkets] = useState<MarketSummary[]>([]);
  const [ticker, setTicker] = useState<MarketTicker | null>(null);
  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  const [myOrders, setMyOrders] = useState<OrderEntry[]>([]);
  const [recentTrades, setRecentTrades] = useState<TradeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  useEffect(() => {
    void loadTradeData();
    const intervalId = window.setInterval(() => {
      void loadTradeData({ silent: true });
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [selectedMarketSymbol]);

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

  function handleMarketChange(nextMarketSymbol: string) {
    setSelectedMarketSymbol(nextMarketSymbol);
    setTicker(null);
    setOrderBook(null);
    setMyOrders([]);
    setRecentTrades([]);
    setAmount("");
    setSuccess(null);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      setIsSubmitting(true);
      const order = await apiRequest<OrderEntry>("/orders", {
        method: "POST",
        body: {
          marketSymbol: selectedMarketSymbol,
          side,
          price: price.trim(),
          amount: amount.trim(),
        },
      });

      setAmount("");
      setSuccess(
        `${order.side} order ${shortId(order.id)} is ${order.status}. Filled ${order.filledAmount} ${baseSymbol}, remaining ${order.remainingAmount} ${baseSymbol}. Locked ${order.lockedAmount} ${order.lockedAssetSymbol}.`,
      );
      await loadTradeData();
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Unable to place order.");
    } finally {
      setIsSubmitting(false);
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
      await loadTradeData();
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
            title={
              <span className="inline-flex items-center gap-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                <span className="flex -space-x-2">
                  <AssetIcon symbol={baseSymbol} name={baseName} iconUrl={baseIconUrl} size={34} />
                  <AssetIcon symbol={quoteSymbol} name={quoteName} iconUrl={quoteIconUrl} size={34} />
                </span>
                <span>{selectedMarketSymbol} spot terminal</span>
              </span>
            }
            description={TRADE_PAGE_COPY}
            action={<StatusBadge label="v0.13 Live" tone="success" />}
          />

          {error ? <Notice tone="danger" message={error} /> : null}
          {success ? <Notice tone="success" message={success} /> : null}
          {marketStatus === "PAUSED" ? <Notice tone="info" message="Market paused by admin." /> : null}
          {isLoading ? <Notice tone="info" message="Loading trade data..." /> : null}

          <section className="panel rounded-3xl p-5">
            <div className="grid gap-4 md:grid-cols-[minmax(180px,1.2fr)_repeat(4,minmax(0,1fr))] xl:grid-cols-[minmax(200px,1.25fr)_repeat(8,minmax(0,1fr))]">
              <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                Market
                <select
                  value={selectedMarketSymbol}
                  onChange={(event) => handleMarketChange(event.target.value)}
                  className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-[var(--accent)]"
                >
                  {buildMarketOptions(markets, selectedMarketSymbol).map((market) => (
                    <option key={market} value={market}>
                      {market}
                    </option>
                  ))}
                </select>
              </label>
              <TickerMetric label="Last Price" value={formatTickerValue(ticker?.lastPrice, quoteSymbol)} />
              <TickerMetric
                label="24h Change"
                value={formatPercent(ticker?.change24hPercent)}
                tone={changeTone(ticker?.change24hPercent)}
              />
              <TickerMetric label="24h High" value={formatTickerValue(ticker?.high24h, quoteSymbol)} />
              <TickerMetric label="24h Low" value={formatTickerValue(ticker?.low24h, quoteSymbol)} />
              <TickerMetric label="24h Volume" value={formatTickerValue(ticker?.volume24h, baseSymbol)} />
              <TickerMetric label="Best Bid" value={formatTickerValue(ticker?.bestBid, quoteSymbol)} />
              <TickerMetric label="Best Ask" value={formatTickerValue(ticker?.bestAsk, quoteSymbol)} />
              <TickerMetric label="Status" value={marketStatus} />
            </div>
          </section>

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
                <h2 className="text-lg font-semibold text-white">Limit Order</h2>
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

                <div className="grid gap-3 md:grid-cols-3">
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
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || marketStatus === "PAUSED"}
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
                      : side === "BUY"
                        ? `Buy ${baseSymbol}`
                        : `Sell ${baseSymbol}`}
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
                isOpenOrder(order.status) && BigInt(order.remainingAmountRaw) > 0n ? (
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

  if (status === "CANCELLED") {
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

function buildMarketOptions(markets: MarketSummary[], selectedMarketSymbol: string) {
  const options = new Set<string>([DEFAULT_MARKET_SYMBOL, selectedMarketSymbol]);
  for (const market of markets) {
    options.add(market.marketSymbol);
  }

  return [...options];
}

function marketBaseSymbol(marketSymbol: string) {
  return marketSymbol.split("/")[0] || "SWL";
}

function marketQuoteSymbol(marketSymbol: string) {
  return marketSymbol.split("/")[1] || "SWC";
}
