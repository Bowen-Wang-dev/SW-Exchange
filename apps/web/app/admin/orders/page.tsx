"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest, ApiError } from "@/lib/api-client";
import type { AdminOrderEntry, OrderSide, OrderStatus } from "@/lib/api-types";
import { formatDateTime, shortId } from "@/lib/format";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrderEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadOrders() {
      try {
        setIsLoading(true);
        const response = await apiRequest<AdminOrderEntry[]>("/admin/orders");
        if (active) {
          setOrders(response);
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
  }, []);

  return (
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Admin Orders"
            title="Order review"
            description="Inspect all SWL/SWC limit orders, fills, remaining amounts, and cancellation states newest first."
            action={<StatusBadge label="v0.6 Live" tone="success" />}
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
                  order.marketSymbol,
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
