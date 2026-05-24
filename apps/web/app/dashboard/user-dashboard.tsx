"use client";

import { useEffect, useState } from "react";
import { PortfolioAssetPanel } from "@/components/portfolio/portfolio-asset-panel";
import { PageHeader } from "@/components/shell/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest } from "@/lib/api-client";
import type { MarketSummary, PortfolioValuation } from "@/lib/api-types";
import { CURRENT_MILESTONE_VERSION, REAL_TIME_SYNC_COPY } from "@/lib/milestone-copy";
import { useAuth } from "@/providers/auth-provider";

export function DashboardContent() {
  const { user } = useAuth();
  const [valuation, setValuation] = useState<PortfolioValuation | null>(null);
  const [markets, setMarkets] = useState<MarketSummary[]>([]);

  useEffect(() => {
    let active = true;

    async function loadPortfolio() {
      try {
        const [valuationResponse, marketResponse] = await Promise.all([
          apiRequest<PortfolioValuation>("/wallets/me/valuation"),
          apiRequest<MarketSummary[]>("/markets/summary"),
        ]);
        if (active) {
          setValuation(valuationResponse);
          setMarkets(marketResponse);
        }
      } catch {
        if (active) {
          setValuation(null);
          setMarkets([]);
        }
      }
    }

    void loadPortfolio();

    const intervalId = window.setInterval(() => {
      void loadPortfolio();
    }, 5000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const swcAsset = valuation?.assets.find((asset) => asset.assetSymbol === "SWC");
  const nonQuoteAssets = valuation?.assets.filter((asset) => asset.assetSymbol !== "SWC") ?? [];
  const valuationAssets = valuation?.assets ?? [];
  const primaryBaseAsset = nonQuoteAssets.find((asset) => asset.assetSymbol === "SWL") ?? nonQuoteAssets[0];
  const swcBalance = swcAsset?.total ?? "0";
  const swcValue = swcAsset?.valueInSWC ?? "0";
  const baseBalance = primaryBaseAsset?.total ?? "0";
  const baseValue = primaryBaseAsset?.valueInSWC;
  const totalEquity = `${valuation?.totalEquity ?? "0"} SWC`;
  const valuationPending = Boolean(valuation?.hasUnpricedAssets);
  const visibleNonZeroAssets = valuationAssets.filter((asset) => BigInt(asset.totalRaw) > 0n).length;
  const lockedAssets = valuationAssets.filter((asset) => BigInt(asset.lockedRaw) > 0n).length;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="User Dashboard"
        title={`Welcome ${user?.username ?? "Trader"}`}
        description={`Your ${CURRENT_MILESTONE_VERSION} console shows live balances, asset icons, market ticker data, interactive K-line candles, SWC portfolio valuation, limit and market orders, safer confirmations, refreshed trade UX, fee settlement, admin status controls, and manual listing support. ${REAL_TIME_SYNC_COPY}`}
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
            valuationPending
              ? "SWC-only for any assets that do not have a last traded SWC price yet."
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
          label={`${primaryBaseAsset?.assetSymbol ?? "Base"} Balance/Value`}
          badgeLabel={primaryBaseAsset?.priceInSWC === null ? "Pending" : "Live"}
          value={`${baseBalance} ${primaryBaseAsset?.assetSymbol ?? ""}`.trim()}
          hint={
            primaryBaseAsset?.priceInSWC === null
              ? `${primaryBaseAsset.assetSymbol} valuation pending until trades exist.`
              : `Estimated value: ${baseValue ?? "0"} SWC at last price ${primaryBaseAsset?.priceInSWC ?? "—"}.`
          }
          tone="warning"
        />
        <StatCard
          label="Active Assets"
          badgeLabel="Portfolio"
          value={`${visibleNonZeroAssets} active`}
          hint={
            lockedAssets > 0
              ? `${lockedAssets} asset${lockedAssets === 1 ? "" : "s"} include locked balances in open orders.`
              : "No locked balances in the visible portfolio snapshot."
          }
          tone={lockedAssets > 0 ? "warning" : "neutral"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
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

        <PortfolioAssetPanel
          assets={valuationAssets}
          markets={markets}
          storageKey="swx-dashboard-portfolio-assets"
          eyebrow="Portfolio Value"
          title="Asset valuation"
        />
      </div>
    </div>
  );
}
