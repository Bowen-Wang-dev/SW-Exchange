"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest, ApiError } from "@/lib/api-client";
import type { OrderBook, OrderBookLevel, OrderEntry, OrderSide, WalletBalance } from "@/lib/api-types";
import { formatDateTime, shortId } from "@/lib/format";
import { TRADE_PAGE_COPY, REAL_TIME_SYNC_COPY } from "@/lib/milestone-copy";

const MARKET_SYMBOL = "SWL/SWC";
const MONEY_DECIMALS = 18;

export default function TradePage() {
  const [side, setSide] = useState<OrderSide>("BUY");
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [wallets, setWallets] = useState<WalletBalance[]>([]);
  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  const [myOrders, setMyOrders] = useState<OrderEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const lockedAssetSymbol = side === "BUY" ? "SWC" : "SWL";
  const selectedWallet = wallets.find((wallet) => wallet.asset === lockedAssetSymbol);
  const totalPreview = useMemo(() => calculateTotalPreview(price, amount), [price, amount]);

  useEffect(() => {
    void loadTradeData();
  }, []);

  async function loadTradeData() {
    try {
      setIsLoading(true);
      const [bookResponse, ordersResponse, walletResponse] = await Promise.all([
        apiRequest<OrderBook>(`/order-book?marketSymbol=${encodeURIComponent(MARKET_SYMBOL)}`),
        apiRequest<OrderEntry[]>(`/orders/me?status=OPEN&marketSymbol=${encodeURIComponent(MARKET_SYMBOL)}`),
        apiRequest<WalletBalance[]>("/wallets/me"),
      ]);

      setOrderBook(bookResponse);
      setMyOrders(ordersResponse);
      setWallets(walletResponse);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : "Unable to load trade data.");
    } finally {
      setIsLoading(false);
    }
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
          marketSymbol: MARKET_SYMBOL,
          side,
          price: price.trim(),
          amount: amount.trim(),
        },
      });

      setAmount("");
      setSuccess(
        `${order.side} order ${shortId(order.id)} opened. Locked ${order.lockedAmount} ${order.lockedAssetSymbol}.`,
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
            title="SWL/SWC spot terminal"
            description={TRADE_PAGE_COPY}
            action={<StatusBadge label="v0.5 Live" tone="success" />}
          />

          {error ? <Notice tone="danger" message={error} /> : null}
          {success ? <Notice tone="success" message={success} /> : null}
          {isLoading ? <Notice tone="info" message="Loading trade data..." /> : null}

          <div className="grid gap-4 xl:grid-cols-[0.9fr_1fr_0.85fr]">
            <section className="panel rounded-3xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                    Market
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-white">{MARKET_SYMBOL}</h2>
                </div>
                <StatusBadge label="Spot" tone="info" />
              </div>

              <div className="mt-5 grid gap-5">
                <OrderBookTable title="Asks" side="SELL" levels={orderBook?.asks ?? []} />
                <div className="rounded-2xl border border-[var(--border)] bg-white/[0.03] px-4 py-3 text-center text-sm font-semibold text-white">
                  SWC per SWL
                </div>
                <OrderBookTable title="Bids" side="BUY" levels={orderBook?.bids ?? []} />
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
                    Price
                    <input
                      value={price}
                      onChange={(event) => setPrice(event.target.value)}
                      placeholder="2"
                      inputMode="decimal"
                      className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
                    />
                  </label>
                  <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                    Amount
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
                  <BalanceTile label="Total" value={`${totalPreview ?? "-"} SWC`} />
                  <BalanceTile
                    label={`${lockedAssetSymbol} Available`}
                    value={`${selectedWallet?.available ?? "0"} ${lockedAssetSymbol}`}
                  />
                  <BalanceTile
                    label={`${lockedAssetSymbol} Locked`}
                    value={`${selectedWallet?.locked ?? "0"} ${lockedAssetSymbol}`}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    side === "BUY"
                      ? "bg-[var(--success)] hover:bg-emerald-300"
                      : "bg-[var(--danger)] text-white hover:bg-rose-400"
                  }`}
                >
                  {isSubmitting ? "Submitting..." : side === "BUY" ? "Buy SWL" : "Sell SWL"}
                </button>
              </form>
            </section>

            <section className="panel rounded-3xl p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Recent Trades</h2>
                <StatusBadge label="v0.6" tone="neutral" />
              </div>
              <div className="mt-5 rounded-2xl border border-[var(--border)] bg-white/[0.03] px-4 py-8 text-center text-sm text-[var(--foreground-soft)]">
                {REAL_TIME_SYNC_COPY}
              </div>
            </section>
          </div>

          {myOrders.length > 0 ? (
            <DataTable
              columns={["Time", "Market", "Side", "Price", "Amount", "Remaining", "Status", "Action"]}
              rows={myOrders.map((order) => [
                formatDateTime(order.createdAt),
                order.marketSymbol,
                <SideText key={`${order.id}-side`} side={order.side} />,
                order.price,
                order.amount,
                order.remainingAmount,
                <StatusBadge key={`${order.id}-status`} label={order.status} tone="info" />,
                <button
                  key={`${order.id}-cancel`}
                  type="button"
                  onClick={() => void cancelOrder(order.id)}
                  disabled={cancellingId === order.id}
                  className="rounded-xl border border-rose-300/30 bg-rose-300/10 px-3 py-1.5 text-xs font-medium text-rose-200 transition hover:border-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {cancellingId === order.id ? "Cancelling..." : "Cancel"}
                </button>,
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
}: {
  title: string;
  side: OrderSide;
  levels: OrderBookLevel[];
}) {
  const toneClass = side === "BUY" ? "text-emerald-300" : "text-rose-300";

  return (
    <div>
      <div className="grid grid-cols-[1fr_1fr_80px] gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--foreground-muted)]">
        <span>{title}</span>
        <span>Amount SWL</span>
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

function BalanceTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white/[0.03] px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function SideText({ side }: { side: OrderSide }) {
  return (
    <span className={side === "BUY" ? "text-emerald-300" : "text-rose-300"}>{side}</span>
  );
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
