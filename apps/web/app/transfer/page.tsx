import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { StatusBadge } from "@/components/ui/status-badge";

export default function TransferPage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Transfer"
            title="Internal transfer shell"
            description="Transfers are not implemented in v0.3. User-to-user internal transfer is the next milestone in v0.4."
            action={<StatusBadge label="Planned v0.4" tone="warning" />}
          />

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <section className="panel rounded-3xl p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                Transfer Form
              </p>
              <div className="mt-4 grid gap-4">
                {["Recipient", "Asset", "Amount", "Note"].map((field) => (
                  <label key={field} className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                      {field}
                    </span>
                    <input
                      disabled
                      placeholder={field}
                      className="w-full rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-[var(--foreground-muted)]"
                    />
                  </label>
                ))}
                <button
                  type="button"
                  disabled
                  className="rounded-2xl bg-white/[0.06] px-4 py-3 text-sm font-semibold text-[var(--foreground-muted)]"
                >
                  Transfer disabled
                </button>
              </div>
            </section>

            <section className="panel rounded-3xl p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                Rules
              </p>
              <div className="data-divider mt-4 rounded-2xl border border-[var(--border)]">
                {[
                  "Internal only. No blockchain deposit or withdraw.",
                  "Self-transfer should be rejected once logic is enabled.",
                  "Frozen users should not be able to transfer.",
                  "Every transfer must write paired ledger entries.",
                ].map((item) => (
                  <div key={item} className="px-4 py-3 text-sm text-[var(--foreground-soft)]">
                    {item}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
