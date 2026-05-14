"use client";

import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/providers/auth-provider";

export function DashboardContent() {
  const { user } = useAuth();

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="User Dashboard"
        title={`Welcome ${user?.username ?? "Trader"}`}
        description="Your v0.2 exchange console is ready. Wallets, orders, and trades are still placeholder-only, but the shell now behaves like a centralized exchange workspace."
        action={<StatusBadge label={user?.status ?? "ACTIVE"} tone="success" />}
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Equity"
          value="128,420.00 SWC"
          hint="Simulated equity placeholder for dashboard layout."
          tone="info"
        />
        <StatCard
          label="SWC Balance"
          value="94,200.00"
          hint="Internal quote asset placeholder."
          tone="success"
        />
        <StatCard
          label="SWL Balance"
          value="17,480.00"
          hint="Internal base asset placeholder."
          tone="warning"
        />
        <StatCard
          label="24h PnL"
          value="+2.84%"
          hint="Display-only placeholder until trading engine arrives."
          tone="success"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="panel rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                Account Snapshot
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">Profile status</h2>
            </div>
            <StatusBadge label={user?.role ?? "USER"} tone="info" />
          </div>

          <div className="data-divider mt-5 rounded-2xl border border-[var(--border)]">
            <div className="px-4 py-3 text-sm text-[var(--foreground-soft)]">
              Username: <span className="font-medium text-white">{user?.username ?? "-"}</span>
            </div>
            <div className="px-4 py-3 text-sm text-[var(--foreground-soft)]">
              Email: <span className="font-medium text-white">{user?.email ?? "-"}</span>
            </div>
            <div className="px-4 py-3 text-sm text-[var(--foreground-soft)]">
              Role: <span className="font-medium text-white">{user?.role ?? "USER"}</span>
            </div>
            <div className="px-4 py-3 text-sm text-[var(--foreground-soft)]">
              Status: <span className="font-medium text-white">{user?.status ?? "ACTIVE"}</span>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-amber-300/16 bg-amber-300/8 px-4 py-3 text-sm text-amber-100">
            SW Exchange v0.x is a simulated exchange. No deposit or withdraw in v0.x.
          </div>
        </section>

        <DataTable
          columns={["Market", "Status", "Bid", "Ask"]}
          rows={[
            [
              "SWL/SWC",
              <StatusBadge key="market-status" label="Active" tone="success" />,
              "0.142600",
              "0.142900",
            ],
          ]}
        />
      </div>
    </div>
  );
}
