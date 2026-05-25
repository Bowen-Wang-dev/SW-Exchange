"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { KeyboardEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { AssetPairIcons } from "@/components/ui/asset-icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest } from "@/lib/api-client";
import type { MarketRow, MarketSummary } from "@/lib/api-types";
import { REAL_TIME_SYNC_COPY } from "@/lib/milestone-copy";

const POLL_INTERVAL_MS = 5000;
const MARKET_PREFS_STORAGE_KEY = "swx-market-center-prefs";
const MARKET_FAVORITES_STORAGE_KEY = "swx-market-favorites";

type MarketSortKey =
  | "volume-desc"
  | "change-desc"
  | "price-desc"
  | "symbol-asc"
  | "bid-desc"
  | "ask-desc"
  | "newest-desc";
type MarketStatusFilter = "ALL" | "ACTIVE" | "PAUSED";

type MarketOverviewRow = MarketSummary & {
  createdAt?: string;
  listIndex: number;
};

type MarketPrefs = {
  sortKey?: MarketSortKey;
  quoteFilter?: string;
  statusFilter?: MarketStatusFilter;
  favoritesOnly?: boolean;
};

const MARKET_SORT_OPTIONS: Array<{ value: MarketSortKey; label: string }> = [
  { value: "volume-desc", label: "24h Volume" },
  { value: "change-desc", label: "24h Change" },
  { value: "price-desc", label: "Last Price" },
  { value: "symbol-asc", label: "Symbol A-Z" },
  { value: "bid-desc", label: "Best Bid" },
  { value: "ask-desc", label: "Best Ask" },
  { value: "newest-desc", label: "Newly Listed" },
];

