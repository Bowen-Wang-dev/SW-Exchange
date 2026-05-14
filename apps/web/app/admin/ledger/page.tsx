import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";

export default function AdminLedgerPage() {
  return (
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Admin Ledger"
            title="Ledger review"
            description="Inspect the accounting trail behind future wallet, transfer, and trading activity."
            action={<StatusBadge label="Source of Truth" tone="info" />}
          />

          <DataTable
            columns={["Entry ID", "User", "Type", "Asset", "Amount", "Reference", "Created"]}
            rows={[
              [
                "ldg_demo_3001",
                "user_demo",
                <StatusBadge key="trade-buy" label="Trade Buy" tone="success" />,
                "SWL",
                "+480.00",
                "trade: trd_demo_2001",
                "2026-05-14 12:01:14",
              ],
              [
                "ldg_demo_3002",
                "user_demo",
                <StatusBadge key="order-lock" label="Order Lock" tone="warning" />,
                "SWC",
                "-12,000.00",
                "order: ord_demo_1001",
                "2026-05-14 11:50:00",
              ],
            ]}
          />
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
