"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest, ApiError } from "@/lib/api-client";
import type { AdminWalletBalance } from "@/lib/api-types";
import { shortId } from "@/lib/format";

export default function AdminWalletsPage() {
  const [wallets, setWallets] = useState<AdminWalletBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadWallets() {
      try {
        setIsLoading(true);
        const response = await apiRequest<AdminWalletBalance[]>("/admin/wallets");
        if (active) {
          setWallets(response);
          setError(null);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof ApiError ? loadError.message : "Unable to load wallets.");
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
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Admin Wallets"
            title="Wallet oversight"
            description="Monitor user wallet balances across SWC and SWL with a centralized exchange operations layout."
            action={<StatusBadge label="Viewer" tone="info" />}
          />

          {error ? <Notice tone="danger" message={error} /> : null}
          {isLoading ? <Notice tone="info" message="Loading wallets..." /> : null}

          {!isLoading && !error ? (
            wallets.length > 0 ? (
              <DataTable
                columns={["User", "Email", "Wallet", "Asset", "Available", "Locked", "Total", "Status"]}
                rows={wallets.map((wallet) => [
                  wallet.username,
                  wallet.email,
                  shortId(wallet.id),
                  <div key={`${wallet.id}-asset`} className="space-y-1">
                    <p className="font-medium text-white">{wallet.asset}</p>
                    <p className="text-xs text-[var(--foreground-muted)]">{wallet.name}</p>
                  </div>,
                  wallet.available,
                  wallet.locked,
                  wallet.total,
                  <StatusBadge
                    key={`${wallet.id}-status`}
                    label={wallet.lockedRaw === "0" ? "Healthy" : "Locked"}
                    tone={wallet.lockedRaw === "0" ? "success" : "warning"}
                  />,
                ])}
              />
            ) : (
              <Notice tone="info" message="No wallets found." />
            )
          ) : null}
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
