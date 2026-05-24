"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { AssetPairIcons } from "@/components/ui/asset-icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest } from "@/lib/api-client";
import type { MarketRow, MarketSummary } from "@/lib/api-types";
import { REAL_TIME_SYNC_COPY } from "@/lib/milestone-copy";

const POLL_INTERVAL_MS = 5000;

type MarketOverviewRow = MarketSummary & {
  createdAt?: string;
  listIndex: number;
};

export default function MarketsPage() {
  const [marketRows, setMarketRows] = useState<MarketRow[]>([]);
  const [marketSummaries, setMarketSummaries] = useState<MarketSummary[]>([]);

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

  const markets = useMemo(
    () => mergeMarkets(marketRows, marketSummaries),
    [marketRows, marketSummaries],
  );
  const activeMarkets = markets.filter((market) => market.status === "ACTIVE");
  const topGainers = [...activeMarkets].sort(compareByChangeDesc).slice(0, 3);
  const newlyListed = [...markets].sort(compareByCreatedAtDesc).slice(0, 3);
  const trending = [...activeMarkets].sort(compareByVolumeDesc).slice(0, 3);

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          eyebrow="Markets"
          title="Exchange markets"
          description={`SW Exchange v0.x supports multiple internal spot markets, including admin-created listings. Explore gainers, new listings, trending pairs, and the full exchange table. ${REAL_TIME_SYNC_COPY}`}
        />

        <div className="grid gap-4 xl:grid-cols-3">
          <MarketSection
            title="Top Gainers"
            description="Highest 24h movers"
            markets={topGainers}
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
              <h2 className="mt-2 text-xl font-semibold text-white">All spot markets</h2>
            </div>
            <StatusBadge label={`${markets.length} Listed`} tone="info" />
          </div>

          <div className="mt-4 overflow-hidden rounded-3xl border border-[var(--border)]">
            <div className="hidden grid-cols-[minmax(0,1.45fr)_minmax(0,0.75fr)_minmax(0,0.7fr)_minmax(0,0.95fr)_minmax(0,0.95fr)_auto] gap-4 border-b border-[var(--border)] bg-white/[0.03] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--foreground-muted)] xl:grid">
              <span>Market</span>
              <span>Last Price</span>
              <span>24h Change</span>
              <span>24h Volume</span>
              <span>Bid / Ask</span>
              <span className="text-right">Trade</span>
            </div>

            <div className="data-divider">
              {markets.length > 0 ? (
                markets.map((market) => (
                  <MarketListRow key={market.marketSymbol} market={market} />
                ))
              ) : (
                <div className="px-4 py-6 text-sm text-[var(--foreground-muted)]">
                  No markets available.
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
              className="grid grid-cols-[minmax(0,1.4fr)_90px_86px] gap-3 border-t border-[var(--border)] px-3 py-2.5 text-sm transition first:border-t-0 hover:bg-white/[0.04]"
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
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-white">{market.marketSymbol}</span>
                  <span className="block truncate text-xs text-[var(--foreground-muted)]">
                    {market.baseAssetDisplayName ?? market.baseAssetName ?? market.baseAssetSymbol}
                    {" / "}
                    {market.quoteAssetDisplayName ?? market.quoteAssetName ?? market.quoteAssetSymbol}
                  </span>
                </span>
              </span>
              <span className="font-medium text-white">
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

function MarketListRow({ market }: { market: MarketOverviewRow }) {
  return (
    <Link
      href={`/trade?market=${encodeURIComponent(market.marketSymbol)}`}
      className={`group block border-t border-[var(--border)] px-4 py-3 text-sm transition first:border-t-0 ${
        market.status === "ACTIVE" ? "bg-white/[0.01] hover:bg-white/[0.05]" : "bg-[var(--accent-soft)]/10 hover:bg-white/[0.05]"
      }`}
    >
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,0.75fr)_minmax(0,0.7fr)_minmax(0,0.95fr)_minmax(0,0.95fr)_auto] xl:items-center xl:gap-4">
        <span className="inline-flex min-w-0 items-center gap-3">
          <AssetPairIcons
            baseSymbol={market.baseAssetSymbol}
            quoteSymbol={market.quoteAssetSymbol}
            baseName={market.baseAssetDisplayName ?? market.baseAssetName}
            quoteName={market.quoteAssetDisplayName ?? market.quoteAssetName}
            baseIconUrl={market.baseAssetIconUrl}
            quoteIconUrl={market.quoteAssetIconUrl}
            size={24}
          />
          <span className="min-w-0">
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="truncate font-semibold text-white">{market.marketSymbol}</span>
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
    </Link>
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
      <span className={`block truncate ${strong ? "font-semibold text-white" : "text-[var(--foreground-soft)]"} ${className}`}>
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

  return value.startsWith("-") ? "text-rose-300" : "text-emerald-300";
}

function compareByChangeDesc(left: MarketOverviewRow, right: MarketOverviewRow) {
  return compareNumbersDesc(right.change24hPercent, left.change24hPercent, left.listIndex - right.listIndex);
}

function compareByVolumeDesc(left: MarketOverviewRow, right: MarketOverviewRow) {
  return compareNumbersDesc(right.volume24h, left.volume24h, left.listIndex - right.listIndex);
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

function renderStatusCell(status: MarketSummary["status"]) {
  if (status === "ACTIVE") {
    return <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">Live</span>;
  }

  return <StatusBadge label={status} tone="warning" />;
}
