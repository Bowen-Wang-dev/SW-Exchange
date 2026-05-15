"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest } from "@/lib/api-client";
import type { WalletBalance } from "@/lib/api-types";
import { useAuth } from "@/providers/auth-provider";

export function DashboardContent() {
  const { user } = useAuth();
  const [wallets, setWallets] = useState<WalletBalance[]>([]);

  useEffect(() => {
    let active = true;

    async function loadWallets() {
      try {
        const response = await apiRequest<WalletBalance[]>("/wallets/me");
        if (active) {
          setWallets(response);
        }
      } catch {
        if (active) {
          setWallets([]);
        }
      }
    }

    void loadWallets();

    return () => {
      active = false;
    };
  }, []);

  const swcWallet = wallets.find((wallet) => wallet.asset === "SWC");
  const swlWallet = wallets.find((wallet) => wallet.asset === "SWL");
  const swcBalance = swcWallet?.available ?? "0";
  const swlBalance = swlWallet?.available ?? "0";
  const swcTotalEquity = `${swcWallet?.total ?? "0"} SWC`;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="User Dashboard"
        title={`Welcome ${user?.username ?? "Trader"}`}
        description="Your v0.4 console shows live balances and free SWC/SWL internal transfers. Trading opens in later milestones."
        action={<StatusBadge label={user?.status ?? "ACTIVE"} tone="success" />}
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Equity"
          badgeLabel="v0.4"
          value={swcTotalEquity}
          hint="SWC-denominated estimate. SWL valuation pending until trading goes live."
          tone="info"
        />
        <StatCard
          label="SWC Balance"
          badgeLabel="Live"
          value={swcBalance}
          hint="Live available SWC wallet balance."
          tone="success"
        />
        <StatCard
          label="SWL Balance"
          badgeLabel="Live"
          value={swlBalance}
          hint="Live available SWL wallet balance."
          tone="warning"
        />
        <StatCard
          label="24h PnL"
          badgeLabel="Coming Soon"
          value="Not live"
          hint="PnL will be added after trading and pricing milestones."
          tone="neutral"
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
          columns={["Market", "Status", "Bid", "Ask", "Note"]}
          rows={[
            [
              "SWL/SWC",
              <StatusBadge key="market-status" label="Setup" tone="info" />,
              "—",
              "—",
              "Order book arrives in v0.5.",
            ],
          ]}
        />
      </div>
    </div>
  );
}
