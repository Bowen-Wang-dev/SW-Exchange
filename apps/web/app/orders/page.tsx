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
            description="Order history is placeholder-only in v0.2, but the shell is ready for centralized exchange order states, locked funds, and market-specific views."
            action={<StatusBadge label="Read-Only" tone="info" />}
          />

          <DataTable
            columns={["Order ID", "Market", "Side", "Price", "Amount", "Filled", "Status"]}
            rows={[
              [
                "ord_demo_1001",
                "SWL/SWC",
                <span key="buy" className="text-emerald-300">
                  BUY
                </span>,
                "0.142500",
                "1,200.00",
                "320.00",
                <StatusBadge key="open" label="Open" tone="info" />,
              ],
              [
                "ord_demo_1002",
                "SWL/SWC",
                <span key="sell" className="text-rose-300">
                  SELL
                </span>,
                "0.143100",
                "750.00",
                "750.00",
                <StatusBadge key="filled" label="Filled" tone="success" />,
              ],
            ]}
          />
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