export default function MarketsPage() {
  const [marketRows, setMarketRows] = useState<MarketRow[]>([]);
  const [marketSummaries, setMarketSummaries] = useState<MarketSummary[]>([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<MarketSortKey>("volume-desc");
  const [quoteFilter, setQuoteFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<MarketStatusFilter>("ALL");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favoriteMarkets, setFavoriteMarkets] = useState<string[]>([]);
  const [hasLoadedPrefs, setHasLoadedPrefs] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadMarkets() {
      try {
        const [rowsResponse, summaryResponse] = await Promise.all([
          apiRequest<MarketRow[]>("/markets"),
          apiRequest<MarketSummary[]>("/markets/summary"),
        ]);
        if (active) {
          setMarketRows(rowsResponse);
          setMarketSummaries(summaryResponse);
        }
      } catch {
        if (active) {
          setMarketRows([]);
          setMarketSummaries([]);
        }
      }
    }

    void loadMarkets();
    const intervalId = window.setInterval(() => {
      void loadMarkets();
    }, POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    try {
      const storedPrefs = window.localStorage.getItem(MARKET_PREFS_STORAGE_KEY);
      if (storedPrefs) {
        const prefs = JSON.parse(storedPrefs) as MarketPrefs;
        if (prefs.sortKey && MARKET_SORT_OPTIONS.some((option) => option.value === prefs.sortKey)) {
          setSortKey(prefs.sortKey);
        }
        if (typeof prefs.quoteFilter === "string") {
          setQuoteFilter(prefs.quoteFilter);
        }
        if (prefs.statusFilter && ["ALL", "ACTIVE", "PAUSED"].includes(prefs.statusFilter)) {
          setStatusFilter(prefs.statusFilter);
        }
        if (typeof prefs.favoritesOnly === "boolean") {
          setFavoritesOnly(prefs.favoritesOnly);
        }
      }

      const storedFavorites = window.localStorage.getItem(MARKET_FAVORITES_STORAGE_KEY);
      if (storedFavorites) {
        const favorites = JSON.parse(storedFavorites) as unknown;
        if (Array.isArray(favorites)) {
          setFavoriteMarkets(favorites.filter((item): item is string => typeof item === "string"));
        }
      }
    } catch {
      window.localStorage.removeItem(MARKET_PREFS_STORAGE_KEY);
      window.localStorage.removeItem(MARKET_FAVORITES_STORAGE_KEY);
    } finally {
      setHasLoadedPrefs(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedPrefs) {
      return;
    }

    window.localStorage.setItem(
      MARKET_PREFS_STORAGE_KEY,
      JSON.stringify({ sortKey, quoteFilter, statusFilter, favoritesOnly }),
    );
  }, [favoritesOnly, hasLoadedPrefs, quoteFilter, sortKey, statusFilter]);

  useEffect(() => {
    if (!hasLoadedPrefs) {
      return;
    }

    window.localStorage.setItem(MARKET_FAVORITES_STORAGE_KEY, JSON.stringify(favoriteMarkets));
  }, [favoriteMarkets, hasLoadedPrefs]);

  const markets = useMemo(
    () => mergeMarkets(marketRows, marketSummaries),
    [marketRows, marketSummaries],
  );
  const favoriteSet = useMemo(() => new Set(favoriteMarkets), [favoriteMarkets]);
  const quoteOptions = useMemo(
    () => ["ALL", ...Array.from(new Set(markets.map((market) => market.quoteAssetSymbol).filter(Boolean))).sort()],
    [markets],
  );
  const activeMarkets = markets.filter((market) => market.status === "ACTIVE");
  const favoriteOverviewMarkets = markets
    .filter((market) => favoriteSet.has(market.marketSymbol))
    .sort((left, right) => left.marketSymbol.localeCompare(right.marketSymbol))
    .slice(0, 4);
  const topGainers = [...activeMarkets].sort(compareByChangeDesc).slice(0, 4);
  const topLosers = activeMarkets
    .filter((market) => hasSortableNumber(market.change24hPercent))
    .sort(compareByChangeAsc)
    .slice(0, 4);
  const newlyListed = [...markets].sort(compareByCreatedAtDesc).slice(0, 4);
  const trending = [...activeMarkets].sort(compareByVolumeDesc).slice(0, 4);
  const visibleMarkets = useMemo(
    () =>
      filterAndSortMarkets(markets, {
        search,
        sortKey,
        quoteFilter,
        statusFilter,
        favoritesOnly,
        favoriteSet,
      }),
    [favoriteSet, favoritesOnly, markets, quoteFilter, search, sortKey, statusFilter],
  );
  const hiddenCount = Math.max(0, markets.length - visibleMarkets.length);

  function toggleFavorite(marketSymbol: string) {
    setFavoriteMarkets((current) => {
      if (current.includes(marketSymbol)) {
        return current.filter((symbol) => symbol !== marketSymbol);
      }

      return [...current, marketSymbol].sort();
    });
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          eyebrow="Markets"
          title="Exchange markets"
          description={`SW Exchange v0.x supports multiple internal spot markets, including admin-created listings. Explore gainers, new listings, trending pairs, and the full exchange table. ${REAL_TIME_SYNC_COPY}`}
        />

        <div className="grid gap-4 xl:grid-cols-5">
          {favoriteOverviewMarkets.length > 0 ? (
            <MarketSection
              title="Favorites"
              description="Your local watchlist"
              markets={favoriteOverviewMarkets}
            />
          ) : null}
          <MarketSection
            title="Top Gainers"
            description="Highest 24h movers"
            markets={topGainers}
          />
          <MarketSection
            title="Top Losers"
            description="Weakest 24h movers"
            markets={topLosers}
          />
          <MarketSection
            title="Newly Listed"
            description="Most recent listings"
            markets={newlyListed}
          />
          <MarketSection
            title="Trending"
            description="Highest 24h volume"
            markets={trending}
          />
        </div>

        <section className="panel rounded-3xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
                Market table
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">All spot markets</h2>
            </div>
            <StatusBadge label={`${markets.length} Listed`} tone="info" />
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(190px,1fr)_minmax(170px,0.7fr)_minmax(130px,0.5fr)_minmax(130px,0.5fr)_auto] lg:items-end">
            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                Search markets
              </span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Symbol, asset, or name"
                className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--foreground-muted)] focus:border-[var(--accent)]"
              />
            </label>

            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                Sort by
              </span>
              <select
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as MarketSortKey)}
                className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
              >
                {MARKET_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} className="bg-slate-950">
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                Quote
              </span>
              <select
                value={quoteFilter}
                onChange={(event) => setQuoteFilter(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
              >
                {quoteOptions.map((quote) => (
                  <option key={quote} value={quote} className="bg-slate-950">
                    {quote === "ALL" ? "All quotes" : quote}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                Status
              </span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as MarketStatusFilter)}
                className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
              >
                <option value="ALL" className="bg-slate-950">All</option>
                <option value="ACTIVE" className="bg-slate-950">Active</option>
                <option value="PAUSED" className="bg-slate-950">Paused</option>
              </select>
            </label>

            <label className="flex min-h-[42px] items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 text-sm text-[var(--foreground-soft)]">
              <input
                type="checkbox"
                checked={favoritesOnly}
                onChange={(event) => setFavoritesOnly(event.target.checked)}
                className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
              />
              <span>Favorites only</span>
            </label>
          </div>

          {hiddenCount > 0 ? (
            <p className="mt-3 text-xs text-[var(--foreground-muted)]">
              Showing {visibleMarkets.length} of {markets.length} markets. Clear search or filters to show all.
            </p>
          ) : null}

          <div className="mt-4 overflow-hidden rounded-3xl border border-[var(--border)]">
            <div className="hidden grid-cols-[minmax(0,1.55fr)_minmax(0,0.75fr)_minmax(0,0.7fr)_minmax(0,0.95fr)_minmax(0,0.95fr)_auto] gap-4 border-b border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--foreground-muted)] xl:grid">
              <span>Market</span>
              <span>Last Price</span>
              <span>24h Change</span>
              <span>24h Volume</span>
              <span>Bid / Ask</span>
              <span className="text-right">Trade</span>
            </div>

            <div className="data-divider">
              {visibleMarkets.length > 0 ? (
                visibleMarkets.map((market) => (
                  <MarketListRow
                    key={market.marketSymbol}
                    market={market}
                    isFavorite={favoriteSet.has(market.marketSymbol)}
                    onToggleFavorite={toggleFavorite}
                  />
                ))
              ) : (
                <div className="px-4 py-6 text-sm text-[var(--foreground-muted)]">
                  No markets match the current search and filters.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function MarketSection({
  title,
  description,
  markets,
}: {
  title: string;
  description: string;
  markets: MarketOverviewRow[];
}) {
  return (
    <section className="panel rounded-3xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
            {title}
          </p>
          <p className="mt-2 text-sm text-[var(--foreground-soft)]">{description}</p>
        </div>
        <StatusBadge label={`${markets.length}`} tone="info" />
      </div>

      <div className="data-divider mt-4 overflow-hidden rounded-2xl border border-[var(--border)]">
        {markets.length > 0 ? (
          markets.map((market) => (
            <Link
              key={market.marketSymbol}
              href={`/trade?market=${encodeURIComponent(market.marketSymbol)}`}
            className="grid grid-cols-[minmax(0,1.45fr)_minmax(74px,0.55fr)_minmax(66px,0.45fr)] gap-3 border-t border-[var(--border)] px-3 py-2.5 text-sm transition first:border-t-0 hover:bg-[var(--surface-emphasis)]"
          >
              <span className="inline-flex min-w-0 items-center gap-2">
                <AssetPairIcons
                  baseSymbol={market.baseAssetSymbol}
                  quoteSymbol={market.quoteAssetSymbol}
                  baseName={market.baseAssetDisplayName ?? market.baseAssetName}
                  quoteName={market.quoteAssetDisplayName ?? market.quoteAssetName}
                  baseIconUrl={market.baseAssetIconUrl}
                  quoteIconUrl={market.quoteAssetIconUrl}
                  size={20}
                  quoteSize={18}
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-[var(--foreground)]">{market.marketSymbol}</span>
                  <span className="block truncate text-xs text-[var(--foreground-muted)]">
                    {market.baseAssetDisplayName ?? market.baseAssetName ?? market.baseAssetSymbol}
                    {" / "}
                    {market.quoteAssetDisplayName ?? market.quoteAssetName ?? market.quoteAssetSymbol}
                  </span>
                </span>
              </span>
              <span className="font-medium text-[var(--foreground)]">
                {formatValue(market.lastPrice, market.quoteAssetSymbol)}
              </span>
              <span className={changeToneClass(market.change24hPercent)}>
                {formatPercent(market.change24hPercent)}
              </span>
            </Link>
          ))
        ) : (
          <div className="px-3 py-5 text-sm text-[var(--foreground-muted)]">
            No markets matched this section.
          </div>
        )}
      </div>
    </section>
  );
}

function MarketListRow({
  market,
  isFavorite,
  onToggleFavorite,
}: {
  market: MarketOverviewRow;
  isFavorite: boolean;
  onToggleFavorite: (marketSymbol: string) => void;
}) {
  const router = useRouter();
  const tradeHref = `/trade?market=${encodeURIComponent(market.marketSymbol)}`;

  function openMarket() {
    router.push(tradeHref);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openMarket();
    }
  }

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={openMarket}
      onKeyDown={handleKeyDown}
      className={`group block border-t border-[var(--border)] px-4 py-3 text-sm transition first:border-t-0 ${
        market.status === "ACTIVE" ? "cursor-pointer bg-[var(--surface-faint)] hover:bg-[var(--surface-hover)]" : "cursor-pointer bg-[var(--accent-soft)]/10 hover:bg-[var(--surface-hover)]"
      }`}
    >
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,0.75fr)_minmax(0,0.7fr)_minmax(0,0.95fr)_minmax(0,0.95fr)_auto] xl:items-center xl:gap-4">
        <span className="inline-flex min-w-0 items-center gap-3">
          <button
            type="button"
            aria-label={isFavorite ? `Remove ${market.marketSymbol} from favorites` : `Add ${market.marketSymbol} to favorites`}
            aria-pressed={isFavorite}
            onClick={(event) => {
              event.stopPropagation();
              onToggleFavorite(market.marketSymbol);
            }}
            onKeyDown={(event) => event.stopPropagation()}
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-base transition ${
              isFavorite
                ? "border-[var(--notice-warning-border)] bg-[var(--notice-warning-bg)] text-[var(--notice-warning-text)]"
                : "border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--foreground-muted)] hover:border-[var(--warning)] hover:text-[var(--notice-warning-text)]"
            }`}
          >
            {isFavorite ? "★" : "☆"}
          </button>
          <AssetPairIcons
            baseSymbol={market.baseAssetSymbol}
            quoteSymbol={market.quoteAssetSymbol}
            baseName={market.baseAssetDisplayName ?? market.baseAssetName}
            quoteName={market.quoteAssetDisplayName ?? market.quoteAssetName}
            baseIconUrl={market.baseAssetIconUrl}
            quoteIconUrl={market.quoteAssetIconUrl}
            size={24}
            quoteSize={20}
          />
          <span className="min-w-0">
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="truncate font-semibold text-[var(--foreground)]">{market.marketSymbol}</span>
              {renderStatusCell(market.status)}
            </span>
            <span className="block truncate text-xs text-[var(--foreground-muted)]">
              {market.baseAssetDisplayName ?? market.baseAssetName ?? market.baseAssetSymbol}
              {" / "}
              {market.quoteAssetDisplayName ?? market.quoteAssetName ?? market.quoteAssetSymbol}
            </span>
          </span>
        </span>

        <MarketRowValue label="Last" value={formatValue(market.lastPrice, market.quoteAssetSymbol)} strong />
        <MarketRowValue
          label="24h"
          value={formatPercent(market.change24hPercent)}
          className={changeToneClass(market.change24hPercent)}
        />
        <MarketRowValue
          label="Volume"
          value={`${formatValue(market.volume24h)} ${market.baseAssetSymbol}`}
        />
        <div className="grid grid-cols-2 gap-3 text-[var(--foreground-soft)] xl:block">
          <MarketRowValue label="Bid" value={formatValue(market.bestBid, market.quoteAssetSymbol)} />
          <MarketRowValue label="Ask" value={formatValue(market.bestAsk, market.quoteAssetSymbol)} />
        </div>
        <span className="justify-self-start rounded-full border border-[var(--accent)]/30 px-3 py-1 text-xs font-semibold text-[var(--accent-strong)] transition group-hover:translate-x-0.5 group-hover:bg-[var(--accent-soft)] xl:justify-self-end">
          Trade →
        </span>
      </div>
    </article>
  );
}

function MarketRowValue({
  label,
  value,
  strong = false,
  className = "",
}: {
  label: string;
  value: string;
  strong?: boolean;
  className?: string;
}) {
  return (
    <span className="min-w-0">
      <span className="mb-1 block text-[10px] uppercase tracking-[0.16em] text-[var(--foreground-muted)] xl:hidden">
        {label}
      </span>
      <span className={`block truncate ${strong ? "font-semibold text-[var(--foreground)]" : "text-[var(--foreground-soft)]"} ${className}`}>
        {value}
      </span>
    </span>
  );
}

function mergeMarkets(rows: MarketRow[], summaries: MarketSummary[]): MarketOverviewRow[] {
  const summaryMap = new Map(summaries.map((market) => [market.marketSymbol, market]));

  return rows.map((row, index): MarketOverviewRow => {
    const summary = summaryMap.get(row.symbol);

    return {
      marketSymbol: row.symbol,
      baseAssetSymbol: summary?.baseAssetSymbol ?? row.baseAssetSymbol ?? "",
      quoteAssetSymbol: summary?.quoteAssetSymbol ?? row.quoteAssetSymbol ?? "",
      baseAssetName: summary?.baseAssetName ?? row.baseAssetName ?? "",
      quoteAssetName: summary?.quoteAssetName ?? row.quoteAssetName ?? "",
      baseAssetDisplayName: summary?.baseAssetDisplayName ?? row.baseAssetDisplayName ?? null,
      quoteAssetDisplayName: summary?.quoteAssetDisplayName ?? row.quoteAssetDisplayName ?? null,
      baseAssetIconUrl: summary?.baseAssetIconUrl ?? row.baseAssetIconUrl ?? null,
      quoteAssetIconUrl: summary?.quoteAssetIconUrl ?? row.quoteAssetIconUrl ?? null,
      baseAssetIconSource: summary?.baseAssetIconSource ?? row.baseAssetIconSource ?? null,
      quoteAssetIconSource: summary?.quoteAssetIconSource ?? row.quoteAssetIconSource ?? null,
      lastPrice: summary?.lastPrice ?? null,
      bestBid: summary?.bestBid ?? null,
      bestAsk: summary?.bestAsk ?? null,
      volume24h: summary?.volume24h ?? "0",
      quoteVolume24h: summary?.quoteVolume24h ?? "0",
      change24hPercent: summary?.change24hPercent ?? null,
      openOrderCount: summary?.openOrderCount ?? 0,
      totalTradeCount: summary?.totalTradeCount ?? 0,
      status: summary?.status ?? row.status,
      createdAt: row.createdAt,
      listIndex: index,
    };
  });
}

function formatValue(value: string | null | undefined, suffix?: string) {
  if (!value) {
    return "—";
  }

  return suffix ? `${value} ${suffix}` : value;
}

function formatPercent(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return `${value}%`;
}

function changeToneClass(value: string | null | undefined) {
  if (!value || value === "0") {
    return "text-[var(--foreground-soft)]";
  }

  return value.startsWith("-") ? "text-[var(--danger)]" : "text-[var(--success)]";
}

function compareByChangeDesc(left: MarketOverviewRow, right: MarketOverviewRow) {
  return compareNumbersDesc(left.change24hPercent, right.change24hPercent, left.listIndex - right.listIndex);
}

function compareByChangeAsc(left: MarketOverviewRow, right: MarketOverviewRow) {
  return compareNumbersAsc(left.change24hPercent, right.change24hPercent, left.listIndex - right.listIndex);
}

function compareByVolumeDesc(left: MarketOverviewRow, right: MarketOverviewRow) {
  return compareNumbersDesc(left.volume24h, right.volume24h, left.listIndex - right.listIndex);
}

function compareByCreatedAtDesc(left: MarketOverviewRow, right: MarketOverviewRow) {
  return toTimestamp(right.createdAt) - toTimestamp(left.createdAt) || left.listIndex - right.listIndex;
}

function toTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareNumbersDesc(
  leftValue: string | null | undefined,
  rightValue: string | null | undefined,
  fallback: number,
) {
  const left = toSortableNumber(leftValue);
  const right = toSortableNumber(rightValue);
  const result = right - left;

  return Number.isFinite(result) ? result : fallback;
}

function compareNumbersAsc(
  leftValue: string | null | undefined,
  rightValue: string | null | undefined,
  fallback: number,
) {
  const left = toSortableNumber(leftValue);
  const right = toSortableNumber(rightValue);
  const result = left - right;

  return Number.isFinite(result) ? result : fallback;
}

function toSortableNumber(value: string | null | undefined) {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function hasSortableNumber(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return Number.isFinite(Number(value));
}

function renderStatusCell(status: MarketSummary["status"]) {
  if (status === "ACTIVE") {
    return null;
  }

  return <StatusBadge label={status} tone="warning" />;
}

function filterAndSortMarkets(
  markets: MarketOverviewRow[],
  filters: {
    search: string;
    sortKey: MarketSortKey;
    quoteFilter: string;
    statusFilter: MarketStatusFilter;
    favoritesOnly: boolean;
    favoriteSet: Set<string>;
  },
) {
  const query = filters.search.trim().toLowerCase();
  const filtered = markets.filter((market) => {
    if (filters.favoritesOnly && !filters.favoriteSet.has(market.marketSymbol)) {
      return false;
    }

    if (filters.quoteFilter !== "ALL" && market.quoteAssetSymbol !== filters.quoteFilter) {
      return false;
    }

    if (filters.statusFilter !== "ALL" && market.status !== filters.statusFilter) {
      return false;
    }

    if (!query) {
      return true;
    }

    return [
      market.marketSymbol,
      market.baseAssetSymbol,
      market.quoteAssetSymbol,
      market.baseAssetName ?? "",
      market.quoteAssetName ?? "",
      market.baseAssetDisplayName ?? "",
      market.quoteAssetDisplayName ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  return [...filtered].sort((left, right) => compareMarkets(left, right, filters.sortKey));
}

function compareMarkets(left: MarketOverviewRow, right: MarketOverviewRow, sortKey: MarketSortKey) {
  const fallback = left.marketSymbol.localeCompare(right.marketSymbol);

  if (sortKey === "symbol-asc") {
    return fallback;
  }

  if (sortKey === "change-desc") {
    return compareNumbersDesc(left.change24hPercent, right.change24hPercent, fallback);
  }

  if (sortKey === "price-desc") {
    return compareNumbersDesc(left.lastPrice, right.lastPrice, fallback);
  }

  if (sortKey === "bid-desc") {
    return compareNumbersDesc(left.bestBid, right.bestBid, fallback);
  }

  if (sortKey === "ask-desc") {
    return compareNumbersDesc(left.bestAsk, right.bestAsk, fallback);
  }

  if (sortKey === "newest-desc") {
    return compareByCreatedAtDesc(left, right) || fallback;
  }

  return compareNumbersDesc(left.volume24h, right.volume24h, fallback);
}
