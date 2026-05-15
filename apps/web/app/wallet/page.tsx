"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest, ApiError } from "@/lib/api-client";
import type { WalletBalance } from "@/lib/api-types";

export default function WalletPage() {
  const [wallets, setWallets] = useState<WalletBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadWallets() {
      try {
        setIsLoading(true);
        const response = await apiRequest<WalletBalance[]>("/wallets/me");
        if (active) {
          setWallets(response);
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

    return () => {
      active = false;
    };
  }, []);

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Wallet"
            title="Internal asset balances"
            description="View your live SWC and SWL balances. Deposit and withdraw are disabled in v0.x; internal transfer comes in v0.4."
            action={<StatusBadge label="Internal Only" tone="info" />}
          />

          {error ? <Notice tone="danger" message={error} /> : null}
          {isLoading ? <Notice tone="info" message="Loading wallet balances..." /> : null}

          {!isLoading && !error ? (
            wallets.length > 0 ? (
              <DataTable
                columns={["Asset", "Name", "Available", "Locked", "Total", "Actions"]}
                rows={wallets.map((wallet) => [
                  <span key={`${wallet.asset}-asset`} className="font-medium text-white">
                    {wallet.asset}
                  </span>,
                  wallet.name,
                  wallet.available,
                  wallet.locked,
                  wallet.total,
                  <div key={`${wallet.asset}-actions`} className="flex flex-wrap gap-2">
                    <ActionButton label="Deposit" />
                    <ActionButton label="Withdraw" />
                    <ActionButton label="Transfer v0.4" />
                  </div>,
                ])}
              />
            ) : (
              <Notice tone="info" message="No wallets found yet." />
            )
          ) : null}

          <div className="rounded-2xl border border-amber-300/16 bg-amber-300/8 px-4 py-3 text-sm text-amber-100">
            Deposit and withdraw are disabled in v0.x. User-to-user internal transfer is planned for v0.4.
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

function ActionButton({ label }: { label: string }) {
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
