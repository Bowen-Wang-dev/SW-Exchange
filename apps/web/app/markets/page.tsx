"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
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
          description={`SW Exchange v0.x supports one internal spot market today. Limit orders and the order book are live. ${REAL_TIME_SYNC_COPY}`}
        />

        <DataTable
          columns={["Market", "Last Price", "24h Change", "24h Volume", "Best Bid", "Best Ask", "Status"]}
          rows={markets.length > 0 ? markets.map((market) => [
              <div key={`${market.marketSymbol}-market`} className="space-y-1">
                <p className="font-medium text-white">{market.marketSymbol}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                  Spot
                </p>
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
            ]) : [
              [
                <div key="fallback-market" className="space-y-1">
                  <p className="font-medium text-white">SWL/SWC</p>
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                    Spot
                  </p>
                </div>,
                "—",
                "—",
                "—",
                "—",
                "—",
                <StatusBadge key="fallback-status" label="Unknown" tone="neutral" />,
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
