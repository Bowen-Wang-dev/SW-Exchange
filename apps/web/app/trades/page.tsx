import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";

export default function TradesPage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Trades"
            title="Executed trade history"
            description="Trade history opens after the v0.6 matching engine milestone. No fills or fees are generated in v0.4."
            action={<StatusBadge label="Pending Engine" tone="warning" />}
          />

          <DataTable
            columns={["Trade ID", "Market", "Side", "Price", "Amount", "Fee", "Time"]}
            rows={[
              [
                "—",
                "SWL/SWC",
                <span key="buy" className="text-emerald-300">
                  Buy
                </span>,
                "—",
                "—",
                "—",
                "—",
              ],
              [
                "—",
                "SWL/SWC",
                <span key="sell" className="text-rose-300">
                  Sell
                </span>,
                "—",
                "—",
                "—",
                "—",
              ],
            ]}
          />
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
