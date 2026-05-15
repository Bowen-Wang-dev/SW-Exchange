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
            description="Order operations are preview-only until limit order support arrives in v0.5."
            action={<StatusBadge label="Shell Only" tone="info" />}
          />

          <DataTable
            columns={["Order ID", "User", "Market", "Side", "Price", "Amount", "Status"]}
            rows={[
              [
                "—",
                "—",
                "SWL/SWC",
                <span key="buy" className="text-emerald-300">
                  BUY
                </span>,
                "—",
                "—",
                <StatusBadge key="open" label="Preview" tone="info" />,
              ],
              [
                "—",
                "—",
                "SWL/SWC",
                <span key="sell" className="text-rose-300">
                  SELL
                </span>,
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
