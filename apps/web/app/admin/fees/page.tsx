"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AdminConfirmationDialog,
  type AdminConfirmationView,
} from "@/components/admin/admin-confirmation-dialog";
import { AdminNotice } from "@/components/admin/admin-notice";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { AssetIdentity } from "@/components/ui/asset-icon";
import { DataTable } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest, ApiError } from "@/lib/api-client";
import type { FeeSettingsResponse, MarketSummary, WalletBalance } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";

const DEFAULT_MARKET_SYMBOL = "SWL/SWC";

type PendingFeeAction = {
  marketSymbol: string;
  buyerFeeRatePercent: string;
  sellerFeeRatePercent: string;
  note: string;
};

export default function AdminFeesPage() {
  const [settings, setSettings] = useState<FeeSettingsResponse | null>(null);
  const [markets, setMarkets] = useState<MarketSummary[]>([]);
  const [selectedMarketSymbol, setSelectedMarketSymbol] = useState(DEFAULT_MARKET_SYMBOL);
  const [buyerFeeRatePercent, setBuyerFeeRatePercent] = useState("0.1");
  const [sellerFeeRatePercent, setSellerFeeRatePercent] = useState("0.1");
  const [note, setNote] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingFeeAction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedMarket =
    markets.find((market) => market.marketSymbol === selectedMarketSymbol) ?? null;
  const baseSymbol = selectedMarket?.baseAssetSymbol ?? "BASE";
  const quoteSymbol = selectedMarket?.quoteAssetSymbol ?? "QUOTE";

  useEffect(() => {
    let active = true;

    async function loadMarkets() {
      try {
        const marketResponse = await apiRequest<MarketSummary[]>("/markets/summary");
        if (!active) {
          return;
        }

        setMarkets(marketResponse);
        setSelectedMarketSymbol((current) =>
          marketResponse.some((market) => market.marketSymbol === current)
            ? current
            : marketResponse[0]?.marketSymbol ?? DEFAULT_MARKET_SYMBOL,
        );
      } catch {
        if (active) {
          setMarkets([]);
        }
      }
    }

    void loadMarkets();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    void loadSettings(selectedMarketSymbol);
  }, [selectedMarketSymbol]);

  async function loadSettings(marketSymbol: string) {
    try {
      setIsLoading(true);
      const response = await apiRequest<FeeSettingsResponse>(
        `/admin/fee-settings?marketSymbol=${encodeURIComponent(marketSymbol)}`,
      );
      setSettings(response);
      setBuyerFeeRatePercent(response.buyerFeeRatePercent);
      setSellerFeeRatePercent(response.sellerFeeRatePercent);
      setNote("");
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : "Unable to load fee settings.");
    } finally {
      setIsLoading(false);
    }
  }

  async function submitFeeUpdate() {
    if (!pendingAction) {
      return;
    }

    try {
      setIsSaving(true);
      const response = await apiRequest<FeeSettingsResponse>("/admin/fee-settings", {
        method: "PATCH",
        body: {
          marketSymbol: pendingAction.marketSymbol,
          buyerFeeRatePercent: pendingAction.buyerFeeRatePercent.trim(),
          sellerFeeRatePercent: pendingAction.sellerFeeRatePercent.trim(),
          ...(pendingAction.note.trim() ? { note: pendingAction.note.trim() } : {}),
        },
      });

      setSettings(response);
      setBuyerFeeRatePercent(response.buyerFeeRatePercent);
      setSellerFeeRatePercent(response.sellerFeeRatePercent);
      setNote("");
      setPendingAction(null);
      setSuccess("Fee settings saved. Changes apply only to future trades.");
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : "Unable to update fee settings.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setPendingAction({
      marketSymbol: selectedMarketSymbol,
      buyerFeeRatePercent,
      sellerFeeRatePercent,
      note,
    });
  }

  const feeBalances = settings?.feeWallet.balances ?? [];
  const quoteBalance = findBalance(feeBalances, quoteSymbol);
  const baseBalance = findBalance(feeBalances, baseSymbol);
  const confirmation = useMemo(() => {
    if (!pendingAction || !settings) {
      return null;
    }

    return buildFeeConfirmation(pendingAction, settings, isSaving);
  }, [pendingAction, settings, isSaving]);

  return (
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Admin Fees"
            title="Trading fee control"
            description="Review selected market fee context, collected fee balances, and confirm fee changes before they affect future trades."
            action={<StatusBadge label="Live" tone="success" />}
          />

          {error ? <AdminNotice tone="danger" message={error} /> : null}
          {success ? <AdminNotice tone="success" message={success} /> : null}
          {isLoading ? <AdminNotice tone="info" message="Loading fee settings..." /> : null}

          <section className="panel rounded-3xl p-5">
            <div className="grid gap-4 md:grid-cols-[minmax(220px,1fr)_auto_auto]">
              <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                Market
                <select
                  value={selectedMarketSymbol}
                  onChange={(event) => setSelectedMarketSymbol(event.target.value)}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                >
                  {markets.map((market) => (
                    <option key={market.marketSymbol} value={market.marketSymbol}>
                      {market.marketSymbol}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <StatusBadge label={settings?.marketSymbol ?? selectedMarketSymbol} tone="info" />
              </div>
              <div className="flex items-end">
                <StatusBadge label={`Max ${settings?.maxFeeRateHuman ?? "5%"}`} tone="warning" />
              </div>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-4">
            <StatCard
              label="Buyer Fee"
              badgeLabel={baseSymbol}
              value={settings?.buyerFeeRateHuman ?? "—"}
              hint="Charged from base asset received by buyers."
              tone="success"
              extra={
                <p className="text-xs text-[var(--foreground-muted)]">
                  {settings ? `${settings.buyerFeeRateBps} bps` : "—"}
                </p>
              }
            />
            <StatCard
              label="Seller Fee"
              badgeLabel={quoteSymbol}
              value={settings?.sellerFeeRateHuman ?? "—"}
              hint="Charged from quote asset received by sellers."
              tone="warning"
              extra={
                <p className="text-xs text-[var(--foreground-muted)]">
                  {settings ? `${settings.sellerFeeRateBps} bps` : "—"}
                </p>
              }
            />
            <StatCard
              label={`Fee ${baseSymbol}`}
              badgeLabel="FEE"
              value={`${baseBalance?.available ?? "0"} ${baseSymbol}`}
              hint="Collected buyer fees for the selected market base asset."
              tone="info"
            />
            <StatCard
              label={`Fee ${quoteSymbol}`}
              badgeLabel="FEE"
              value={`${quoteBalance?.available ?? "0"} ${quoteSymbol}`}
              hint="Collected seller fees for the selected market quote asset."
              tone="info"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <section className="panel rounded-3xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                    {selectedMarketSymbol}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
                    Update fee rates
                  </h2>
                </div>
                <StatusBadge
                  label={selectedMarket?.status ?? "ACTIVE"}
                  tone={selectedMarket?.status === "PAUSED" ? "warning" : "success"}
                />
              </div>

              <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
                <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                  Buyer fee rate percent
                  <input
                    value={buyerFeeRatePercent}
                    onChange={(event) => setBuyerFeeRatePercent(event.target.value)}
                    placeholder="0.1"
                    inputMode="decimal"
                    className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                  />
                </label>

                <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                  Seller fee rate percent
                  <input
                    value={sellerFeeRatePercent}
                    onChange={(event) => setSellerFeeRatePercent(event.target.value)}
                    placeholder="0.1"
                    inputMode="decimal"
                    className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                  />
                </label>

                <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                  Audit note
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Reason for changing fees"
                    rows={3}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                  />
                </label>

                <AdminNotice
                  tone="info"
                  message="Rates are stored as basis points. Changes affect future trades only and do not rewrite historical fee amounts."
                />

                <button
                  type="submit"
                  disabled={isSaving || isLoading}
                  className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : "Review fee changes"}
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
                    <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
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
                  <AssetIdentity
                    key={`${balance.asset}-fee-balance`}
                    symbol={balance.asset}
                    name={balance.name}
                    displayName={balance.displayName}
                    iconUrl={balance.iconUrl}
                  />,
                  balance.available,
                  balance.locked,
                  balance.total,
                ])}
              />

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--foreground-soft)]">
                Last updated: {formatDateTime(settings?.updatedAt)}
              </div>
            </section>
          </div>
        </div>

        <AdminConfirmationDialog
          confirmation={
            confirmation
              ? {
                  ...confirmation,
                  noteValue: pendingAction?.note ?? "",
                  onNoteChange: (value) =>
                    setPendingAction((current) => (current ? { ...current, note: value } : current)),
                }
              : null
          }
          isSubmitting={isSaving}
          onCancel={() => {
            if (!isSaving) {
              setPendingAction(null);
            }
          }}
          onConfirm={() => void submitFeeUpdate()}
        />
      </AppShell>
    </ProtectedRoute>
  );
}

