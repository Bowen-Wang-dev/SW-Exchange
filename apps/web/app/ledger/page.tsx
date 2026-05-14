import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";

export default function LedgerPage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Ledger"
            title="Balance change ledger"
            description="The ledger is the accounting backbone of SW Exchange. This v0.2 page focuses on exchange-style visibility rather than real balance mutation logic."
            action={<StatusBadge label="Accounting" tone="info" />}
          />

          <DataTable
            columns={["Entry ID", "Type", "Asset", "Amount", "Available After", "Locked After", "Reference"]}
            rows={[
              [
                "ldg_demo_3001",
                <StatusBadge key="trade-buy" label="Trade Buy" tone="success" />,
                "SWL",
                "+480.00",
                "17,480.00",
                "420.00",
                "trade: trd_demo_2001",
              ],
              [
                "ldg_demo_3002",
                <StatusBadge key="order-lock" label="Order Lock" tone="warning" />,
                "SWC",
                "-12,000.00",
                "94,200.00",
                "12,000.00",
                "order: ord_demo_1001",
              ],
            ]}
          />
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
