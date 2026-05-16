"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest, ApiError } from "@/lib/api-client";
import type { AdminTradeEntry } from "@/lib/api-types";
import { formatDateTime, shortId } from "@/lib/format";
import { ADMIN_TRADE_REVIEW_COPY } from "@/lib/milestone-copy";

export default function AdminTradesPage() {
  const [trades, setTrades] = useState<AdminTradeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadTrades() {
      try {
        setIsLoading(true);
        const response = await apiRequest<AdminTradeEntry[]>("/admin/trades");
        if (active) {
          setTrades(response);
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
  }, []);

  return (
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Admin Trades"
            title="Trade review"
            description={ADMIN_TRADE_REVIEW_COPY}
            action={<StatusBadge label="v0.7 Live" tone="success" />}
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
                  trade.marketSymbol,
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

function UserCell({ username, email }: { username: string; email: string }) {
  return (
    <div className="space-y-1">
      <p className="font-medium text-white">{username}</p>
      <p className="text-xs text-[var(--foreground-muted)]">{email}</p>
    </div>
  );
}

function Notice({ tone, message }: { tone: "info" | "danger"; message: string }) {
  const classes =
    tone === "danger"
      ? "border-rose-300/20 bg-rose-300/10 text-rose-100"
      : "border-blue-300/20 bg-blue-300/10 text-blue-100";

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${classes}`}>{message}</div>;
}
