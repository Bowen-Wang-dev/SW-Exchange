"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest, ApiError } from "@/lib/api-client";
import type { OrderEntry, OrderSide, OrderStatus } from "@/lib/api-types";
import { formatDateTime, shortId } from "@/lib/format";

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    void loadOrders();
  }, []);

  async function loadOrders() {
    try {
      setIsLoading(true);
      const response = await apiRequest<OrderEntry[]>("/orders/me");
      setOrders(response);
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
            description="Review SWL/SWC limit orders, filled amounts, remaining amounts, and cancel open or partially filled orders."
            action={<StatusBadge label="v0.6 Live" tone="success" />}
          />

          {error ? <Notice tone="danger" message={error} /> : null}
          {success ? <Notice tone="success" message={success} /> : null}
          {isLoading ? <Notice tone="info" message="Loading orders..." /> : null}

          {!isLoading && !error ? (
            orders.length > 0 ? (
              <DataTable
                columns={[
                  "Time",
                  "Order ID",
                  "Market",
                  "Side",
                  "Type",
                  "Price",
                  "Amount",
                  "Filled",
                  "Remaining",
                  "Status",
                  "Action",
                ]}
                rows={orders.map((order) => [
                  formatDateTime(order.createdAt),
                  shortId(order.id),
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
            ) : (
              <Notice tone="info" message="No orders yet." />
            )
          ) : null}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function isOpenOrder(status: OrderStatus) {
  return status === "OPEN" || status === "PARTIAL_FILLED";
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
