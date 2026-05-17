"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { AssetIcon } from "@/components/ui/asset-icon";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest } from "@/lib/api-client";
import type { MarketSummary } from "@/lib/api-types";
import { REAL_TIME_SYNC_COPY } from "@/lib/milestone-copy";

const POLL_INTERVAL_MS = 5000;

export default function MarketsPage() {
  const [markets, setMarkets] = useState<MarketSummary[]>([]);

  useEffect(() => {
    let active = true;

    async function loadMarkets() {
      try {
        const response = await apiRequest<MarketSummary[]>("/markets/summary");
        if (active) {
          setMarkets(response);
        }
      } catch {
        if (active) {
          setMarkets([]);
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

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          eyebrow="Markets"
          title="Exchange markets"
          description={`SW Exchange v0.x supports multiple seeded internal spot markets. Limit orders and the order book are live. ${REAL_TIME_SYNC_COPY}`}
        />

        <DataTable
          columns={["Market", "Last Price", "24h Change", "24h Volume", "Best Bid", "Best Ask", "Status", "Action"]}
          rows={markets.length > 0 ? markets.map((market) => [
              <div key={`${market.marketSymbol}-market`} className="flex items-center gap-2">
                <span className="flex -space-x-2">
                  <AssetIcon
                    symbol={market.baseAssetSymbol}
                    name={market.baseAssetDisplayName ?? market.baseAssetName}
                    iconUrl={market.baseAssetIconUrl}
                    size={28}
                  />
                  <AssetIcon
                    symbol={market.quoteAssetSymbol}
                    name={market.quoteAssetDisplayName ?? market.quoteAssetName}
                    iconUrl={market.quoteAssetIconUrl}
                    size={28}
                  />
                </span>
                <span className="space-y-1">
                  <span className="block font-medium text-white">{market.marketSymbol}</span>
                  <span className="block text-xs uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                    Spot
                  </span>
                </span>
              </div>,
              formatValue(market.lastPrice, market.quoteAssetSymbol),
              <span
                key={`${market.marketSymbol}-change`}
                className={changeToneClass(market.change24hPercent)}
              >
                {formatPercent(market.change24hPercent)}
              </span>,
              formatValue(market.volume24h, market.baseAssetSymbol),
              formatValue(market.bestBid, market.quoteAssetSymbol),
              formatValue(market.bestAsk, market.quoteAssetSymbol),
              <StatusBadge
                key={`${market.marketSymbol}-status`}
                label={market.status}
                tone={market.status === "ACTIVE" ? "success" : "warning"}
              />,
              <Link
                key={`${market.marketSymbol}-trade`}
                href={`/trade?market=${encodeURIComponent(market.marketSymbol)}`}
                className="rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--accent-strong)] transition hover:border-[var(--accent-strong)]"
              >
                Trade
              </Link>,
            ]) : [
              [
                <div key="fallback-market" className="flex items-center gap-2">
                  <span className="flex -space-x-2">
                    <AssetIcon symbol="SWL" name="SW LUNA" size={28} />
                    <AssetIcon symbol="SWC" name="SW Cash" size={28} />
                  </span>
                  <span className="space-y-1">
                    <span className="block font-medium text-white">SWL/SWC</span>
                    <span className="block text-xs uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                      Spot
                    </span>
                  </span>
                </div>,
                "—",
                "—",
                "—",
                "—",
                "—",
                <StatusBadge key="fallback-status" label="Unknown" tone="neutral" />,
                "—",
              ],
            ]}
        />
      </div>
    </AppShell>
  );
}

function formatValue(value: string | null | undefined, suffix: string) {
  if (!value) {
    return "—";
  }

  return `${value} ${suffix}`;
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
