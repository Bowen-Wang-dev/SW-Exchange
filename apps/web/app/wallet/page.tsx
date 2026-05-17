"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { AssetIdentity } from "@/components/ui/asset-icon";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest, ApiError } from "@/lib/api-client";
import type { PortfolioValuation, WalletBalance } from "@/lib/api-types";

const POLL_INTERVAL_MS = 5000;

export default function WalletPage() {
  const [wallets, setWallets] = useState<WalletBalance[]>([]);
  const [valuation, setValuation] = useState<PortfolioValuation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadWallets() {
      try {
        setIsLoading(true);
        const [walletResponse, valuationResponse] = await Promise.all([
          apiRequest<WalletBalance[]>("/wallets/me"),
          apiRequest<PortfolioValuation>("/wallets/me/valuation"),
        ]);
        if (active) {
          setWallets(walletResponse);
          setValuation(valuationResponse);
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

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Wallet"
            title="Internal asset balances"
            description="View your live seeded asset balances. Internal transfers are live; deposit and withdraw stay disabled in v0.x."
            action={<StatusBadge label="Internal Only" tone="info" />}
          />

          {error ? <Notice tone="danger" message={error} /> : null}
          {isLoading ? <Notice tone="info" message="Loading wallet balances..." /> : null}

          {!isLoading && !error ? (
            wallets.length > 0 ? (
              <DataTable
                columns={["Asset", "Name", "Available", "Locked", "Total", "Est. Value SWC", "Actions"]}
                rows={wallets.map((wallet) => [
                  <AssetIdentity
                    key={`${wallet.asset}-asset`}
                    symbol={wallet.asset}
                    name={wallet.name}
                    displayName={wallet.displayName}
                    iconUrl={wallet.iconUrl}
                  />,
                  wallet.displayName ?? wallet.name,
                  wallet.available,
                  wallet.locked,
                  wallet.total,
                  formatWalletValue(valuation, wallet.asset),
                  <div key={`${wallet.asset}-actions`} className="flex flex-wrap gap-2">
                    <DisabledActionButton label="Deposit" />
                    <DisabledActionButton label="Withdraw" />
                    <Link
                      href="/transfer"
                      className="rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--accent-strong)] transition hover:border-[var(--accent-strong)]"
                    >
                      Transfer
                    </Link>
                  </div>,
                ])}
              />
            ) : (
              <Notice tone="info" message="No wallets found yet." />
            )
          ) : null}

          <div className="rounded-2xl border border-amber-300/16 bg-amber-300/8 px-4 py-3 text-sm text-amber-100">
            Deposit and withdraw are disabled in v0.x. Use internal transfer for free eligible asset
            movement between active users.
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function Notice({ tone, message }: { tone: "info" | "danger"; message: string }) {
  const classes =
    tone === "danger"
      ? "border-rose-300/20 bg-rose-300/10 text-rose-100"
      : "border-blue-300/20 bg-blue-300/10 text-blue-100";

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${classes}`}>{message}</div>;
}

function formatWalletValue(valuation: PortfolioValuation | null, assetSymbol: string) {
  const asset = valuation?.assets.find((entry) => entry.assetSymbol === assetSymbol);

  if (!asset || asset.valueInSWC === null) {
    return "—";
  }

  return `${asset.valueInSWC} SWC`;
}

function DisabledActionButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      className="rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground-muted)] opacity-70"
    >
      {label}
    </button>
  );
}
