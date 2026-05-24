"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AssetIdentity } from "@/components/ui/asset-icon";
import { StatusBadge } from "@/components/ui/status-badge";
import type { MarketSummary, PortfolioValuationAsset } from "@/lib/api-types";

type AssetSortKey = "value-desc" | "amount-desc" | "symbol-asc" | "available-desc" | "locked-desc";

type PortfolioAssetPanelProps = {
  assets: PortfolioValuationAsset[];
  markets: MarketSummary[];
  storageKey: string;
  title?: string;
  eyebrow?: string;
  emptyMessage?: string;
};

type PortfolioPrefs = {
  sortKey?: AssetSortKey;
  search?: string;
  hideZero?: boolean;
  hideSmall?: boolean;
};

const SORT_OPTIONS: Array<{ value: AssetSortKey; label: string }> = [
  { value: "value-desc", label: "Estimated Value" },
  { value: "amount-desc", label: "Token Amount" },
  { value: "symbol-asc", label: "Symbol A-Z" },
  { value: "available-desc", label: "Available" },
  { value: "locked-desc", label: "Locked" },
];

export function PortfolioAssetPanel({
  assets,
  markets,
  storageKey,
  title = "Asset balances",
  eyebrow = "Portfolio Assets",
  emptyMessage = "No portfolio assets to display yet.",
}: PortfolioAssetPanelProps) {
  const [sortKey, setSortKey] = useState<AssetSortKey>("value-desc");
  const [search, setSearch] = useState("");
  const [hideZero, setHideZero] = useState(true);
  const [hideSmall, setHideSmall] = useState(false);
  const [hasLoadedPrefs, setHasLoadedPrefs] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) {
        return;
      }

      const prefs = JSON.parse(stored) as PortfolioPrefs;
      if (prefs.sortKey && SORT_OPTIONS.some((option) => option.value === prefs.sortKey)) {
        setSortKey(prefs.sortKey);
      }
      if (typeof prefs.search === "string") {
        setSearch(prefs.search);
      }
      if (typeof prefs.hideZero === "boolean") {
        setHideZero(prefs.hideZero);
      }
      if (typeof prefs.hideSmall === "boolean") {
        setHideSmall(prefs.hideSmall);
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    } finally {
      setHasLoadedPrefs(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!hasLoadedPrefs) {
      return;
    }

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ sortKey, search, hideZero, hideSmall }),
    );
  }, [hasLoadedPrefs, hideSmall, hideZero, search, sortKey, storageKey]);

  const marketByBaseAsset = useMemo(() => buildPreferredMarketMap(markets), [markets]);
  const searchedAssets = useMemo(
    () => sortAndFilterAssets(assets, { sortKey, search, hideZero, hideSmall }),
    [assets, hideSmall, hideZero, search, sortKey],
  );
  const hiddenCount = Math.max(0, assets.length - searchedAssets.length);

  return (
    <section className="panel rounded-3xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">{title}</h2>
          <p className="mt-2 text-sm text-[var(--foreground-soft)]">
            Sort, search, and hide dust balances without changing wallet data.
          </p>
        </div>
        <StatusBadge
          label={`${searchedAssets.length}/${assets.length} visible`}
          tone={hiddenCount > 0 ? "warning" : "info"}
        />
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(180px,0.9fr)_minmax(180px,0.8fr)_auto_auto] lg:items-end">
        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
            Search assets
          </span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Symbol or name"
            className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-black/20 px-3 py-2 text-sm text-white outline-none transition placeholder:text-[var(--foreground-muted)] focus:border-[var(--accent)]"
          />
        </label>

        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
            Sort by
          </span>
          <select
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as AssetSortKey)}
            className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-black/20 px-3 py-2 text-sm text-white outline-none transition focus:border-[var(--accent)]"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} className="bg-slate-950">
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <PortfolioToggle
          checked={hideZero}
          label="Hide zero balances"
          onChange={setHideZero}
        />
        <PortfolioToggle
          checked={hideSmall}
          label="Hide < 1 SWC"
          onChange={setHideSmall}
        />
      </div>

      {hiddenCount > 0 ? (
        <p className="mt-3 text-xs text-[var(--foreground-muted)]">
          {hiddenCount} asset{hiddenCount === 1 ? "" : "s"} hidden by the current filters. Clear search or toggles to show all.
        </p>
      ) : null}

      <div className="mt-5 grid gap-3">
        {searchedAssets.length > 0 ? (
          searchedAssets.map((asset) => (
            <PortfolioAssetRow
              key={asset.assetSymbol}
              asset={asset}
              marketSymbol={marketByBaseAsset.get(asset.assetSymbol)}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-[var(--border)] bg-white/[0.02] px-4 py-5 text-sm text-[var(--foreground-muted)]">
            {emptyMessage}
          </div>
        )}
      </div>
    </section>
  );
}

