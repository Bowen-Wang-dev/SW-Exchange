import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";

export default function WalletPage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Wallet"
            title="Internal asset balances"
            description="Wallet balances are placeholder-only in v0.2, but the view is structured for internal SWC and SWL custody with available and locked balance tracking."
            action={<StatusBadge label="Internal Only" tone="info" />}
          />

          <DataTable
            columns={["Asset", "Available", "Locked", "Total", "Actions"]}
            rows={[
              [
                <div key="swc" className="space-y-1">
                  <p className="font-medium text-white">SWC</p>
                  <p className="text-xs text-[var(--foreground-muted)]">SW Cash</p>
                </div>,
                "94,200.0000",
                "12,000.0000",
                "106,200.0000",
                <div key="swc-actions" className="flex flex-wrap gap-2">
                  <ActionButton label="Deposit" />
                  <ActionButton label="Withdraw" />
                  <ActionButton label="Transfer" />
                </div>,
              ],
              [
                <div key="swl" className="space-y-1">
                  <p className="font-medium text-white">SWL</p>
                  <p className="text-xs text-[var(--foreground-muted)]">SW LUNA</p>
                </div>,
                "17,480.0000",
                "420.0000",
                "17,900.0000",
                <div key="swl-actions" className="flex flex-wrap gap-2">
                  <ActionButton label="Deposit" />
                  <ActionButton label="Withdraw" />
                  <ActionButton label="Transfer" />
                </div>,
              ],
            ]}
          />

          <div className="rounded-2xl border border-amber-300/16 bg-amber-300/8 px-4 py-3 text-sm text-amber-100">
            Deposit and withdraw remain disabled in SW Exchange v0.x. Wallet actions shown here are
            layout placeholders only.
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function ActionButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      className="rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground-muted)] opacity-70"
    >
      {label}
    </button>
  );
}
