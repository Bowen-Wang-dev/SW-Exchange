"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import type { AssetRow, MarketRow, MarketStatus, MarketSummary } from "@/lib/api-types";

const INITIAL_CREATE_MARKET_FORM = {
  baseAssetSymbol: "SWL",
  quoteAssetSymbol: "SWC",
  status: "ACTIVE" as "ACTIVE" | "PAUSED",
  pricePrecision: "",
  amountPrecision: "",
  minOrderAmount: "",
  minNotional: "",
};

type MarketStatusFilter = "ALL" | MarketStatus;

type PendingMarketAction = {
  market: MarketRow;
  status: MarketStatus;
  note: string;
};

export default function AdminMarketsPage() {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const [summaries, setSummaries] = useState<MarketSummary[]>([]);
  const [form, setForm] = useState(INITIAL_CREATE_MARKET_FORM);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<MarketStatusFilter>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingMarketAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void loadPage(active);

    return () => {
      active = false;
    };
  }, []);

  const marketSymbolPreview = useMemo(
    () => `${form.baseAssetSymbol || "BASE"}/${form.quoteAssetSymbol || "QUOTE"}`,
    [form.baseAssetSymbol, form.quoteAssetSymbol],
  );

  const filteredMarkets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return markets.filter((market) => {
      if (statusFilter !== "ALL" && market.status !== statusFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        market.symbol,
        market.baseAssetSymbol ?? "",
        market.quoteAssetSymbol ?? "",
        market.baseAssetName ?? "",
        market.quoteAssetName ?? "",
        market.baseAssetDisplayName ?? "",
        market.quoteAssetDisplayName ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [markets, searchQuery, statusFilter]);

  async function loadPage(active = true) {
    try {
      setIsLoading(true);
      const [assetResponse, marketResponse, summaryResponse] = await Promise.all([
        apiRequest<AssetRow[]>("/assets"),
        apiRequest<MarketRow[]>("/markets"),
        apiRequest<MarketSummary[]>("/markets/summary"),
      ]);

      if (!active) {
        return;
      }

      setAssets(assetResponse);
      setMarkets(marketResponse);
      setSummaries(summaryResponse);
      setError(null);
      setForm((current) => normalizeMarketForm(current, assetResponse));
    } catch (loadError) {
      if (active) {
        setError(loadError instanceof ApiError ? loadError.message : "Unable to load markets.");
      }
    } finally {
      if (active) {
        setIsLoading(false);
      }
    }
  }

  async function handleCreateMarket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.baseAssetSymbol || !form.quoteAssetSymbol) {
      setError("Select both a base asset and a quote asset.");
      return;
    }

    if (form.baseAssetSymbol === form.quoteAssetSymbol) {
      setError("Base and quote assets must be different.");
      return;
    }

    if (form.pricePrecision.trim() && !/^\d+$/.test(form.pricePrecision.trim())) {
      setError("Price precision must be a whole number.");
      return;
    }

    if (form.amountPrecision.trim() && !/^\d+$/.test(form.amountPrecision.trim())) {
      setError("Amount precision must be a whole number.");
      return;
    }

    try {
      setIsCreating(true);
      const createdMarket = await apiRequest<MarketRow>("/admin/markets", {
        method: "POST",
        body: {
          baseAssetSymbol: form.baseAssetSymbol,
          quoteAssetSymbol: form.quoteAssetSymbol,
          symbol: marketSymbolPreview,
          status: form.status,
          ...(form.pricePrecision.trim()
            ? { pricePrecision: Number.parseInt(form.pricePrecision.trim(), 10) }
            : {}),
          ...(form.amountPrecision.trim()
            ? { amountPrecision: Number.parseInt(form.amountPrecision.trim(), 10) }
            : {}),
          ...(form.minOrderAmount.trim() ? { minOrderAmount: form.minOrderAmount.trim() } : {}),
          ...(form.minNotional.trim() ? { minNotional: form.minNotional.trim() } : {}),
        },
      });

      setForm((current) => ({
        ...normalizeMarketForm(INITIAL_CREATE_MARKET_FORM, assets),
        quoteAssetSymbol: current.quoteAssetSymbol,
      }));
      setSuccess(`${createdMarket.symbol} created with default fee settings.`);
      await loadPage();
    } catch (createError) {
      setError(createError instanceof ApiError ? createError.message : "Unable to create market.");
    } finally {
      setIsCreating(false);
    }
  }

  function requestMarketStatusUpdate(market: MarketRow, status: MarketStatus) {
    setPendingAction({
      market,
      status,
      note: "",
    });
  }

  async function confirmMarketStatusUpdate() {
    if (!pendingAction) {
      return;
    }

    const { market, status, note } = pendingAction;

    try {
      setUpdatingKey(market.symbol);
      setError(null);
      setSuccess(null);
      const updatedMarket = await apiRequest<MarketRow>(
        `/admin/markets/${encodeURIComponent(market.symbol)}/status`,
        {
          method: "PATCH",
          body: {
            status,
            ...(note.trim() ? { note: note.trim() } : {}),
          },
        },
      );

      setMarkets((currentMarkets) =>
        currentMarkets.map((currentMarket) =>
          currentMarket.id === updatedMarket.id ? updatedMarket : currentMarket,
        ),
      );
      setSummaries((currentSummaries) =>
        currentSummaries.map((currentSummary) =>
          currentSummary.marketSymbol === updatedMarket.symbol
            ? { ...currentSummary, status: updatedMarket.status }
            : currentSummary,
        ),
      );
      setPendingAction(null);
      setSuccess(`${updatedMarket.symbol} market is now ${updatedMarket.status}.`);
    } catch (updateError) {
      setError(
        updateError instanceof ApiError ? updateError.message : "Unable to update market status.",
      );
    } finally {
      setUpdatingKey(null);
    }
  }

  const confirmation = pendingAction
    ? buildMarketConfirmation(pendingAction, updatingKey === pendingAction.market.symbol)
    : null;

  return (
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Admin Markets"
            title="Market registry"
            description="Create spot markets, review pair configuration, and apply safer pause/resume operations without changing matching rules."
            action={
              <div className="flex flex-wrap gap-2">
                <StatusBadge label="Live" tone="success" />
                <Link
                  href="/admin/fees"
                  className="rounded-2xl border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground-soft)] transition hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
                >
                  Fee Settings
                </Link>
              </div>
            }
          />

          <div className="grid gap-4 lg:grid-cols-4">
            <StatCard
              label="Markets"
              badgeLabel="Loaded"
              value={String(markets.length)}
              hint="Current listed spot markets returned by the API."
              tone="info"
            />
            <StatCard
              label="Active"
              badgeLabel="ACTIVE"
              value={String(markets.filter((market) => market.status === "ACTIVE").length)}
              hint="Markets currently eligible for new orders."
              tone="success"
            />
            <StatCard
              label="Paused"
              badgeLabel="PAUSED"
              value={String(markets.filter((market) => market.status === "PAUSED").length)}
              hint="Paused markets block new orders while allowing cancellation."
              tone="warning"
            />
            <StatCard
              label="With Trades"
              badgeLabel="Summary"
              value={String(summaries.filter((summary) => Number(summary.totalTradeCount ?? 0) > 0).length)}
              hint="Markets with settled trade history in the loaded summaries."
              tone="neutral"
            />
          </div>

          <section className="panel rounded-3xl p-4">
            <div className="grid gap-3 lg:grid-cols-[1.2fr_220px_auto]">
              <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                Search markets
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Pair, base, quote, or asset name"
                  className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                />
              </label>
              <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                Status
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as MarketStatusFilter)}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                >
                  <option value="ALL">All</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PAUSED">PAUSED</option>
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("ALL");
                  }}
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold text-[var(--foreground-soft)] transition hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
                >
                  Clear filters
                </button>
              </div>
            </div>
          </section>

          <AdminNotice
            tone="info"
            message="Paused markets remain viewable and still allow order cancellation, but block new orders and new matching."
          />
          {markets.some((market) => market.status === "PAUSED") ? (
            <AdminNotice
              tone="warning"
              message="Paused markets exist. Review asset-level status separately before resuming pair activity."
            />
          ) : null}
          {error ? <AdminNotice tone="danger" message={error} /> : null}
          {success ? <AdminNotice tone="success" message={success} /> : null}
          {isLoading ? <AdminNotice tone="info" message="Loading market controls..." /> : null}

          <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
            <section className="panel rounded-3xl p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                    Create Market
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
                    List a trading pair
                  </h2>
                </div>
                <StatusBadge
                  label={form.status}
                  tone={form.status === "ACTIVE" ? "success" : "warning"}
                />
              </div>

              <form onSubmit={handleCreateMarket} className="mt-5 grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                    Base asset
                    <select
                      value={form.baseAssetSymbol}
                      onChange={(event) =>
                        setForm((current) =>
                          normalizeMarketForm(
                            { ...current, baseAssetSymbol: event.target.value },
                            assets,
                          ),
                        )
                      }
                      className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                    >
                      {assets.map((asset) => (
                        <option key={`base-${asset.symbol}`} value={asset.symbol}>
                          {asset.symbol} {asset.isActive ? "" : "(PAUSED)"}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                    Quote asset
                    <select
                      value={form.quoteAssetSymbol}
                      onChange={(event) =>
                        setForm((current) =>
                          normalizeMarketForm(
                            { ...current, quoteAssetSymbol: event.target.value },
                            assets,
                          ),
                        )
                      }
                      className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                    >
                      {assets.map((asset) => (
                        <option key={`quote-${asset.symbol}`} value={asset.symbol}>
                          {asset.symbol} {asset.isActive ? "" : "(PAUSED)"}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2 text-sm text-[var(--foreground-soft)] md:col-span-2">
                    Symbol preview
                    <input
                      value={marketSymbolPreview}
                      readOnly
                      className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] outline-none"
                    />
                  </label>

                  <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                    Status
                    <select
                      value={form.status}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          status: event.target.value as "ACTIVE" | "PAUSED",
                        }))
                      }
                      className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="PAUSED">PAUSED</option>
                    </select>
                  </label>

                  <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                    Price precision
                    <input
                      value={form.pricePrecision}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, pricePrecision: event.target.value }))
                      }
                      inputMode="numeric"
                      placeholder="18"
                      className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                    />
                  </label>

                  <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                    Amount precision
                    <input
                      value={form.amountPrecision}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, amountPrecision: event.target.value }))
                      }
                      inputMode="numeric"
                      placeholder="18"
                      className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                    />
                  </label>

                  <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                    Min order amount
                    <input
                      value={form.minOrderAmount}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, minOrderAmount: event.target.value }))
                      }
                      placeholder="0.1"
                      inputMode="decimal"
                      className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                    />
                  </label>

                  <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                    Min notional
                    <input
                      value={form.minNotional}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, minNotional: event.target.value }))
                      }
                      placeholder="1"
                      inputMode="decimal"
                      className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                    />
                  </label>
                </div>

                <AdminNotice
                  tone="info"
                  message="New markets start empty, inherit current matching and fee foundations, and require separate fee review if you want non-default rates."
                />

                <button
                  type="submit"
                  disabled={isCreating}
                  className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCreating ? "Creating market..." : "Create market"}
                </button>
              </form>
            </section>

            <section className="panel rounded-3xl p-5">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                  Market Controls
                </p>
                <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
                  Existing spot markets
                </h2>
              </div>

              <div className="mt-5">
                <DataTable
                  columns={[
                    "Market",
                    "Base",
                    "Quote",
                    "Status",
                    "Last Price",
                    "Config",
                    "Action",
                  ]}
                  rows={filteredMarkets.map((market) => {
                    const summary = summaries.find((item) => item.marketSymbol === market.symbol);

                    return [
                      market.symbol,
                      <AssetIdentity
                        key={`${market.symbol}-base`}
                        symbol={market.baseAssetSymbol ?? "BASE"}
                        name={market.baseAssetName ?? market.baseAssetSymbol ?? "Base Asset"}
                        displayName={market.baseAssetDisplayName}
                        iconUrl={market.baseAssetIconUrl}
                      />,
                      <AssetIdentity
                        key={`${market.symbol}-quote`}
                        symbol={market.quoteAssetSymbol ?? "QUOTE"}
                        name={market.quoteAssetName ?? market.quoteAssetSymbol ?? "Quote Asset"}
                        displayName={market.quoteAssetDisplayName}
                        iconUrl={market.quoteAssetIconUrl}
                      />,
                      <StatusBadge
                        key={`${market.symbol}-status`}
                        label={market.status}
                        tone={market.status === "ACTIVE" ? "success" : "warning"}
                      />,
                      summary?.lastPrice ? `${summary.lastPrice} ${summary.quoteAssetSymbol}` : "—",
                      `P ${market.priceDecimals} / A ${market.amountDecimals} / Min ${market.minOrderAmount ?? "0"} ${market.baseAssetSymbol ?? ""} / Notional ${market.minNotional ?? "0"} ${market.quoteAssetSymbol ?? ""}`,
                      <div key={`${market.symbol}-actions`} className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => requestMarketStatusUpdate(market, market.status === "ACTIVE" ? "PAUSED" : "ACTIVE")}
                          disabled={updatingKey === market.symbol}
                          className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                            market.status === "ACTIVE"
                              ? "border-[var(--notice-warning-border)] bg-[var(--notice-warning-bg)] text-[var(--notice-warning-text)] hover:border-[var(--warning)]"
                              : "border-[var(--notice-success-border)] bg-[var(--notice-success-bg)] text-[var(--notice-success-text)] hover:border-[var(--success)]"
                          }`}
                        >
                          {updatingKey === market.symbol
                            ? "Updating..."
                            : market.status === "ACTIVE"
                              ? "Pause"
                              : "Resume"}
                        </button>
                        <Link
                          href={`/admin/fees?market=${encodeURIComponent(market.symbol)}`}
                          className="rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground-soft)] transition hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
                        >
                          Fees
                        </Link>
                      </div>,
                    ];
                  })}
                />
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
          isSubmitting={Boolean(pendingAction && updatingKey === pendingAction.market.symbol)}
          onCancel={() => {
            if (!updatingKey) {
              setPendingAction(null);
            }
          }}
          onConfirm={() => void confirmMarketStatusUpdate()}
        />
      </AppShell>
    </ProtectedRoute>
  );
}

function normalizeMarketForm(form: typeof INITIAL_CREATE_MARKET_FORM, assets: AssetRow[]) {
  if (assets.length === 0) {
    return form;
  }

  const availableSymbols = assets.map((asset) => asset.symbol);
  const baseAssetSymbol = availableSymbols.includes(form.baseAssetSymbol)
    ? form.baseAssetSymbol
    : assets.find((asset) => asset.symbol !== form.quoteAssetSymbol)?.symbol ?? assets[0]?.symbol ?? "";
  const quoteAssetSymbol = availableSymbols.includes(form.quoteAssetSymbol)
    ? form.quoteAssetSymbol
    : assets.find((asset) => asset.symbol !== baseAssetSymbol)?.symbol ?? assets[0]?.symbol ?? "";

  if (baseAssetSymbol !== quoteAssetSymbol) {
    return { ...form, baseAssetSymbol, quoteAssetSymbol };
  }

  return {
    ...form,
    baseAssetSymbol,
    quoteAssetSymbol:
      assets.find((asset) => asset.symbol !== baseAssetSymbol)?.symbol ?? quoteAssetSymbol,
  };
}

function buildMarketConfirmation(
  pendingAction: PendingMarketAction,
  isSubmitting: boolean,
): AdminConfirmationView {
  const { market, status } = pendingAction;
  const isPausing = status === "PAUSED";

  return {
    eyebrow: "Confirm Market Status",
    title: `${isPausing ? "Pause" : "Resume"} ${market.symbol}?`,
    description: isPausing
      ? "This blocks new orders and new matching for the market while preserving visibility and cancellation paths."
      : "This restores normal new-order eligibility for the selected market.",
    confirmLabel: isSubmitting
      ? isPausing
        ? "Pausing..."
        : "Resuming..."
      : isPausing
        ? "Confirm pause"
        : "Confirm resume",
    tone: isPausing ? "warning" : "success",
    details: [
      { label: "Market", value: market.symbol },
      { label: "Base asset", value: market.baseAssetSymbol ?? "—" },
      { label: "Quote asset", value: market.quoteAssetSymbol ?? "—" },
      { label: "Next status", value: status },
    ],
    impacts: isPausing
      ? [
          "Paused markets block new orders and new matching.",
          "Existing open limit orders remain cancellable so funds can unlock.",
          "Order book, trade history, and market views remain visible.",
        ]
      : [
          "Resumed markets allow new orders and new matching again.",
          "Historical trades, candles, and order records are unchanged.",
          "Asset-level pause rules still apply separately.",
        ],
    warning: isPausing
      ? "Pause the market when the pair should stay reviewable but operationally inactive."
      : "Resuming the market does not override paused asset status for its base or quote asset.",
    noteLabel: "Audit note (optional)",
    notePlaceholder: isPausing ? "Reason for pausing this market" : "Reason for resuming this market",
  };
}
