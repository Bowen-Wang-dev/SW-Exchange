"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import {
  MarketCell,
  OrderExecutionCell,
  OrderIdentityCell,
  OrderPricingCell,
  orderStatusTone,
} from "@/components/trade/order-history-cells";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest, ApiError } from "@/lib/api-client";
import type { MarketSummary, OrderEntry, OrderStatus } from "@/lib/api-types";
import { formatDateTime, shortId } from "@/lib/format";

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderEntry[]>([]);
  const [markets, setMarkets] = useState<MarketSummary[]>([]);
  const [marketFilter, setMarketFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    void loadOrders();
  }, [marketFilter]);

  async function loadOrders() {
    try {
      setIsLoading(true);
      const query = marketFilter ? `?marketSymbol=${encodeURIComponent(marketFilter)}` : "";
      const [orderResponse, marketResponse] = await Promise.all([
        apiRequest<OrderEntry[]>(`/orders/me${query}`),
        apiRequest<MarketSummary[]>("/markets/summary"),
      ]);
      setOrders(orderResponse);
      setMarkets(marketResponse);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : "Unable to load orders.");
    } finally {
      setIsLoading(false);
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
      await loadOrders();
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
            eyebrow="Orders"
            title="Order history"
            description="Review market and limit spot orders with clearer execution summaries, cancelled remainders, and open-limit cancel controls."
            action={<StatusBadge label="v0.16 Live" tone="success" />}
          />

          <MarketFilter
            markets={markets}
            value={marketFilter}
            onChange={setMarketFilter}
          />

          {error ? <Notice tone="danger" message={error} /> : null}
          {success ? <Notice tone="success" message={success} /> : null}
          {isLoading ? <Notice tone="info" message="Loading orders..." /> : null}

          {!isLoading && !error ? (
            orders.length > 0 ? (
              <DataTable
                columns={[
                  "Time",
                  "Order",
                  "Market",
                  "Pricing",
                  "Execution",
                  "Status",
                  "Action",
                ]}
                rows={orders.map((order) => [
                  formatDateTime(order.createdAt),
                  <OrderIdentityCell key={`${order.id}-identity`} order={order} />,
                  <MarketCell key={`${order.id}-market`} marketSymbol={order.marketSymbol} />,
                  <OrderPricingCell key={`${order.id}-pricing`} order={order} />,
                  <OrderExecutionCell key={`${order.id}-execution`} order={order} />,
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
                    <span className="text-xs text-[var(--foreground-muted)]">
                      {order.type === "MARKET" ? "No cancel" : "Closed"}
                    </span>
                  ),
                ])}
              />
            ) : (
              <Notice tone="info" message="No orders yet." />
            )
          ) : null}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function MarketFilter({
  markets,
  value,
  onChange,
}: {
  markets: MarketSummary[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="panel rounded-3xl p-4">
      <label className="grid max-w-xs gap-2 text-sm text-[var(--foreground-soft)]">
        Market
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
        >
          <option value="">All markets</option>
          {markets.map((market) => (
            <option key={market.marketSymbol} value={market.marketSymbol}>
              {market.marketSymbol}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function isOpenOrder(status: OrderStatus) {
  return status === "OPEN" || status === "PARTIAL_FILLED";
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
