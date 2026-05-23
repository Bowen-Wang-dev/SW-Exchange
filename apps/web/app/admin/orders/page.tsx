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
import type { AdminOrderEntry, MarketSummary, OrderStatus } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrderEntry[]>([]);
  const [markets, setMarkets] = useState<MarketSummary[]>([]);
  const [marketFilter, setMarketFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadOrders() {
      try {
        setIsLoading(true);
        const params = new URLSearchParams();
        if (marketFilter) {
          params.set("marketSymbol", marketFilter);
        }
        if (statusFilter) {
          params.set("status", statusFilter);
        }
        if (userFilter.trim()) {
          params.set("user", userFilter.trim());
        }
        const query = params.toString() ? `?${params.toString()}` : "";
        const [orderResponse, marketResponse] = await Promise.all([
          apiRequest<AdminOrderEntry[]>(`/admin/orders${query}`),
          apiRequest<MarketSummary[]>("/markets/summary"),
        ]);
        if (active) {
          setOrders(orderResponse);
          setMarkets(marketResponse);
          setError(null);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof ApiError ? loadError.message : "Unable to load orders.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadOrders();

    return () => {
      active = false;
    };
  }, [marketFilter, statusFilter, userFilter]);

  return (
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Admin Orders"
            title="Order review"
            description="Inspect market and limit orders with clearer execution details, cancelled remainders, and final states newest first."
            action={<StatusBadge label="v0.16 Live" tone="success" />}
          />

          <AdminOrderFilters
            markets={markets}
            marketFilter={marketFilter}
            statusFilter={statusFilter}
            userFilter={userFilter}
            onMarketFilterChange={setMarketFilter}
            onStatusFilterChange={setStatusFilter}
            onUserFilterChange={setUserFilter}
          />

          {error ? <Notice tone="danger" message={error} /> : null}
          {isLoading ? <Notice tone="info" message="Loading orders..." /> : null}

          {!isLoading && !error ? (
            orders.length > 0 ? (
              <DataTable
                columns={[
                  "Time",
                  "Order",
                  "User",
                  "Market",
                  "Pricing",
                  "Execution",
                  "Status",
                  "Locked",
                  "Cancelled",
                ]}
                rows={orders.map((order) => [
                  formatDateTime(order.createdAt),
                  <OrderIdentityCell key={`${order.id}-identity`} order={order} />,
                  <div key={`${order.id}-user`} className="space-y-1">
                    <p className="font-medium text-white">{order.user.username}</p>
                    <p className="text-xs text-[var(--foreground-muted)]">{order.user.email}</p>
                  </div>,
                  <MarketCell key={`${order.id}-market`} marketSymbol={order.marketSymbol} />,
                  <OrderPricingCell key={`${order.id}-pricing`} order={order} />,
                  <OrderExecutionCell key={`${order.id}-execution`} order={order} />,
                  <StatusBadge
                    key={`${order.id}-status`}
                    label={order.status}
                    tone={orderStatusTone(order.status)}
                  />,
                  `${order.lockedAmount} ${order.lockedAssetSymbol}`,
                  formatDateTime(order.cancelledAt),
                ])}
              />
            ) : (
              <Notice tone="info" message="No orders found." />
            )
          ) : null}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function AdminOrderFilters({
  markets,
  marketFilter,
  statusFilter,
  userFilter,
  onMarketFilterChange,
  onStatusFilterChange,
  onUserFilterChange,
}: {
  markets: MarketSummary[];
  marketFilter: string;
  statusFilter: string;
  userFilter: string;
  onMarketFilterChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onUserFilterChange: (value: string) => void;
}) {
  return (
    <div className="panel rounded-3xl p-4">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
          Market
          <select
            value={marketFilter}
            onChange={(event) => onMarketFilterChange(event.target.value)}
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
        <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
          Status
          <select
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value)}
            className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
          >
            <option value="">All statuses</option>
            {["OPEN", "PARTIAL_FILLED", "FILLED", "PARTIAL_FILLED_CANCELLED", "CANCELLED", "REJECTED"].map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
          User
          <input
            value={userFilter}
            onChange={(event) => onUserFilterChange(event.target.value)}
            placeholder="username, email, or user ID"
            className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
          />
        </label>
      </div>
    </div>
  );
}

function Notice({ tone, message }: { tone: "info" | "danger"; message: string }) {
  const classes =
    tone === "danger"
      ? "border-rose-300/20 bg-rose-300/10 text-rose-100"
      : "border-blue-300/20 bg-blue-300/10 text-blue-100";

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${classes}`}>{message}</div>;
}
