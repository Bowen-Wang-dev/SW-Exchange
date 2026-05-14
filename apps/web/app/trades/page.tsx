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
            description="Trade history will eventually reflect matched fills for SWL/SWC. For v0.2, the page provides the dark, data-dense table shell only."
            action={<StatusBadge label="Pending Engine" tone="warning" />}
          />

          <DataTable
            columns={["Trade ID", "Market", "Side", "Price", "Amount", "Fee", "Time"]}
            rows={[
              [
                "trd_demo_2001",
                "SWL/SWC",
                <span key="buy" className="text-emerald-300">
                  Buy
                </span>,
                "0.142800",
                "480.00",
                "0.48 SWL",
                "2026-05-14 12:01:14",
              ],
              [
                "trd_demo_2002",
                "SWL/SWC",
                <span key="sell" className="text-rose-300">
                  Sell
                </span>,
                "0.142700",
                "300.00",
                "42.81 SWC",
                "2026-05-14 11:54:09",
              ],
            ]}
          />
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
