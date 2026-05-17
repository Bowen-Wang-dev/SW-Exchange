"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest, ApiError } from "@/lib/api-client";
import type { AdminLedgerEntry } from "@/lib/api-types";
import { downloadCsv } from "@/lib/csv";
import { formatDateTime, shortId } from "@/lib/format";

export default function AdminLedgerPage() {
  const [entries, setEntries] = useState<AdminLedgerEntry[]>([]);
  const [userFilter, setUserFilter] = useState("");
  const [assetFilter, setAssetFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [walletTypeFilter, setWalletTypeFilter] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadLedger() {
      try {
        setIsLoading(true);
        const response = await apiRequest<AdminLedgerEntry[]>("/admin/ledger");
        if (active) {
          setEntries(response);
          setError(null);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof ApiError ? loadError.message : "Unable to load ledger.");
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
  const walletTypeOptions = uniqueOptions(entries.map((entry) => displayWalletType(entry)));
  const filteredEntries = entries.filter((entry) => {
    const searchText = userFilter.trim().toLowerCase();
    if (searchText && !`${entry.user.username} ${entry.user.email}`.toLowerCase().includes(searchText)) {
      return false;
    }

    if (assetFilter !== "ALL" && entry.asset !== assetFilter) {
      return false;
    }

    if (typeFilter !== "ALL" && entry.type !== typeFilter) {
      return false;
    }

    if (walletTypeFilter !== "ALL" && displayWalletType(entry) !== walletTypeFilter) {
      return false;
    }

    return true;
  });

  function exportFilteredEntries() {
    downloadCsv(
      "admin-ledger.csv",
      filteredEntries.map((entry) => ({
        time: formatDateTime(entry.createdAt),
        owner: ownerLabel(entry),
        email: entry.user.email,
        role: entry.role ?? entry.user.role ?? "",
        walletType: displayWalletType(entry),
        asset: entry.asset,
        type: entry.type,
        amount: entry.amount,
        availableAfter: entry.availableAfter,
        lockedAfter: entry.lockedAfter,
        reference: formatReference(entry),
        note: ledgerNote(entry),
      })),
    );
  }

  return (
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Admin Ledger"
            title="Ledger review"
            description="Inspect wallet balance changes across normal MAIN wallets and admin wallet buckets. Fee income is shown as admin FEE wallet activity."
            action={<StatusBadge label="Source of Truth" tone="info" />}
          />

          {error ? <Notice tone="danger" message={error} /> : null}
          {isLoading ? <Notice tone="info" message="Loading ledger entries..." /> : null}

          {!isLoading && !error ? (
            entries.length > 0 ? (
              <div className="space-y-4">
                <FilterBar
                  userFilter={userFilter}
                  assetFilter={assetFilter}
                  typeFilter={typeFilter}
                  walletTypeFilter={walletTypeFilter}
                  assetOptions={assetOptions}
                  typeOptions={typeOptions}
                  walletTypeOptions={walletTypeOptions}
                  onUserFilterChange={setUserFilter}
                  onAssetFilterChange={setAssetFilter}
                  onTypeFilterChange={setTypeFilter}
                  onWalletTypeFilterChange={setWalletTypeFilter}
                  onExport={exportFilteredEntries}
                />
                {filteredEntries.length > 0 ? (
                  <DataTable
                    columns={[
                      "Time",
                      "User / Owner",
                      "Role",
                      "Wallet Type",
                      "Asset",
                      "Type",
                      "Amount",
                      "Available After",
                      "Locked After",
                      "Reference",
                      "Note",
                    ]}
                    rows={filteredEntries.map((entry) => [
                      formatDateTime(entry.createdAt),
                      <OwnerCell key={`${entry.id}-owner`} entry={entry} />,
                      <StatusBadge
                        key={`${entry.id}-role`}
                        label={entry.role ?? entry.user.role ?? "USER"}
                        tone={(entry.role ?? entry.user.role) === "ADMIN" ? "warning" : "neutral"}
                      />,
                      <StatusBadge
                        key={`${entry.id}-wallet-type`}
                        label={displayWalletType(entry)}
                        tone={walletTypeTone(displayWalletType(entry))}
                      />,
                      <span key={`${entry.id}-asset`} className="font-medium text-white">
                        {entry.asset}
                      </span>,
                      <StatusBadge
                        key={`${entry.id}-type`}
                        label={entry.type}
                        tone={ledgerTypeTone(entry.type)}
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
              <Notice tone="info" message="No ledger entries found." />
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
  if (type === "ORDER_LOCK" || type === "TRANSFER_OUT" || type === "ADMIN_BUCKET_TRANSFER_OUT" || type === "FEE") {
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

function ledgerNote(entry: AdminLedgerEntry) {
  if (entry.type === "TRADE_BUY") {
    return entry.asset === "SWL" ? "Bought SWL from a matched limit order." : "Buy-side settlement.";
  }

  if (entry.type === "TRADE_SELL") {
    return "Sold SWL and received SWC.";
  }

  if (entry.type === "FEE") {
    return entry.amount.startsWith("+") ? "Fee income credited to admin Fee Wallet." : "Trading fee charged.";
  }

  if (entry.type === "ADMIN_BUCKET_TRANSFER_IN" || entry.type === "ADMIN_BUCKET_TRANSFER_OUT") {
    return entry.note ? `Admin bucket movement: ${entry.note}` : "Admin wallet bucket movement.";
  }

  if (entry.type === "ORDER_UNLOCK") {
    return entry.note?.includes("Better price")
      ? "Better-price refund/unlock."
      : "Remaining locked balance unlocked.";
  }

  return entry.note ?? "-";
}

function OwnerCell({ entry }: { entry: AdminLedgerEntry }) {
  return (
    <div className="space-y-1">
      <p className="font-medium text-white">{ownerLabel(entry)}</p>
      <p className="text-xs text-[var(--foreground-muted)]">{entry.user.email}</p>
    </div>
  );
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
  userFilter,
  assetFilter,
  typeFilter,
  walletTypeFilter,
  assetOptions,
  typeOptions,
  walletTypeOptions,
  onUserFilterChange,
  onAssetFilterChange,
  onTypeFilterChange,
  onWalletTypeFilterChange,
  onExport,
}: {
  userFilter: string;
  assetFilter: string;
  typeFilter: string;
  walletTypeFilter: string;
  assetOptions: string[];
  typeOptions: string[];
  walletTypeOptions: string[];
  onUserFilterChange: (value: string) => void;
  onAssetFilterChange: (value: string) => void;
  onTypeFilterChange: (value: string) => void;
  onWalletTypeFilterChange: (value: string) => void;
  onExport: () => void;
}) {
  return (
    <div className="panel rounded-3xl p-4">
      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.8fr_0.9fr_0.9fr_auto]">
        <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
          User / email
          <input
            value={userFilter}
            onChange={(event) => onUserFilterChange(event.target.value)}
            placeholder="Search username or email"
            className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
          />
        </label>
        <FilterSelect label="Asset" value={assetFilter} options={assetOptions} onChange={onAssetFilterChange} />
        <FilterSelect label="Type" value={typeFilter} options={typeOptions} onChange={onTypeFilterChange} />
        <FilterSelect
          label="Wallet type"
          value={walletTypeFilter}
          options={walletTypeOptions}
          onChange={onWalletTypeFilterChange}
        />
        <div className="flex items-end">
          <button
            type="button"
            onClick={onExport}
            className="w-full rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3 text-sm font-semibold text-[var(--accent-strong)] transition hover:border-[var(--accent-strong)]"
          >
            Export CSV
          </button>
        </div>
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
        <option value="ALL">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function displayWalletType(entry: AdminLedgerEntry) {
  return entry.walletType ?? "MAIN";
}

function ownerLabel(entry: AdminLedgerEntry) {
  const walletType = displayWalletType(entry);
  if ((entry.role ?? entry.user.role) === "ADMIN" && walletType !== "MAIN") {
    return `${entry.user.username} / Admin ${walletType} Wallet`;
  }

  return entry.user.username;
}

function walletTypeTone(walletType: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (walletType === "FEE") {
    return "success";
  }

  if (walletType === "TREASURY" || walletType === "AIRDROP" || walletType === "HOT") {
    return "info";
  }

  return "neutral";
}

function uniqueOptions(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function formatReference(entry: AdminLedgerEntry) {
  return `${entry.refType}: ${shortId(entry.refId)}`;
}
