"use client";

import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/providers/auth-provider";

export function AdminDashboardContent() {
  const { user } = useAuth();

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Admin Dashboard"
        title={`Admin console: ${user?.username ?? "admin"}`}
        description="This is the v0.2 supervisory shell for user review, wallets, assets, orders, trades, ledger, and audit tooling."
        action={<StatusBadge label="Admin Mode" tone="warning" />}
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Users"
          value="128"
          hint="Placeholder admin aggregate."
          tone="info"
        />
        <StatCard
          label="Total Wallets"
          value="256"
          hint="Two-wallet expectation per user."
          tone="success"
        />
        <StatCard
          label="Total Trades"
          value="0"
          hint="Matching engine not implemented yet."
          tone="warning"
        />
        <StatCard
          label="Fee Revenue"
          value="0.00 SWC"
          hint="No executed trades in v0.2."
          tone="danger"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <section className="panel rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                Admin Notice
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">Operational scope</h2>
            </div>
            <StatusBadge label={user?.role ?? "ADMIN"} tone="warning" />
          </div>

          <div className="mt-5 rounded-2xl border border-amber-300/16 bg-amber-300/8 px-4 py-3 text-sm text-amber-100">
            Single full-permission admin mode in v0.x
          </div>

          <div className="data-divider mt-4 rounded-2xl border border-[var(--border)]">
            {[
              "Airdrop and wallet mutation logic are intentionally deferred from v0.2.",
              "Admin pages are read-oriented placeholders with centralized exchange styling.",
              "All later sensitive actions should map to ledger and audit entries.",
            ].map((item) => (
              <div key={item} className="px-4 py-3 text-sm text-[var(--foreground-soft)]">
                {item}
              </div>
            ))}
          </div>
        </section>

        <DataTable
          columns={["Area", "Status", "Notes"]}
          rows={[
            ["Users", <StatusBadge key="users" label="Shell" tone="info" />, "Review-oriented placeholder"],
            ["Wallets", <StatusBadge key="wallets" label="Shell" tone="info" />, "No mutations in v0.2"],
            ["Airdrop", <StatusBadge key="airdrop" label="Deferred" tone="warning" />, "Planned for v0.3"],
            ["Audit", <StatusBadge key="audit" label="Planned" tone="neutral" />, "Detailed tracking later"],
          ]}
        />
      </div>
    </div>
  );
}
