"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { AssetIdentity } from "@/components/ui/asset-icon";
import { DataTable } from "@/components/ui/data-table";
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

export default function AdminMarketsPage() {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const [summaries, setSummaries] = useState<MarketSummary[]>([]);
  const [form, setForm] = useState(INITIAL_CREATE_MARKET_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
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

  async function updateMarketStatus(market: MarketRow, status: MarketStatus) {
    const noteInput = window.prompt(`Optional audit note for ${status.toLowerCase()} ${market.symbol}:`);
    if (noteInput === null) {
      return;
    }

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
            ...(noteInput.trim() ? { note: noteInput.trim() } : {}),
          },
        },
      );

      setMarkets((currentMarkets) =>
        currentMarkets.map((currentMarket) =>
          currentMarket.id === updatedMarket.id ? updatedMarket : currentMarket,
        ),
      );
      setSummaries((currentSummaries) =>
        currentSummaries.map((currentMarket) =>
          currentMarket.marketSymbol === updatedMarket.symbol
            ? { ...currentMarket, status: updatedMarket.status }
            : currentMarket,
        ),
      );
      setSuccess(`${updatedMarket.symbol} market is now ${updatedMarket.status}.`);
    } catch (updateError) {
      setError(
        updateError instanceof ApiError ? updateError.message : "Unable to update market status.",
      );
    } finally {
      setUpdatingKey(null);
    }
  }

  return (
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Admin Markets"
            title="Market registry"
            description="Create spot markets from listed base and quote assets. New pairs start empty and inherit the existing matching, fee, ticker, and valuation foundation."
            action={<StatusBadge label="Live" tone="success" />}
          />

          {error ? <Notice tone="danger" message={error} /> : null}
          {success ? <Notice tone="success" message={success} /> : null}
          {isLoading ? <Notice tone="info" message="Loading market controls..." /> : null}

          <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
            <section className="panel rounded-3xl p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                    Create Market
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">List a trading pair</h2>
                </div>
                <StatusBadge label={form.status} tone={form.status === "ACTIVE" ? "success" : "warning"} />
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

                <div className="rounded-2xl border border-[var(--notice-info-border)] bg-[var(--notice-info-bg)] px-4 py-3 text-sm text-[var(--notice-info-text)]">
                  Active markets require both assets to already be ACTIVE. New markets start with no fake trades, no seeded order book, and default fee settings until you change them.
                </div>

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
                <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">Existing spot markets</h2>
              </div>

              <div className="mt-5">
                <DataTable
                  columns={["Market", "Base", "Quote", "Status", "Last Price", "Config", "Action"]}
                  rows={markets.map((market) => {
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
                      `P ${market.priceDecimals} / A ${market.amountDecimals} / Min ${market.minOrderAmount ?? "0"} ${
                        market.baseAssetSymbol ?? ""
                      } / Notional ${market.minNotional ?? "0"} ${market.quoteAssetSymbol ?? ""}`,
                      <StatusButton
                        key={`${market.symbol}-action`}
                        label={market.status === "ACTIVE" ? "Pause" : "Resume"}
                        disabled={updatingKey === market.symbol}
                        tone={market.status === "ACTIVE" ? "warning" : "success"}
                        onClick={() =>
                          void updateMarketStatus(
                            market,
                            market.status === "ACTIVE" ? "PAUSED" : "ACTIVE",
                          )
                        }
                      />,
                    ];
                  })}
                />
              </div>
            </section>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function normalizeMarketForm(
  form: typeof INITIAL_CREATE_MARKET_FORM,
  assets: AssetRow[],
) {
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

  const fallbackQuote =
    assets.find((asset) => asset.symbol !== baseAssetSymbol)?.symbol ?? quoteAssetSymbol;

  return {
    ...form,
    baseAssetSymbol,
    quoteAssetSymbol: fallbackQuote,
  };
}

function StatusButton({
  label,
  disabled,
  tone,
  onClick,
}: {
  label: string;
  disabled: boolean;
  tone: "success" | "warning";
  onClick: () => void;
}) {
  const classes =
    tone === "success"
      ? "border-[var(--notice-success-border)] bg-[var(--notice-success-bg)] text-[var(--notice-success-text)] hover:border-[var(--success)]"
      : "border-[var(--notice-warning-border)] bg-[var(--notice-warning-bg)] text-[var(--notice-warning-text)] hover:border-[var(--warning)]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${classes}`}
    >
      {disabled ? "Updating..." : label}
    </button>
  );
}

function Notice({ tone, message }: { tone: "info" | "danger" | "success"; message: string }) {
  const classes =
    tone === "danger"
      ? "border-[var(--notice-danger-border)] bg-[var(--notice-danger-bg)] text-[var(--notice-danger-text)]"
      : tone === "success"
        ? "border-[var(--notice-success-border)] bg-[var(--notice-success-bg)] text-[var(--notice-success-text)]"
        : "border-[var(--notice-info-border)] bg-[var(--notice-info-bg)] text-[var(--notice-info-text)]";

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${classes}`}>{message}</div>;
}
