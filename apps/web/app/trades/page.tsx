import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { TRADE_HISTORY_COPY } from "@/lib/milestone-copy";

export default function TradesPage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Trades"
            title="Executed trade history"
            description={TRADE_HISTORY_COPY}
            action={<StatusBadge label="Pending Engine" tone="warning" />}
          />

          <DataTable
            columns={["Trade ID", "Market", "Side", "Price", "Amount", "Fee (v0.7)", "Time"]}
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
