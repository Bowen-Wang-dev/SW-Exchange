"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { AssetIcon } from "@/components/ui/asset-icon";
import { DataTable } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest } from "@/lib/api-client";
import type { AdminAuditLog, AdminReportsSummary, AdminTradeEntry, AdminTransferEntry } from "@/lib/api-types";
import { formatDateTime, shortId } from "@/lib/format";
import { REAL_TIME_SYNC_COPY } from "@/lib/milestone-copy";
import { useAuth } from "@/providers/auth-provider";

export function AdminDashboardContent() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<AdminReportsSummary | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSummary() {
      try {
        const response = await apiRequest<AdminReportsSummary>("/admin/reports/summary");
        if (active) {
          setSummary(response);
        }
      } catch {
        if (active) {
          setSummary(null);
        }
      }
    }

    void loadSummary();

    return () => {
      active = false;
    };
  }, []);

  const feeSwc = summary?.feeWalletBalances.find((balance) => balance.asset === "SWC");
  const feeSwl = summary?.feeWalletBalances.find((balance) => balance.asset === "SWL");

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Admin Dashboard"
        title={`Admin console: ${user?.username ?? "admin"}`}
        description={`Current milestone: v0.12 Multi-Market Foundation. ${REAL_TIME_SYNC_COPY}`}
        action={<StatusBadge label="Admin Mode" tone="warning" />}
      />

      <div className="grid gap-4 lg:grid-cols-6">
        <StatCard
          label="Total Users"
          badgeLabel="Live"
          value={formatCount(summary?.userCount)}
          hint="Normal non-system users."
          tone="info"
        />
        <StatCard
          label="Active Users"
          badgeLabel="Live"
          value={formatCount(summary?.activeUserCount)}
          hint="Users currently allowed to trade and transfer."
          tone="success"
        />
        <StatCard
          label="Frozen Users"
          badgeLabel="Live"
          value={formatCount(summary?.frozenUserCount)}
          hint="Users blocked from actions without deleting records."
          tone="warning"
        />
        <StatCard
          label="Banned Users"
          badgeLabel="Live"
          value={formatCount(summary?.bannedUserCount)}
          hint="Users fully blocked by admin controls."
          tone="danger"
        />
        <StatCard
          label="Total Wallets"
          badgeLabel="Live"
          value={formatCount(summary?.walletCount)}
          hint="All initialized wallet rows, including admin buckets."
          tone="info"
        />
        <StatCard
          label="Open Orders"
          badgeLabel="Live"
          value={formatCount(summary?.openOrderCount)}
          hint="OPEN and PARTIAL_FILLED limit orders."
          tone="success"
        />
        <StatCard
          label="Last Price"
          badgeLabel={summary?.marketSummary?.marketSymbol ?? "Market"}
          value={formatMarketValue(
            summary?.marketSummary?.lastPrice,
            summary?.marketSummary?.quoteAssetSymbol ?? "SWC",
          )}
          hint="Latest settled trade price; empty until trades exist."
          tone="info"
        />
        <StatCard
          label="24h Volume"
          badgeLabel={summary?.marketSummary?.marketSymbol ?? "Market"}
          value={formatMarketValue(
            summary?.marketSummary?.volume24h,
            summary?.marketSummary?.baseAssetSymbol ?? "",
          )}
          hint="Settled base asset amount traded in the last 24 hours."
          tone="success"
        />
        <StatCard
          label="Total Orders"
          badgeLabel="Live"
          value={formatCount(summary?.orderCount)}
          hint="All persisted limit orders."
          tone="neutral"
        />
        <StatCard
          label="Total Trades"
          badgeLabel="Live"
          value={formatCount(summary?.tradeCount)}
          hint="Settled market fills."
          tone="success"
        />
        <StatCard
          label="Total Transfers"
          badgeLabel="Live"
          value={formatCount(summary?.transferCount)}
          hint="Internal MAIN-to-MAIN transfers."
          tone="info"
        />
        <StatCard
          label="Fee Wallet SWC"
          badgeLabel="FEE"
          value={`${feeSwc?.available ?? "0"} SWC`}
          hint="Seller fees collected into admin FEE wallet."
          tone="warning"
        />
        <StatCard
          label="Fee Wallet SWL"
          badgeLabel="FEE"
          value={`${feeSwl?.available ?? "0"} SWL`}
          hint="Buyer fees collected into admin FEE wallet."
          tone="warning"
        />
        <StatCard
          label="Paused Assets"
          badgeLabel="Live"
          value={formatCount(summary?.pausedAssetCount)}
          hint="Assets paused by admin controls."
          tone="danger"
        />
        <StatCard
          label="Paused Markets"
          badgeLabel="Live"
          value={formatCount(summary?.pausedMarketCount)}
          hint="Markets paused by admin controls."
          tone="danger"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <section className="panel rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                Admin Notice
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">Operational scope</h2>
            </div>
            <StatusBadge label={user?.role ?? "ADMIN"} tone="warning" />
          </div>

          <div className="mt-5 rounded-2xl border border-amber-300/16 bg-amber-300/8 px-4 py-3 text-sm text-amber-100">
            Single full-permission admin mode in v0.x
          </div>

          <div className="data-divider mt-4 rounded-2xl border border-[var(--border)]">
            {[
              "Airdrops update wallet, ledger, and audit records in one transaction.",
              "Internal transfers update both wallets and paired ledger entries in one transaction.",
              "Limit orders lock balances, match at maker prices, and settle through ledger entries.",
              "Trading fees are configurable by admin and settle into the admin Fee Wallet.",
              "User, asset, and market status controls write admin audit logs.",
              "Normal users only have MAIN wallets; admin also has FEE, TREASURY, AIRDROP, and HOT buckets.",
              "Deposit, withdraw, blockchain addresses, and HOT wallet chain behavior remain future work.",
              "Wallet viewer pages are live for both admin and normal users.",
              "All later sensitive actions should map to ledger and audit entries.",
            ].map((item) => (
              <div key={item} className="px-4 py-3 text-sm text-[var(--foreground-soft)]">
                {item}
              </div>
            ))}
          </div>
        </section>

        <DataTable
          columns={["Area", "Status", "Notes"]}
          rows={[
            ["Users", <StatusBadge key="users" label="Live" tone="success" />, "Admin user list endpoint"],
            ["Wallets", <StatusBadge key="wallets" label="Live" tone="success" />, "Seeded asset balances"],
            ["Airdrop", <StatusBadge key="airdrop" label="Enabled" tone="warning" />, "Admin-only seeded asset funding"],
            ["Transfers", <StatusBadge key="transfers" label="Live" tone="success" />, "Free user-to-user internal transfers"],
            ["Orders", <StatusBadge key="orders" label="Live" tone="success" />, "Limit order matching, fills, and cancel review"],
            ["Trades", <StatusBadge key="trades" label="Live" tone="success" />, "Settled market trade review"],
            ["Fees", <StatusBadge key="fees" label="Live" tone="warning" />, "Admin fee settings and Fee Wallet balances"],
            ["Market Data", <StatusBadge key="market-data" label="v0.10" tone="info" />, "Ticker, 24h volume, open orders, and total trades"],
            ["Asset Metadata", <StatusBadge key="asset-metadata" label="v0.11" tone="info" />, "Display names, icon URLs, and clean fallbacks"],
            ["Reports", <StatusBadge key="reports" label="v0.10" tone="info" />, "Summary cards and recent activity"],
            ["Audit", <StatusBadge key="audit" label="Live" tone="info" />, "Airdrop, fee, bucket, and status control audit trail"],
          ]}
        />
      </div>

      <DataTable
        columns={["Market", "Last Price", "24h Volume", "Open Orders", "Total Trades", "Status"]}
        rows={(summary?.marketSummaries?.length ? summary.marketSummaries : []).map((market) => [
          <MarketCell key={`${market.marketSymbol}-market-cell`} marketSymbol={market.marketSymbol} />,
          formatMarketValue(market.lastPrice, market.quoteAssetSymbol),
          formatMarketValue(market.volume24h, market.baseAssetSymbol),
          formatCount(market.openOrderCount),
          formatCount(market.totalTradeCount),
          <StatusBadge
            key={`${market.marketSymbol}-status`}
            label={market.status}
            tone={market.status === "PAUSED" ? "warning" : "success"}
          />,
        ])}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <RecentTrades trades={summary?.recentTrades ?? []} />
        <RecentTransfers transfers={summary?.recentTransfers ?? []} />
        <RecentAuditLogs logs={summary?.recentAuditLogs ?? []} />
      </div>
    </div>
  );
}

