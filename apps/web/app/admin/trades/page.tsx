"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { AssetIcon } from "@/components/ui/asset-icon";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest, ApiError } from "@/lib/api-client";
import type { AdminTradeEntry, MarketSummary } from "@/lib/api-types";
import { downloadCsv } from "@/lib/csv";
import { formatDateTime, shortId } from "@/lib/format";
import { ADMIN_TRADE_REVIEW_COPY } from "@/lib/milestone-copy";

export default function AdminTradesPage() {
  const [trades, setTrades] = useState<AdminTradeEntry[]>([]);
  const [markets, setMarkets] = useState<MarketSummary[]>([]);
  const [marketFilter, setMarketFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadTrades() {
      try {
        setIsLoading(true);
        const params = new URLSearchParams();
        if (marketFilter) {
          params.set("marketSymbol", marketFilter);
        }
        if (userFilter.trim()) {
          params.set("user", userFilter.trim());
        }
        const query = params.toString() ? `?${params.toString()}` : "";
        const [tradeResponse, marketResponse] = await Promise.all([
          apiRequest<AdminTradeEntry[]>(`/admin/trades${query}`),
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
  }, [marketFilter, userFilter]);

  function exportTrades() {
    downloadCsv(
      "admin-trades.csv",
      trades.map((trade) => ({
        time: formatDateTime(trade.createdAt),
        tradeId: trade.id,
        market: trade.marketSymbol,
        buyer: trade.buyer.username,
        buyerEmail: trade.buyer.email,
        seller: trade.seller.username,
        sellerEmail: trade.seller.email,
        price: trade.price,
        amount: trade.amount,
        total: trade.quoteAmount,
        buyerFee: `${trade.buyerFee} ${trade.buyerFeeAssetSymbol}`,
        sellerFee: `${trade.sellerFee} ${trade.sellerFeeAssetSymbol}`,
      })),
    );
  }

  return (
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Admin Trades"
            title="Trade review"
            description={ADMIN_TRADE_REVIEW_COPY}
            action={
              <button
                type="button"
                onClick={exportTrades}
                className="rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)] transition hover:border-[var(--accent-strong)]"
              >
                Export CSV
              </button>
            }
          />

          <AdminTradeFilters
            markets={markets}
            marketFilter={marketFilter}
            userFilter={userFilter}
            onMarketFilterChange={setMarketFilter}
            onUserFilterChange={setUserFilter}
          />

          {error ? <Notice tone="danger" message={error} /> : null}
          {isLoading ? <Notice tone="info" message="Loading trades..." /> : null}

          {!isLoading && !error ? (
            trades.length > 0 ? (
              <DataTable
                columns={[
                  "Time",
                  "Trade ID",
                  "Market",
                  "Buyer",
                  "Seller",
                  "Price",
                  "Amount",
                  "Total",
                  "Buyer Fee",
                  "Seller Fee",
                ]}
                rows={trades.map((trade) => [
                  formatDateTime(trade.createdAt),
                  shortId(trade.id),
                  <MarketCell key={`${trade.id}-market`} marketSymbol={trade.marketSymbol} />,
                  <UserCell key={`${trade.id}-buyer`} username={trade.buyer.username} email={trade.buyer.email} />,
                  <UserCell key={`${trade.id}-seller`} username={trade.seller.username} email={trade.seller.email} />,
                  trade.price,
                  trade.amount,
                  trade.quoteAmount,
                  `${trade.buyerFee} ${trade.buyerFeeAssetSymbol}`,
                  `${trade.sellerFee} ${trade.sellerFeeAssetSymbol}`,
                ])}
              />
            ) : (
              <Notice tone="info" message="No trades found." />
            )
          ) : null}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function AdminTradeFilters({
  markets,
  marketFilter,
  userFilter,
  onMarketFilterChange,
  onUserFilterChange,
}: {
  markets: MarketSummary[];
  marketFilter: string;
  userFilter: string;
  onMarketFilterChange: (value: string) => void;
  onUserFilterChange: (value: string) => void;
}) {
  return (
    <div className="panel rounded-3xl p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
          Market
          <select
            value={marketFilter}
            onChange={(event) => onMarketFilterChange(event.target.value)}
            className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
          >
            <option value="">All markets</option>
            {markets.map((market) => (
              <option key={market.marketSymbol} value={market.marketSymbol}>
                {market.marketSymbol}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
          User
          <input
            value={userFilter}
            onChange={(event) => onUserFilterChange(event.target.value)}
            placeholder="username, email, or user ID"
            className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
          />
        </label>
      </div>
    </div>
  );
}

function UserCell({ username, email }: { username: string; email: string }) {
  return (
    <div className="space-y-1">
      <p className="font-medium text-[var(--foreground)]">{username}</p>
      <p className="text-xs text-[var(--foreground-muted)]">{email}</p>
    </div>
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
      <span className="font-medium text-[var(--foreground)]">{marketSymbol}</span>
    </span>
  );
}

function Notice({ tone, message }: { tone: "info" | "danger"; message: string }) {
  const classes =
    tone === "danger"
      ? "border-[var(--notice-danger-border)] bg-[var(--notice-danger-bg)] text-[var(--notice-danger-text)]"
      : "border-[var(--notice-info-border)] bg-[var(--notice-info-bg)] text-[var(--notice-info-text)]";

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${classes}`}>{message}</div>;
}
