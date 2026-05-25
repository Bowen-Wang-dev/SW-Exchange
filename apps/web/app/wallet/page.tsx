"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { PortfolioAssetPanel } from "@/components/portfolio/portfolio-asset-panel";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest, ApiError } from "@/lib/api-client";
import type { MarketSummary, PortfolioValuation } from "@/lib/api-types";

const POLL_INTERVAL_MS = 5000;

export default function WalletPage() {
  const [valuation, setValuation] = useState<PortfolioValuation | null>(null);
  const [markets, setMarkets] = useState<MarketSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadWallets() {
      try {
        setIsLoading(true);
        const [valuationResponse, marketResponse] = await Promise.all([
          apiRequest<PortfolioValuation>("/wallets/me/valuation"),
          apiRequest<MarketSummary[]>("/markets/summary"),
        ]);
        if (active) {
          setValuation(valuationResponse);
          setMarkets(marketResponse);
          setError(null);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof ApiError
              ? loadError.message
              : "Unable to load wallet balances.",
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadWallets();
    const intervalId = window.setInterval(() => {
      void loadWallets();
    }, POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const assets = valuation?.assets ?? [];
  const visibleAssets = assets.filter((asset) => BigInt(asset.totalRaw) > 0n);
  const lockedAssets = assets.filter((asset) => BigInt(asset.lockedRaw) > 0n);
  const pricedAssets = assets.filter((asset) => asset.valueInSWCRaw !== null);

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Wallet"
            title="Internal asset balances"
            description="View your live internal asset balances. Internal transfers are live; deposit, withdraw, and blockchain funding stay disabled in v0.x."
            action={<StatusBadge label="Internal Only" tone="info" />}
          />

          {error ? <Notice tone="danger" message={error} /> : null}
          {isLoading ? <Notice tone="info" message="Loading wallet balances..." /> : null}

          {!isLoading && !error ? (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-4">
                <StatCard
                  label="Total Equity"
                  badgeLabel="Live"
                  value={`${valuation?.totalEquity ?? "0"} SWC`}
                  hint={
                    valuation?.hasUnpricedAssets
                      ? "Some assets still need a SWC market price before they can be valued."
                      : "Estimated SWC value across available and locked balances."
                  }
                  tone="info"
                />
                <StatCard
                  label="Visible Balances"
                  badgeLabel="Assets"
                  value={`${visibleAssets.length}`}
                  hint="Assets with a non-zero total balance in the latest wallet snapshot."
                  tone="success"
                />
                <StatCard
                  label="Locked Assets"
                  badgeLabel="Orders"
                  value={`${lockedAssets.length}`}
                  hint="Locked balances usually reflect active limit orders."
                  tone={lockedAssets.length > 0 ? "warning" : "neutral"}
                />
                <StatCard
                  label="Priced Assets"
                  badgeLabel="SWC"
                  value={`${pricedAssets.length}/${assets.length}`}
                  hint="Assets with an estimated value; unpriced assets remain visible unless filtered by search."
                  tone="neutral"
                />
              </div>

              <PortfolioAssetPanel
                assets={assets}
                markets={markets}
                storageKey="swx-wallet-portfolio-assets"
                eyebrow="Wallet Balances"
                title="Portfolio assets"
                emptyMessage="No wallet assets match the current filters."
              />
            </div>
          ) : null}

          <div className="rounded-2xl border border-[var(--notice-warning-border)] bg-[var(--notice-warning-bg)] px-4 py-3 text-sm text-[var(--notice-warning-text)]">
            Funding rails remain out of scope in v0.x. Use the Transfer page for internal MAIN-wallet movements only.
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function Notice({ tone, message }: { tone: "info" | "danger"; message: string }) {
  const classes =
    tone === "danger"
      ? "border-[var(--notice-danger-border)] bg-[var(--notice-danger-bg)] text-[var(--notice-danger-text)]"
      : "border-[var(--notice-info-border)] bg-[var(--notice-info-bg)] text-[var(--notice-info-text)]";

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${classes}`}>{message}</div>;
}
