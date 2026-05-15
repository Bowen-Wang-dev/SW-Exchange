"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest } from "@/lib/api-client";
import type { AdminSummary } from "@/lib/api-types";
import { REAL_TIME_SYNC_COPY } from "@/lib/milestone-copy";
import { useAuth } from "@/providers/auth-provider";

export function AdminDashboardContent() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<AdminSummary | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSummary() {
      try {
        const response = await apiRequest<AdminSummary>("/admin");
        if (active) {
          setSummary(response);
        }
      } catch {
        if (active) {
          setSummary(null);
        }
      }
    }

    void loadSummary();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Admin Dashboard"
        title={`Admin console: ${user?.username ?? "admin"}`}
        description={`Current milestone: v0.5. Limit orders, order book, admin review, and internal transfers are live. ${REAL_TIME_SYNC_COPY}`}
        action={<StatusBadge label="Admin Mode" tone="warning" />}
      />

      <div className="grid gap-4 lg:grid-cols-6">
        <StatCard
          label="Total Users"
          badgeLabel="Live"
          value={String(summary?.totalUsers ?? "-")}
          hint="Live count from the users table."
          tone="info"
        />
        <StatCard
          label="Total Wallets"
          badgeLabel="Live"
          value={String(summary?.totalWallets ?? "-")}
          hint="Live count from initialized wallets."
          tone="success"
        />
        <StatCard
          label="Ledger Entries"
          badgeLabel="Live"
          value={String(summary?.totalLedgerEntries ?? "-")}
          hint="Live accounting entry count."
          tone="warning"
        />
        <StatCard
          label="Transfers"
          badgeLabel="Live"
          value={String(summary?.totalTransfers ?? "-")}
          hint="Live internal transfer count."
          tone="success"
        />
        <StatCard
          label="Open Orders"
          badgeLabel="Live"
          value={String(summary?.totalOpenOrders ?? "-")}
          hint="Live open order count."
          tone="info"
        />
        <StatCard
          label="Audit Logs"
          badgeLabel="Live"
          value={String(summary?.totalAuditLogs ?? "-")}
          hint="Live admin action trail count."
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
              "Airdrops update wallet, ledger, and audit records in one transaction.",
              "Internal transfers update both wallets and paired ledger entries in one transaction.",
              "Limit orders lock and unlock wallet balances through ledger entries.",
              "Wallet viewer pages are live for both admin and normal users.",
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
            ["Users", <StatusBadge key="users" label="Live" tone="success" />, "Admin user list endpoint"],
            ["Wallets", <StatusBadge key="wallets" label="Live" tone="success" />, "SWC/SWL balances"],
            ["Airdrop", <StatusBadge key="airdrop" label="Enabled" tone="warning" />, "Admin-only SWC/SWL funding"],
            ["Transfers", <StatusBadge key="transfers" label="Live" tone="success" />, "Free user-to-user internal transfers"],
            ["Orders", <StatusBadge key="orders" label="Live" tone="success" />, "Limit order lock and cancel review"],
            ["Audit", <StatusBadge key="audit" label="Live" tone="info" />, "Airdrop audit trail"],
          ]}
        />
      </div>
    </div>
  );
}