function RecentTrades({ trades }: { trades: AdminTradeEntry[] }) {
  return (
    <section className="space-y-3">
      <SectionTitle title="Recent Trades" />
      {trades.length > 0 ? (
        <DataTable
          columns={["Time", "Market", "Price", "Amount"]}
          rows={trades.map((trade) => [
            formatDateTime(trade.createdAt),
            <MarketCell key={`${trade.id}-market`} marketSymbol={trade.marketSymbol} />,
            trade.price,
            `${trade.amount} ${marketBaseSymbol(trade.marketSymbol)}`,
          ])}
        />
      ) : (
        <Notice message="No recent trades." />
      )}
    </section>
  );
}

function marketBaseSymbol(marketSymbol: string) {
  return marketSymbol.split("/")[0] || "";
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

function RecentTransfers({ transfers }: { transfers: AdminTransferEntry[] }) {
  return (
    <section className="space-y-3">
      <SectionTitle title="Recent Transfers" />
      {transfers.length > 0 ? (
        <DataTable
          columns={["Time", "From", "To", "Amount"]}
          rows={transfers.map((transfer) => [
            formatDateTime(transfer.createdAt),
            transfer.from.username,
            transfer.to.username,
            `${transfer.amount} ${transfer.assetSymbol}`,
          ])}
        />
      ) : (
        <Notice message="No recent transfers." />
      )}
    </section>
  );
}

function RecentAuditLogs({ logs }: { logs: AdminAuditLog[] }) {
  return (
    <section className="space-y-3">
      <SectionTitle title="Recent Audit Logs" />
      {logs.length > 0 ? (
        <DataTable
          columns={["Time", "Action", "Target"]}
          rows={logs.map((log) => [
            formatDateTime(log.createdAt),
            <StatusBadge key={`${log.id}-action`} label={log.action} tone="warning" />,
            `${log.targetType}: ${shortId(log.targetId)}`,
          ])}
        />
      ) : (
        <Notice message="No recent audit logs." />
      )}
    </section>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <StatusBadge label="Recent" tone="info" />
    </div>
  );
}

function Notice({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-blue-300/20 bg-blue-300/10 px-4 py-3 text-sm text-blue-100">
      {message}
    </div>
  );
}

function formatCount(value?: number) {
  return typeof value === "number" ? String(value) : "-";
}

function formatMarketValue(value?: string | null, suffix?: string) {
  if (!value) {
    return "—";
  }

  return suffix ? `${value} ${suffix}` : value;
}
