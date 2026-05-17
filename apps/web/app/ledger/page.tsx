"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { AssetIdentity } from "@/components/ui/asset-icon";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest, ApiError } from "@/lib/api-client";
import type { LedgerEntry } from "@/lib/api-types";
import { formatDateTime, shortId } from "@/lib/format";

export default function LedgerPage() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [assetFilter, setAssetFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadLedger() {
      try {
        setIsLoading(true);
        const response = await apiRequest<LedgerEntry[]>("/ledger/me");
        if (active) {
          setEntries(response);
          setError(null);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof ApiError
              ? loadError.message
              : "Unable to load ledger entries.",
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadLedger();

    return () => {
      active = false;
    };
  }, []);

  const assetOptions = uniqueOptions(entries.map((entry) => entry.asset));
  const typeOptions = uniqueOptions(entries.map((entry) => entry.type));
  const filteredEntries = entries.filter((entry) => {
    if (assetFilter !== "ALL" && entry.asset !== assetFilter) {
      return false;
    }

    if (typeFilter !== "ALL" && entry.type !== typeFilter) {
      return false;
    }

    return true;
  });

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Ledger"
            title="Balance change ledger"
            description="Review your accounting trail for wallet balance changes, including order locks, trade settlement, trading fees, and better-price unlocks."
            action={<StatusBadge label="Accounting" tone="info" />}
          />

          {error ? <Notice tone="danger" message={error} /> : null}
          {isLoading ? <Notice tone="info" message="Loading ledger entries..." /> : null}

          {!isLoading && !error ? (
            entries.length > 0 ? (
              <div className="space-y-4">
                <FilterBar
                  assetFilter={assetFilter}
                  typeFilter={typeFilter}
                  assetOptions={assetOptions}
                  typeOptions={typeOptions}
                  onAssetFilterChange={setAssetFilter}
                  onTypeFilterChange={setTypeFilter}
                />
                {filteredEntries.length > 0 ? (
                  <DataTable
                    columns={[
                      "Time",
                      "Type",
                      "Asset",
                      "Amount",
                      "Available After",
                      "Locked After",
                      "Reference",
                      "Note",
                    ]}
                    rows={filteredEntries.map((entry) => [
                      formatDateTime(entry.createdAt),
                      <StatusBadge
                        key={`${entry.id}-type`}
                        label={entry.type}
                        tone={ledgerTypeTone(entry.type)}
                      />,
                      <AssetIdentity
                        key={`${entry.id}-asset`}
                        symbol={entry.asset}
                        name={entry.assetName}
                        displayName={entry.assetDisplayName ?? entry.displayName}
                        iconUrl={entry.assetIconUrl ?? entry.iconUrl}
                      />,
                      <AmountText key={`${entry.id}-amount`} value={entry.amount} />,
                      entry.availableAfter,
                      entry.lockedAfter,
                      formatReference(entry),
                      ledgerNote(entry),
                    ])}
                  />
                ) : (
                  <Notice tone="info" message="No ledger entries match the selected filters." />
                )}
              </div>
            ) : (
              <Notice
                tone="info"
                message="No ledger entries yet. Airdrops, internal transfers, order locks, trades, and fees will appear here."
              />
            )
          ) : null}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function Notice({ tone, message }: { tone: "info" | "danger"; message: string }) {
  const classes =
    tone === "danger"
      ? "border-rose-300/20 bg-rose-300/10 text-rose-100"
      : "border-blue-300/20 bg-blue-300/10 text-blue-100";

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${classes}`}>{message}</div>;
}

function ledgerTypeTone(type: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (
    type === "ORDER_LOCK" ||
    type === "TRANSFER_OUT" ||
    type === "FEE" ||
    type === "ADMIN_BUCKET_TRANSFER_OUT"
  ) {
    return "warning";
  }

  if (
    type === "ORDER_UNLOCK" ||
    type === "ORDER_REFUND" ||
    type === "TRANSFER_IN" ||
    type === "ADMIN_BUCKET_TRANSFER_IN"
  ) {
    return "info";
  }

  if (type === "AIRDROP" || type === "TRADE_BUY" || type === "TRADE_SELL" || type === "FEE_INCOME") {
    return "success";
  }

  return "neutral";
}

function ledgerNote(entry: LedgerEntry) {
  if (entry.type === "TRADE_BUY") {
    return entry.asset === "SWL" ? "Bought SWL from a matched limit order." : "Buy-side settlement.";
  }

  if (entry.type === "TRADE_SELL") {
    return "Sold SWL and received SWC.";
  }

  if (entry.type === "FEE") {
    return entry.amount.startsWith("+") ? "Fee income credited." : "Trading fee charged.";
  }

  if (entry.type === "ORDER_UNLOCK") {
    return entry.note?.includes("Better price")
      ? "Better-price refund/unlock."
      : "Remaining locked balance unlocked.";
  }

  return entry.note ?? "-";
}

function AmountText({ value }: { value: string }) {
  const classes = value.startsWith("+")
    ? "text-emerald-300"
    : value.startsWith("-")
      ? "text-rose-300"
      : "text-white";

  return <span className={`font-semibold tabular-nums ${classes}`}>{value}</span>;
}

function FilterBar({
  assetFilter,
  typeFilter,
  assetOptions,
  typeOptions,
  onAssetFilterChange,
  onTypeFilterChange,
}: {
  assetFilter: string;
  typeFilter: string;
  assetOptions: string[];
  typeOptions: string[];
  onAssetFilterChange: (value: string) => void;
  onTypeFilterChange: (value: string) => void;
}) {
  return (
    <div className="panel rounded-3xl p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <FilterSelect label="Asset" value={assetFilter} options={assetOptions} onChange={onAssetFilterChange} />
        <FilterSelect label="Type" value={typeFilter} options={typeOptions} onChange={onTypeFilterChange} />
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
      >
        <option value="ALL">All {label.toLowerCase()}s</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function uniqueOptions(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function formatReference(entry: LedgerEntry) {
  return `${entry.refType}: ${shortId(entry.refId)}`;
}
