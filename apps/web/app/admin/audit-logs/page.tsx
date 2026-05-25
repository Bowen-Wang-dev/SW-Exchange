"use client";

import { useMemo, useEffect, useState } from "react";
import { AdminNotice } from "@/components/admin/admin-notice";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest, ApiError } from "@/lib/api-client";
import type { AdminAuditLog } from "@/lib/api-types";
import { downloadCsv } from "@/lib/csv";
import {
  formatDateTime,
  shortId,
  stringifyAuditValue,
  stringifyAuditValuePretty,
} from "@/lib/format";

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [actorFilter, setActorFilter] = useState("ALL");
  const [targetTypeFilter, setTargetTypeFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAuditLogs() {
      try {
        setIsLoading(true);
        const response = await apiRequest<AdminAuditLog[]>("/admin/audit-logs");
        if (active) {
          setLogs(response);
          setError(null);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof ApiError ? loadError.message : "Unable to load audit logs.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadAuditLogs();

    return () => {
      active = false;
    };
  }, []);

  const actionOptions = uniqueOptions(logs.map((log) => log.action));
  const actorOptions = uniqueOptions(logs.map((log) => log.adminUser.username));
  const targetTypeOptions = uniqueOptions(logs.map((log) => log.targetType));

  const filteredLogs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return logs.filter((log) => {
      if (actionFilter !== "ALL" && log.action !== actionFilter) {
        return false;
      }

      if (actorFilter !== "ALL" && log.adminUser.username !== actorFilter) {
        return false;
      }

      if (targetTypeFilter !== "ALL" && log.targetType !== targetTypeFilter) {
        return false;
      }

      if (dateFrom && new Date(log.createdAt) < new Date(`${dateFrom}T00:00:00Z`)) {
        return false;
      }

      if (dateTo && new Date(log.createdAt) > new Date(`${dateTo}T23:59:59Z`)) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        log.action,
        log.targetType,
        log.adminUser.username,
        log.adminUser.email,
        formatTarget(log),
        auditSummary(log),
        stringifyAuditValue(log.afterValue),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [actionFilter, actorFilter, dateFrom, dateTo, logs, searchQuery, targetTypeFilter]);

  function exportFilteredLogs() {
    downloadCsv(
      "admin-audit-logs.csv",
      filteredLogs.map((log) => ({
        time: formatDateTime(log.createdAt),
        admin: `${log.adminUser.username} (${log.adminUser.email})`,
        action: log.action,
        targetType: log.targetType,
        target: formatTarget(log),
        summary: auditSummary(log),
        before: stringifyAuditValue(log.beforeValue),
        after: stringifyAuditValue(log.afterValue),
      })),
    );
  }

  return (
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Admin Audit"
            title="Audit log review"
            description="Review admin actions with client-side filtering for actor, action, target, date, and text search."
            action={<StatusBadge label="Ops Trail" tone="warning" />}
          />

          <div className="grid gap-4 lg:grid-cols-4">
            <StatCard
              label="Loaded Logs"
              badgeLabel="Current"
              value={String(logs.length)}
              hint="Currently loaded audit rows."
              tone="info"
            />
            <StatCard
              label="Visible"
              badgeLabel="Filtered"
              value={String(filteredLogs.length)}
              hint="Rows matching the active filters."
              tone="success"
            />
            <StatCard
              label="Action Types"
              badgeLabel="Distinct"
              value={String(actionOptions.length)}
              hint="Unique admin action categories in the loaded data."
              tone="neutral"
            />
            <StatCard
              label="Actors"
              badgeLabel="Distinct"
              value={String(actorOptions.length)}
              hint="Unique admin usernames in the loaded data."
              tone="neutral"
            />
          </div>

          {error ? <AdminNotice tone="danger" message={error} /> : null}
          {isLoading ? <AdminNotice tone="info" message="Loading audit logs..." /> : null}

          {!isLoading && !error ? (
            logs.length > 0 ? (
              <div className="space-y-4">
                <FilterBar
                  searchQuery={searchQuery}
                  actionFilter={actionFilter}
                  actorFilter={actorFilter}
                  targetTypeFilter={targetTypeFilter}
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  actionOptions={actionOptions}
                  actorOptions={actorOptions}
                  targetTypeOptions={targetTypeOptions}
                  onSearchQueryChange={setSearchQuery}
                  onActionFilterChange={setActionFilter}
                  onActorFilterChange={setActorFilter}
                  onTargetTypeFilterChange={setTargetTypeFilter}
                  onDateFromChange={setDateFrom}
                  onDateToChange={setDateTo}
                  onExport={exportFilteredLogs}
                  onClear={() => {
                    setSearchQuery("");
                    setActionFilter("ALL");
                    setActorFilter("ALL");
                    setTargetTypeFilter("ALL");
                    setDateFrom("");
                    setDateTo("");
                  }}
                />
                {filteredLogs.length > 0 ? (
                  <DataTable
                    columns={["Time", "Admin", "Action", "Target", "Summary", "Details"]}
                    rows={filteredLogs.map((log) => [
                      formatDateTime(log.createdAt),
                      <AdminCell key={`${log.id}-admin`} log={log} />,
                      <StatusBadge
                        key={`${log.id}-action`}
                        label={log.action}
                        tone={auditActionTone(log.action)}
                      />,
                      <TargetCell key={`${log.id}-target`} log={log} />,
                      auditSummary(log),
                      <AuditDetails key={`${log.id}-details`} log={log} />,
                    ])}
                  />
                ) : (
                  <AdminNotice tone="info" message="No audit logs match the selected filters." />
                )}
              </div>
            ) : (
              <AdminNotice tone="info" message="No audit logs found." />
            )
          ) : null}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function AdminCell({ log }: { log: AdminAuditLog }) {
  return (
    <div className="space-y-1">
      <p className="font-medium text-[var(--foreground)]">{log.adminUser.username}</p>
      <p className="text-xs text-[var(--foreground-muted)]">{log.adminUser.email}</p>
    </div>
  );
}

function TargetCell({ log }: { log: AdminAuditLog }) {
  return (
    <div className="space-y-1">
      <StatusBadge label={log.targetType} tone="neutral" />
      <p className="text-xs text-[var(--foreground-soft)]">{formatTarget(log)}</p>
    </div>
  );
}

function AuditDetails({ log }: { log: AdminAuditLog }) {
  return (
    <details className="min-w-[280px] max-w-[520px] rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-3">
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
        View JSON
      </summary>
      <div className="mt-3 grid gap-3">
        <JsonBlock label="Before" value={log.beforeValue} />
        <JsonBlock label="After" value={log.afterValue} />
      </div>
    </details>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
        {label}
      </p>
      <pre className="max-h-56 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--background-strong)] p-3 text-xs leading-relaxed text-[var(--foreground-soft)] exchange-scrollbar">
        {stringifyAuditValuePretty(value)}
      </pre>
    </div>
  );
}

function FilterBar({
  searchQuery,
  actionFilter,
  actorFilter,
  targetTypeFilter,
  dateFrom,
  dateTo,
  actionOptions,
  actorOptions,
  targetTypeOptions,
  onSearchQueryChange,
  onActionFilterChange,
  onActorFilterChange,
  onTargetTypeFilterChange,
  onDateFromChange,
  onDateToChange,
  onExport,
  onClear,
}: {
  searchQuery: string;
  actionFilter: string;
  actorFilter: string;
  targetTypeFilter: string;
  dateFrom: string;
  dateTo: string;
  actionOptions: string[];
  actorOptions: string[];
  targetTypeOptions: string[];
  onSearchQueryChange: (value: string) => void;
  onActionFilterChange: (value: string) => void;
  onActorFilterChange: (value: string) => void;
  onTargetTypeFilterChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onExport: () => void;
  onClear: () => void;
}) {
  return (
    <div className="panel rounded-3xl p-4">
      <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_auto_auto]">
        <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
          Search
          <input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Action, admin, target, or summary"
            className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
          />
        </label>
        <FilterSelect label="Action" value={actionFilter} options={actionOptions} onChange={onActionFilterChange} />
        <FilterSelect label="Actor" value={actorFilter} options={actorOptions} onChange={onActorFilterChange} />
        <FilterSelect
          label="Target type"
          value={targetTypeFilter}
          options={targetTypeOptions}
          onChange={onTargetTypeFilterChange}
        />
        <DateInput label="From" value={dateFrom} onChange={onDateFromChange} />
        <DateInput label="To" value={dateTo} onChange={onDateToChange} />
        <ActionButton label="Export CSV" onClick={onExport} />
        <SecondaryButton label="Clear" onClick={onClear} />
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
        className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
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

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
      {label}
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
      />
    </label>
  );
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="flex items-end">
      <button
        type="button"
        onClick={onClick}
        className="w-full rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3 text-sm font-semibold text-[var(--accent-strong)] transition hover:border-[var(--accent-strong)]"
      >
        {label}
      </button>
    </div>
  );
}

function SecondaryButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="flex items-end">
      <button
        type="button"
        onClick={onClick}
        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold text-[var(--foreground-soft)] transition hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
      >
        {label}
      </button>
    </div>
  );
}

