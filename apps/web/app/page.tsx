import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";

export default function HomePage() {
  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          eyebrow="v0.4"
          title="Simulated exchange control center"
          description="SW Exchange v0.x is a professional, dark-theme simulated crypto exchange shell focused on auth, internal wallets, and the single SWL/SWC market. No blockchain, no deposit, no withdraw, no market orders, and no K-line are included in this version."
          action={
            <div className="flex flex-wrap gap-2">
              <Link
                href="/login"
                className="rounded-2xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground-soft)] transition hover:text-white"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-2xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-[var(--accent-strong)]"
              >
                Register
              </Link>
            </div>
          }
        />

        <div className="grid gap-4 lg:grid-cols-4">
          <StatCard
            label="Current Milestone"
            badgeLabel="v0.4"
            value="v0.4"
            hint="Internal Transfer completed."
            tone="success"
          />
          <StatCard
            label="Next Milestone"
            badgeLabel="v0.5"
            value="v0.5"
            hint="Limit Order + Order Book comes next."
            tone="warning"
          />
          <StatCard
            label="Market Universe"
            badgeLabel="SWL/SWC"
            value="1"
            hint="Only SWL/SWC is listed in v0.x."
            tone="success"
          />
          <StatCard
            label="Chain Features"
            badgeLabel="None"
            value="0"
            hint="No deposit, withdraw, or blockchain integration."
            tone="danger"
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
          <section className="panel rounded-3xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                  Product Boundaries
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">v0.x scope discipline</h2>
              </div>
              <StatusBadge label="Simulation" tone="info" />
            </div>
            <div className="data-divider mt-5 rounded-2xl border border-[var(--border)]">
              {[
                "Internal wallet only",
                "Free internal transfer for active users",
                "Limit spot trading only",
                "No futures, no market orders",
                "No K-line and no blockchain flows",
              ].map((item) => (
                <div key={item} className="px-4 py-3 text-sm text-[var(--foreground-soft)]">
                  {item}
                </div>
              ))}
            </div>
          </section>

          <DataTable
            columns={["Module", "Status", "Summary"]}
            rows={[
              ["Auth", <StatusBadge key="auth" label="Ready" tone="success" />, "Register/login endpoints exist"],
              ["Wallet", <StatusBadge key="wallet" label="Live" tone="success" />, "User and admin wallet viewers show real balances"],
              ["Airdrop", <StatusBadge key="airdrop" label="Live" tone="warning" />, "Admin SWC/SWL funding is enabled"],
              ["Transfer", <StatusBadge key="transfer" label="Live" tone="success" />, "Free internal SWC/SWL transfers between active users"],
              ["Trade", <StatusBadge key="trade" label="Preview" tone="info" />, "Limit orders arrive in v0.5 and matching in v0.6"],
            ]}
          />
        </div>
      </div>
    </AppShell>
  );
}
