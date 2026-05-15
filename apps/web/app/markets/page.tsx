import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";

export default function MarketsPage() {
  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          eyebrow="Markets"
          title="Exchange markets"
          description="SW Exchange v0.x supports one internal spot market today. Limit orders and the order book are live. Matching and trades arrive in v0.6."
        />

        <DataTable
          columns={["Market", "Status", "Bid", "Ask", "Notes"]}
          rows={[
            [
              <div key="market" className="space-y-1">
                <p className="font-medium text-white">SWL/SWC</p>
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                  Spot
                </p>
              </div>,
              <StatusBadge key="status" label="Live" tone="success" />,
              "—",
              "—",
              "Limit orders and the order book are live. Matching and trades arrive in v0.6.",
            ],
          ]}
        />
      </div>
    </AppShell>
  );
}