function auditActionTone(action: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (action === "AIRDROP") {
    return "success";
  }

  if (action === "UPDATE_FEE_SETTINGS" || action === "ADMIN_WALLET_BUCKET_TRANSFER") {
    return "warning";
  }

  if (
    action === "UPDATE_USER_STATUS" ||
    action === "UPDATE_ASSET_STATUS" ||
    action === "UPDATE_MARKET_STATUS"
  ) {
    return "info";
  }

  return "neutral";
}

function auditSummary(log: AdminAuditLog) {
  const before = valueAsRecord(log.beforeValue);
  const after = valueAsRecord(log.afterValue);

  if (log.action === "AIRDROP") {
    return `Airdropped ${stringValue(after.amount)} ${stringValue(after.assetSymbol)}.`;
  }

  if (log.action === "UPDATE_FEE_SETTINGS") {
    return `Buyer ${stringValue(before.buyerFeeRateHuman)} -> ${stringValue(after.buyerFeeRateHuman)}, seller ${stringValue(before.sellerFeeRateHuman)} -> ${stringValue(after.sellerFeeRateHuman)}.`;
  }

  if (log.action === "ADMIN_WALLET_BUCKET_TRANSFER") {
    return `Moved ${stringValue(after.amount)} ${stringValue(after.assetSymbol)} from ${stringValue(after.fromWalletType)} to ${stringValue(after.toWalletType)}.`;
  }

  if (log.action === "UPDATE_USER_STATUS") {
    return `User status ${stringValue(before.status)} -> ${stringValue(after.status)}.`;
  }

  if (log.action === "UPDATE_ASSET_STATUS" || log.action === "UPDATE_MARKET_STATUS") {
    return `Status ${stringValue(before.status)} -> ${stringValue(after.status)}.`;
  }

  return stringifyAuditValue(log.afterValue);
}

function valueAsRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  return String(value);
}

function formatTarget(log: AdminAuditLog) {
  return `${log.targetType}: ${shortId(log.targetId)}`;
}

function uniqueOptions(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}
