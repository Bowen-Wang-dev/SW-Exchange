import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";

export default function AdminOrdersPage() {
  return (
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Admin Orders"
            title="Order review"
            description="Inspect open and historical order placeholders in a compact exchange operations table."
            action={<StatusBadge label="Shell Only" tone="info" />}
          />

          <DataTable
            columns={["Order ID", "User", "Market", "Side", "Price", "Amount", "Status"]}
            rows={[
              [
                "ord_demo_1001",
                "user_demo",
                "SWL/SWC",
                <span key="buy" className="text-emerald-300">
                  BUY
                </span>,
                "0.142500",
                "1,200.00",
                <StatusBadge key="open" label="Open" tone="info" />,
              ],
              [
                "ord_demo_1002",
                "user_demo",
                "SWL/SWC",
                <span key="sell" className="text-rose-300">
                  SELL
                </span>,
                "0.143100",
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
