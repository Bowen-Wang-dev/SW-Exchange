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
          description="SW Exchange v0.x supports one internal spot market today. The shell is ready for more listings later, but trading logic remains placeholder-only in this milestone."
        />

        <DataTable
          columns={["Market", "Status", "Last Price", "24h Change", "24h Volume", "Notes"]}
          rows={[
            [
              <div key="market" className="space-y-1">
                <p className="font-medium text-white">SWL/SWC</p>
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                  Spot
                </p>
              </div>,
              <StatusBadge key="status" label="Active" tone="success" />,
              "0.142800",
              <span key="change" className="text-emerald-300">
                +2.84%
              </span>,
              "184,220 SWL",
              "Only supported market in v0.x",
            ],
          ]}
        />
      </div>
    </AppShell>
  );
}
