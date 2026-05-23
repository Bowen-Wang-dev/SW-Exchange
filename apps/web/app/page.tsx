import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  CURRENT_MILESTONE_HINT,
  CURRENT_MILESTONE_VERSION,
  NEXT_MILESTONE_HINT,
  NEXT_MILESTONE_VERSION,
  REAL_TIME_SYNC_COPY,
} from "@/lib/milestone-copy";

export default function HomePage() {
  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          eyebrow={CURRENT_MILESTONE_VERSION}
          title="Simulated exchange control center"
          description={`SW Exchange v0.x is a professional, dark-theme simulated crypto exchange shell focused on auth, internal wallets, and manually managed spot markets. Market data, interactive K-line candles, portfolio valuation, asset metadata/icons, fee settlement, admin wallet bucket polish, and manual listing controls are live. ${REAL_TIME_SYNC_COPY}`}
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
            label="CURRENT MILESTONE"
            badgeLabel={CURRENT_MILESTONE_VERSION}
            value={CURRENT_MILESTONE_VERSION}
            hint={CURRENT_MILESTONE_HINT}
            tone="success"
          />
          <StatCard
            label="Next Milestone"
            badgeLabel={NEXT_MILESTONE_VERSION}
            value={NEXT_MILESTONE_VERSION}
            hint={NEXT_MILESTONE_HINT}
            tone="warning"
          />
          <StatCard
            label="Listing Mode"
            badgeLabel="Admin"
            value="Manual"
            hint="Seeded pairs remain, and admins can create new assets and markets."
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
                "No deposit, withdraw, or blockchain flows",
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
              ["Wallet", <StatusBadge key="wallet" label="Live" tone="success" />, "User and admin wallet viewers show real balances and SWC valuation"],
              ["Airdrop", <StatusBadge key="airdrop" label="Live" tone="warning" />, "Admin asset funding is enabled for active assets"],
              ["Transfer", <StatusBadge key="transfer" label="Live" tone="success" />, "Free internal SWC/SWL transfers between active users"],
              ["Trade", <StatusBadge key="trade" label="Live" tone="success" />, "Limit orders, maker-price matching, ticker data, interactive K-line candles, fee settlement, trade history, and the order book are live."],
            ]}
          />
        </div>
      </div>
    </AppShell>
  );
}
