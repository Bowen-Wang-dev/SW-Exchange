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
          eyebrow="v0.2 Shell"
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
            value="v0.2"
            hint="Auth + CEX UI Shell completed and documented."
            tone="success"
          />
          <StatCard
            label="Next Milestone"
            value="v0.3"
            hint="Admin Airdrop + Wallet Viewer is the next milestone."
            tone="warning"
          />
          <StatCard
            label="Market Universe"
            value="1"
            hint="Only SWL/SWC is listed in v0.x."
            tone="success"
          />
          <StatCard
            label="Chain Features"
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
                "Internal transfer later in roadmap",
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
              ["Wallet", <StatusBadge key="wallet" label="Shell Ready" tone="info" />, "Viewer shell completed, no mutations yet"],
              ["Trade", <StatusBadge key="trade" label="Shell Ready" tone="info" />, "UI shell completed, no order logic yet"],
              ["Admin", <StatusBadge key="admin" label="Scoped" tone="success" />, "Single full-permission admin shell ready"],
            ]}
          />
        </div>
      </div>
    </AppShell>
  );
}
