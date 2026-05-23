"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { AssetIcon } from "@/components/ui/asset-icon";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest, ApiError } from "@/lib/api-client";
import type { AdminOrderEntry, MarketSummary, OrderSide, OrderStatus } from "@/lib/api-types";
import { formatDateTime, shortId } from "@/lib/format";

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
            description="Inspect limit orders, fills, remaining amounts, and cancellation states newest first."
            action={<StatusBadge label="v0.14.1 Live" tone="success" />}
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
                  "Order ID",
                  "User",
                  "Market",
                  "Side",
                  "Type",
                  "Price",
                  "Amount",
                  "Filled",
                  "Remaining",
                  "Status",
                  "Locked",
                  "Cancelled",
                ]}
                rows={orders.map((order) => [
                  formatDateTime(order.createdAt),
                  shortId(order.id),
                  <div key={`${order.id}-user`} className="space-y-1">
                    <p className="font-medium text-white">{order.user.username}</p>
                    <p className="text-xs text-[var(--foreground-muted)]">{order.user.email}</p>
                  </div>,
                  <MarketCell key={`${order.id}-market`} marketSymbol={order.marketSymbol} />,
                  <SideText key={`${order.id}-side`} side={order.side} />,
                  order.type,
                  order.price,
                  order.amount,
                  order.filledAmount,
                  order.remainingAmount,
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
            {["OPEN", "PARTIAL_FILLED", "FILLED", "CANCELLED", "REJECTED"].map((status) => (
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

function MarketCell({ marketSymbol }: { marketSymbol: string }) {
  const [baseSymbol, quoteSymbol] = marketSymbol.split("/");

  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex -space-x-2">
        <AssetIcon symbol={baseSymbol ?? "SWL"} size={24} />
        <AssetIcon symbol={quoteSymbol ?? "SWC"} size={24} />
      </span>
      <span className="font-medium text-white">{marketSymbol}</span>
    </span>
  );
}

function SideText({ side }: { side: OrderSide }) {
  return (
    <span className={side === "BUY" ? "text-emerald-300" : "text-rose-300"}>{side}</span>
  );
}

function Notice({ tone, message }: { tone: "info" | "danger"; message: string }) {
  const classes =
    tone === "danger"
      ? "border-rose-300/20 bg-rose-300/10 text-rose-100"
      : "border-blue-300/20 bg-blue-300/10 text-blue-100";

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${classes}`}>{message}</div>;
}
