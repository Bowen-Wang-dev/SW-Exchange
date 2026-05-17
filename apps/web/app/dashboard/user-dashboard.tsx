"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { AssetIdentity } from "@/components/ui/asset-icon";
import { DataTable } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest } from "@/lib/api-client";
import type { PortfolioValuation } from "@/lib/api-types";
import { REAL_TIME_SYNC_COPY } from "@/lib/milestone-copy";
import { useAuth } from "@/providers/auth-provider";

export function DashboardContent() {
  const { user } = useAuth();
  const [valuation, setValuation] = useState<PortfolioValuation | null>(null);

  useEffect(() => {
    let active = true;

    async function loadValuation() {
      try {
        const response = await apiRequest<PortfolioValuation>("/wallets/me/valuation");
        if (active) {
          setValuation(response);
        }
      } catch {
        if (active) {
          setValuation(null);
        }
      }
    }

    void loadValuation();

    const intervalId = window.setInterval(() => {
      void loadValuation();
    }, 5000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const swcAsset = valuation?.assets.find((asset) => asset.assetSymbol === "SWC");
  const swlAsset = valuation?.assets.find((asset) => asset.assetSymbol === "SWL");
  const swcBalance = swcAsset?.total ?? "0";
  const swcValue = swcAsset?.valueInSWC ?? "0";
  const swlBalance = swlAsset?.total ?? "0";
  const swlValue = swlAsset?.valueInSWC;
  const totalEquity = `${valuation?.totalEquity ?? "0"} SWC`;
  const swlValuationPending = Boolean(swlAsset && swlAsset.priceInSWC === null);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="User Dashboard"
        title={`Welcome ${user?.username ?? "Trader"}`}
        description={`Your v0.11 console shows live balances, asset icons, market ticker data, SWC portfolio valuation, limit orders, matching, trades, fee settlement, and admin status controls. ${REAL_TIME_SYNC_COPY}`}
        action={
          <StatusBadge
            label={user?.status ?? "ACTIVE"}
            tone={user?.status === "ACTIVE" ? "success" : "warning"}
          />
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Equity"
          badgeLabel="Live"
          value={totalEquity}
          hint={
            swlValuationPending
              ? "SWC-only total until SWL has a last traded price."
              : "SWC-denominated value including available and locked balances."
          }
          tone="info"
        />
        <StatCard
          label="SWC Balance/Value"
          badgeLabel="Live"
          value={`${swcBalance} SWC`}
          hint={`Estimated value: ${swcValue} SWC.`}
          tone="success"
        />
        <StatCard
          label="SWL Balance/Value"
          badgeLabel={swlValuationPending ? "Pending" : "Live"}
          value={`${swlBalance} SWL`}
          hint={
            swlValuationPending
              ? "SWL valuation pending until trades exist."
              : `Estimated value: ${swlValue ?? "0"} SWC at last price ${swlAsset?.priceInSWC ?? "—"}.`
          }
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
          columns={["Asset", "Total", "Price in SWC", "Value in SWC", "Note"]}
          rows={[
            [
              <AssetIdentity
                key="swc-asset"
                symbol="SWC"
                name={swcAsset?.assetName}
                displayName={swcAsset?.displayName}
                iconUrl={swcAsset?.iconUrl}
              />,
              `${swcAsset?.total ?? "0"} SWC`,
              "1",
              `${swcAsset?.valueInSWC ?? "0"} SWC`,
              "Quote asset; valued at 1 SWC.",
            ],
            [
              <AssetIdentity
                key="swl-asset"
                symbol="SWL"
                name={swlAsset?.assetName}
                displayName={swlAsset?.displayName}
                iconUrl={swlAsset?.iconUrl}
              />,
              `${swlAsset?.total ?? "0"} SWL`,
              swlAsset?.priceInSWC ?? "—",
              swlAsset?.valueInSWC ? `${swlAsset.valueInSWC} SWC` : "—",
              swlValuationPending
                ? "SWL valuation pending until trades exist."
                : "Valued from the latest SWL/SWC trade.",
            ],
          ]}
        />
      </div>
    </div>
  );
}
