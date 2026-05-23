"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { AssetIcon } from "@/components/ui/asset-icon";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest, ApiError } from "@/lib/api-client";
import type { MarketSummary, OrderSide, TradeEntry } from "@/lib/api-types";
import { formatDateTime, shortId } from "@/lib/format";
import { TRADE_HISTORY_COPY } from "@/lib/milestone-copy";

export default function TradesPage() {
  const [trades, setTrades] = useState<TradeEntry[]>([]);
  const [markets, setMarkets] = useState<MarketSummary[]>([]);
  const [marketFilter, setMarketFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadTrades() {
      try {
        setIsLoading(true);
        const query = marketFilter ? `?marketSymbol=${encodeURIComponent(marketFilter)}` : "";
        const [tradeResponse, marketResponse] = await Promise.all([
          apiRequest<TradeEntry[]>(`/trades/me${query}`),
          apiRequest<MarketSummary[]>("/markets/summary"),
        ]);
        if (active) {
          setTrades(tradeResponse);
          setMarkets(marketResponse);
          setError(null);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof ApiError ? loadError.message : "Unable to load trades.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadTrades();

    return () => {
      active = false;
    };
  }, [marketFilter]);

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Trades"
            title="Executed trade history"
            description={TRADE_HISTORY_COPY}
            action={<StatusBadge label="v0.14.1 Live" tone="success" />}
          />

          <MarketFilter
            markets={markets}
            value={marketFilter}
            onChange={setMarketFilter}
          />

          {error ? <Notice tone="danger" message={error} /> : null}
          {isLoading ? <Notice tone="info" message="Loading trades..." /> : null}

          {!isLoading && !error ? (
            trades.length > 0 ? (
              <DataTable
                columns={["Time", "Trade ID", "Market", "Side", "Price", "Amount", "Total", "Fee"]}
                rows={trades.map((trade) => [
                  formatDateTime(trade.createdAt),
                  shortId(trade.id),
                  <MarketCell key={`${trade.id}-market`} marketSymbol={trade.marketSymbol} />,
                  <SideText key={`${trade.id}-side`} side={trade.side ?? "BUY"} />,
                  trade.price,
                  trade.amount,
                  trade.quoteAmount,
                  trade.feeAssetSymbol ? `${trade.fee ?? "0"} ${trade.feeAssetSymbol}` : "-",
                ])}
              />
            ) : (
              <Notice tone="info" message="No completed trades yet." />
            )
          ) : null}

          <div className="rounded-2xl border border-emerald-300/16 bg-emerald-300/8 px-4 py-3 text-sm text-emerald-100">
            Fees are live. Buyer fees are charged in the traded base asset and seller fees are charged in the quote asset at execution time.
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function MarketFilter({
  markets,
  value,
  onChange,
}: {
  markets: MarketSummary[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="panel rounded-3xl p-4">
      <label className="grid max-w-xs gap-2 text-sm text-[var(--foreground-soft)]">
        Market
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
        >
          <option value="">All markets</option>
          {markets.map((market) => (
            <option key={market.marketSymbol} value={market.marketSymbol}>
              {market.marketSymbol}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function SideText({ side }: { side: OrderSide }) {
  return (
    <span className={side === "BUY" ? "text-emerald-300" : "text-rose-300"}>{side}</span>
  );
}

function MarketCell({ marketSymbol }: { marketSymbol: string }) {
  const [baseSymbol, quoteSymbol] = marketSymbol.split("/");

  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex -space-x-2">
        <AssetIcon symbol={baseSymbol ?? "SWL"} size={24} />
        <AssetIcon symbol={quoteSymbol ?? "SWC"} size={24} />
      </span>
      <span className="font-medium text-white">{marketSymbol}</span>
    </span>
  );
}

function Notice({ tone, message }: { tone: "info" | "danger"; message: string }) {
  const classes =
    tone === "danger"
      ? "border-rose-300/20 bg-rose-300/10 text-rose-100"
      : "border-blue-300/20 bg-blue-300/10 text-blue-100";

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${classes}`}>{message}</div>;
}
