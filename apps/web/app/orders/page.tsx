import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";

export default function OrdersPage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Orders"
            title="Open and historical orders"
            description="Order history is preview-only until limit order support arrives in v0.5. No orders are created in v0.4."
            action={<StatusBadge label="Read-Only" tone="info" />}
          />

          <DataTable
            columns={["Order ID", "Market", "Side", "Price", "Amount", "Filled", "Status"]}
            rows={[
              [
                "—",
                "SWL/SWC",
                <span key="buy" className="text-emerald-300">
                  BUY
                </span>,
                "—",
                "—",
                "—",
                <StatusBadge key="open" label="Preview" tone="info" />,
              ],
              [
                "—",
                "SWL/SWC",
                <span key="sell" className="text-rose-300">
                  SELL
                </span>,
                "—",
                "—",
                "—",
                <StatusBadge key="filled" label="Preview" tone="warning" />,
              ],
            ]}
          />
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
