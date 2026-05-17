"use client";

import { FormEvent, useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest, ApiError } from "@/lib/api-client";
import type { FeeSettingsResponse, WalletBalance } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";

const MARKET_SYMBOL = "SWL/SWC";

export default function AdminFeesPage() {
  const [settings, setSettings] = useState<FeeSettingsResponse | null>(null);
  const [buyerFeeRatePercent, setBuyerFeeRatePercent] = useState("0.1");
  const [sellerFeeRatePercent, setSellerFeeRatePercent] = useState("0.1");
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    void loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setIsLoading(true);
      const response = await apiRequest<FeeSettingsResponse>("/admin/fee-settings");
      setSettings(response);
      setBuyerFeeRatePercent(response.buyerFeeRatePercent);
      setSellerFeeRatePercent(response.sellerFeeRatePercent);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : "Unable to load fee settings.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      setIsSaving(true);
      const response = await apiRequest<FeeSettingsResponse>("/admin/fee-settings", {
        method: "PATCH",
        body: {
          marketSymbol: MARKET_SYMBOL,
          buyerFeeRatePercent: buyerFeeRatePercent.trim(),
          sellerFeeRatePercent: sellerFeeRatePercent.trim(),
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      });

      setSettings(response);
      setBuyerFeeRatePercent(response.buyerFeeRatePercent);
      setSellerFeeRatePercent(response.sellerFeeRatePercent);
      setNote("");
      setSuccess("Fee settings saved. Changes apply only to future trades.");
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : "Unable to update fee settings.");
    } finally {
      setIsSaving(false);
    }
  }

  const feeBalances = settings?.feeWallet.balances ?? [];
  const swcBalance = findBalance(feeBalances, "SWC");
  const swlBalance = findBalance(feeBalances, "SWL");

  return (
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Admin Fees"
            title="Trading fee control"
            description="Configure SWL/SWC buyer and seller fee rates. Fee changes apply only to future trades."
            action={<StatusBadge label="v0.9 Live" tone="success" />}
          />

          {error ? <Notice tone="danger" message={error} /> : null}
          {success ? <Notice tone="success" message={success} /> : null}
          {isLoading ? <Notice tone="info" message="Loading fee settings..." /> : null}

          <div className="grid gap-4 lg:grid-cols-4">
            <StatCard
              label="Buyer Fee"
              badgeLabel="SWL"
              value={settings?.buyerFeeRateHuman ?? "-"}
              hint="Charged from base asset received by buyers."
              tone="success"
            />
            <StatCard
              label="Seller Fee"
              badgeLabel="SWC"
              value={settings?.sellerFeeRateHuman ?? "-"}
              hint="Charged from quote asset received by sellers."
              tone="warning"
            />
            <StatCard
              label="Fee SWL"
              badgeLabel="FEE"
              value={`${swlBalance?.available ?? "0"} SWL`}
              hint="Collected buyer fees in base asset."
              tone="info"
            />
            <StatCard
              label="Fee SWC"
              badgeLabel="FEE"
              value={`${swcBalance?.available ?? "0"} SWC`}
              hint="Collected seller fees in quote asset."
              tone="info"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <section className="panel rounded-3xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                    {MARKET_SYMBOL}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">Update fee rates</h2>
                </div>
                <StatusBadge label={`Max ${settings?.maxFeeRateHuman ?? "5%"}`} tone="warning" />
              </div>

              <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
                <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                  Buyer fee rate percent
                  <input
                    value={buyerFeeRatePercent}
                    onChange={(event) => setBuyerFeeRatePercent(event.target.value)}
                    placeholder="0.1"
                    inputMode="decimal"
                    className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
                  />
                </label>

                <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                  Seller fee rate percent
                  <input
                    value={sellerFeeRatePercent}
                    onChange={(event) => setSellerFeeRatePercent(event.target.value)}
                    placeholder="0.1"
                    inputMode="decimal"
                    className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
                  />
                </label>

                <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                  Note
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Reason for changing fees"
                    rows={3}
                    className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
                  />
                </label>

                <div className="rounded-2xl border border-blue-300/20 bg-blue-300/10 px-4 py-3 text-sm text-blue-100">
                  Rates are stored as basis points. Fees are floor-rounded in minimal units, so very tiny trades may produce a zero fee.
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : "Save fee settings"}
                </button>
              </form>
            </section>

            <section className="space-y-4">
              <div className="panel rounded-3xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                      Admin Fee Wallet
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-white">
                      {settings?.feeWallet.displayName ?? "Fee Wallet"}
                    </h2>
                  </div>
                  <StatusBadge label="ACTIVE" tone="success" />
                </div>
                <p className="mt-3 text-sm text-[var(--foreground-soft)]">
                  Collected trading fees go to the admin Fee Wallet, not the admin Main Wallet.
                </p>
              </div>

              <DataTable
                columns={["Asset", "Available", "Locked", "Total"]}
                rows={feeBalances.map((balance) => [
                  balance.asset,
                  balance.available,
                  balance.locked,
                  balance.total,
                ])}
              />

              <div className="rounded-2xl border border-[var(--border)] bg-white/[0.03] px-4 py-3 text-sm text-[var(--foreground-soft)]">
                Last updated: {formatDateTime(settings?.updatedAt)}
              </div>
            </section>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function findBalance(balances: WalletBalance[], asset: string) {
  return balances.find((balance) => balance.asset === asset);
}

function Notice({
  tone,
  message,
}: {
  tone: "success" | "danger" | "info";
  message: string;
}) {
  const classes =
    tone === "danger"
      ? "border-rose-300/20 bg-rose-300/10 text-rose-100"
      : tone === "success"
        ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
        : "border-blue-300/20 bg-blue-300/10 text-blue-100";

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${classes}`}>{message}</div>;
}