function findBalance(balances: WalletBalance[], asset: string) {
  return balances.find((balance) => balance.asset === asset);
}

function buildFeeConfirmation(
  pendingAction: PendingFeeAction,
  settings: FeeSettingsResponse,
  isSubmitting: boolean,
): AdminConfirmationView {
  return {
    eyebrow: "Confirm Fee Update",
    title: `Save fees for ${pendingAction.marketSymbol}?`,
    description:
      "This updates fee rates for future trades on the selected market only. Historical trades keep the fee amounts charged at execution time.",
    confirmLabel: isSubmitting ? "Saving..." : "Confirm save",
    tone: "warning",
    details: [
      { label: "Market", value: pendingAction.marketSymbol },
      { label: "Current buyer fee", value: `${settings.buyerFeeRateHuman} (${settings.buyerFeeRateBps} bps)` },
      { label: "Next buyer fee", value: `${pendingAction.buyerFeeRatePercent}%` },
      { label: "Current seller fee", value: `${settings.sellerFeeRateHuman} (${settings.sellerFeeRateBps} bps)` },
      { label: "Next seller fee", value: `${pendingAction.sellerFeeRatePercent}%` },
    ],
    impacts: [
      "Buyer fees remain charged from base asset received by buyers.",
      "Seller fees remain charged from quote asset received by sellers.",
      "Only future trades use the new rates; historical trades stay unchanged.",
    ],
    warning: "Fee math, basis-point storage, and settlement destinations remain unchanged.",
    noteLabel: "Audit note (optional)",
    notePlaceholder: "Reason for changing fees",
  };
}
