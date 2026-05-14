import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { StatusBadge } from "@/components/ui/status-badge";

export default function AdminAirdropPage() {
  return (
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Admin Airdrop"
            title="Airdrop staging shell"
            description="Airdrop execution is intentionally not implemented in v0.2. This page previews the admin workflow that will land in v0.3."
            action={<StatusBadge label="Planned v0.3" tone="warning" />}
          />

          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <section className="panel rounded-3xl p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                Airdrop Form
              </p>
              <div className="mt-4 grid gap-4">
                {["Target User", "Asset", "Amount", "Note"].map((field) => (
                  <input
                    key={field}
                    disabled
                    placeholder={field}
                    className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-[var(--foreground-muted)]"
                  />
                ))}
                <button
                  type="button"
                  disabled
                  className="rounded-2xl bg-white/[0.06] px-4 py-3 text-sm font-semibold text-[var(--foreground-muted)]"
                >
                  Execute airdrop placeholder
                </button>
              </div>
            </section>

            <section className="panel rounded-3xl p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                Guardrails
              </p>
              <div className="data-divider mt-4 rounded-2xl border border-[var(--border)]">
                {[
                  "No wallet balance mutations are enabled in v0.2.",
                  "Future airdrops must write wallet, ledger, and audit records together.",
                  "Only a single full-permission admin exists in v0.x.",
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