function PortfolioAssetRow({
  asset,
  marketSymbol,
}: {
  asset: PortfolioValuationAsset;
  marketSymbol?: string;
}) {
  const priceLabel =
    asset.assetSymbol === "SWC"
      ? "1 SWC"
      : asset.priceInSWC === null
        ? "Pending"
        : `${asset.priceInSWC} SWC`;
  const valueLabel = asset.valueInSWC === null ? "—" : `${asset.valueInSWC} SWC`;
  const tradeHref = marketSymbol ? `/trade?market=${encodeURIComponent(marketSymbol)}` : null;

  return (
    <article className="rounded-2xl border border-[var(--border)] bg-white/[0.025] px-4 py-3 transition hover:border-white/18 hover:bg-white/[0.04]">
      <div className="grid gap-4 xl:grid-cols-[minmax(180px,1.05fr)_minmax(260px,1.25fr)_minmax(170px,0.75fr)_auto] xl:items-center">
        <AssetIdentity
          symbol={asset.assetSymbol}
          name={asset.assetName}
          displayName={asset.displayName}
          iconUrl={asset.iconUrl}
          size={34}
        />

        <div className="grid gap-2 sm:grid-cols-3">
          <MiniMetric label="Available" value={`${asset.available} ${asset.assetSymbol}`} />
          <MiniMetric label="Locked" value={`${asset.locked} ${asset.assetSymbol}`} />
          <MiniMetric label="Total" value={`${asset.total} ${asset.assetSymbol}`} />
        </div>

        <div className="grid grid-cols-2 gap-2 xl:text-right">
          <MiniMetric label="Price" value={priceLabel} />
          <MiniMetric label="Value" value={valueLabel} emphasis />
        </div>

        <div className="flex items-center xl:justify-end">
          {tradeHref ? (
            <Link
              href={tradeHref}
              className="rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--accent-strong)] transition hover:border-[var(--accent-strong)]"
            >
              Trade
            </Link>
          ) : (
            <span className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--foreground-muted)]">
              No market
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function PortfolioToggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-[42px] items-center gap-2 rounded-2xl border border-[var(--border)] bg-white/[0.02] px-3 py-2 text-sm text-[var(--foreground-soft)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
      />
      <span>{label}</span>
    </label>
  );
}

function MiniMetric({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--foreground-muted)]">{label}</p>
      <p
        className={`mt-1 truncate text-sm ${emphasis ? "font-semibold text-white" : "font-medium text-[var(--foreground-soft)]"}`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function sortAndFilterAssets(
  assets: PortfolioValuationAsset[],
  filters: {
    sortKey: AssetSortKey;
    search: string;
    hideZero: boolean;
    hideSmall: boolean;
  },
) {
  const query = filters.search.trim().toLowerCase();
  const filtered = assets.filter((asset) => {
    const totalRaw = parseRaw(asset.totalRaw);
    if (filters.hideZero && totalRaw === 0n) {
      return false;
    }

    if (filters.hideSmall && asset.valueInSWCRaw !== null) {
      const valueRaw = parseRaw(asset.valueInSWCRaw);
      if (valueRaw < 10n ** 18n) {
        return false;
      }
    }

    if (!query) {
      return true;
    }

    return [asset.assetSymbol, asset.assetName, asset.displayName ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  return [...filtered].sort((a, b) => compareAssets(a, b, filters.sortKey));
}

function compareAssets(a: PortfolioValuationAsset, b: PortfolioValuationAsset, sortKey: AssetSortKey) {
  if (sortKey === "symbol-asc") {
    return a.assetSymbol.localeCompare(b.assetSymbol);
  }

  const rawA =
    sortKey === "amount-desc"
      ? parseRaw(a.totalRaw)
      : sortKey === "available-desc"
        ? parseRaw(a.availableRaw)
        : sortKey === "locked-desc"
          ? parseRaw(a.lockedRaw)
          : parseNullableRaw(a.valueInSWCRaw);
  const rawB =
    sortKey === "amount-desc"
      ? parseRaw(b.totalRaw)
      : sortKey === "available-desc"
        ? parseRaw(b.availableRaw)
        : sortKey === "locked-desc"
          ? parseRaw(b.lockedRaw)
          : parseNullableRaw(b.valueInSWCRaw);

  if (rawA === rawB) {
    return a.assetSymbol.localeCompare(b.assetSymbol);
  }

  return rawB > rawA ? 1 : -1;
}

function parseRaw(value: string | null | undefined) {
  if (!value || !/^-?\d+$/.test(value)) {
    return 0n;
  }

  return BigInt(value);
}

function parseNullableRaw(value: string | null) {
  return value === null ? -1n : parseRaw(value);
}

function buildPreferredMarketMap(markets: MarketSummary[]) {
  const activeMarkets = markets.filter((market) => market.status === "ACTIVE");
  const marketMap = new Map<string, string>();

  for (const market of activeMarkets) {
    if (!marketMap.has(market.baseAssetSymbol) || market.quoteAssetSymbol === "SWC") {
      marketMap.set(market.baseAssetSymbol, market.marketSymbol);
    }
  }

  return marketMap;
}
