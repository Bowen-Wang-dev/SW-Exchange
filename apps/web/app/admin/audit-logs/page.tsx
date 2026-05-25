"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest, ApiError } from "@/lib/api-client";
import type { AdminAuditLog } from "@/lib/api-types";
import { downloadCsv } from "@/lib/csv";
import { formatDateTime, shortId, stringifyAuditValue, stringifyAuditValuePretty } from "@/lib/format";

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [actionFilter, setActionFilter] = useState("ALL");
  const [targetTypeFilter, setTargetTypeFilter] = useState("ALL");
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
          setError(
            loadError instanceof ApiError ? loadError.message : "Unable to load audit logs.",
          );
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
  const targetTypeOptions = uniqueOptions(logs.map((log) => log.targetType));
  const filteredLogs = logs.filter((log) => {
    if (actionFilter !== "ALL" && log.action !== actionFilter) {
      return false;
    }

    if (targetTypeFilter !== "ALL" && log.targetType !== targetTypeFilter) {
      return false;
    }

    return true;
  });

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
            description="Review admin actions newest first. Airdrops, fee settings, admin bucket transfers, and status controls record before and after state here."
            action={<StatusBadge label="Ops Trail" tone="warning" />}
          />

          {error ? <Notice tone="danger" message={error} /> : null}
          {isLoading ? <Notice tone="info" message="Loading audit logs..." /> : null}

          {!isLoading && !error ? (
            logs.length > 0 ? (
              <div className="space-y-4">
                <FilterBar
                  actionFilter={actionFilter}
                  targetTypeFilter={targetTypeFilter}
                  actionOptions={actionOptions}
                  targetTypeOptions={targetTypeOptions}
                  onActionFilterChange={setActionFilter}
                  onTargetTypeFilterChange={setTargetTypeFilter}
                  onExport={exportFilteredLogs}
                />
                {filteredLogs.length > 0 ? (
                  <DataTable
                    columns={[
                      "Time",
                      "Admin",
                      "Action",
                      "Target Type",
                      "Target",
                      "Summary",
                      "Details",
                    ]}
                    rows={filteredLogs.map((log) => [
                      formatDateTime(log.createdAt),
                      <AdminCell key={`${log.id}-admin`} log={log} />,
                      <StatusBadge
                        key={`${log.id}-action`}
                        label={log.action}
                        tone={auditActionTone(log.action)}
                      />,
                      <StatusBadge key={`${log.id}-target-type`} label={log.targetType} tone="neutral" />,
                      formatTarget(log),
                      auditSummary(log),
                      <AuditDetails key={`${log.id}-details`} log={log} />,
                    ])}
                  />
                ) : (
                  <Notice tone="info" message="No audit logs match the selected filters." />
                )}
              </div>
            ) : (
              <Notice tone="info" message="No audit logs found." />
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
      ? "border-[var(--notice-danger-border)] bg-[var(--notice-danger-bg)] text-[var(--notice-danger-text)]"
      : "border-[var(--notice-info-border)] bg-[var(--notice-info-bg)] text-[var(--notice-info-text)]";

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${classes}`}>{message}</div>;
}

function AdminCell({ log }: { log: AdminAuditLog }) {
  return (
    <div className="space-y-1">
      <p className="font-medium text-[var(--foreground)]">{log.adminUser.username}</p>
      <p className="text-xs text-[var(--foreground-muted)]">{log.adminUser.email}</p>
    </div>
  );
}

function AuditDetails({ log }: { log: AdminAuditLog }) {
  return (
    <details className="min-w-[300px] max-w-[520px] rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-3">
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
  actionFilter,
  targetTypeFilter,
  actionOptions,
  targetTypeOptions,
  onActionFilterChange,
  onTargetTypeFilterChange,
  onExport,
}: {
  actionFilter: string;
  targetTypeFilter: string;
  actionOptions: string[];
  targetTypeOptions: string[];
  onActionFilterChange: (value: string) => void;
  onTargetTypeFilterChange: (value: string) => void;
  onExport: () => void;
}) {
  return (
    <div className="panel rounded-3xl p-4">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <FilterSelect label="Action" value={actionFilter} options={actionOptions} onChange={onActionFilterChange} />
        <FilterSelect
          label="Target type"
          value={targetTypeFilter}
          options={targetTypeOptions}
          onChange={onTargetTypeFilterChange}
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
    return "-";
  }

  return String(value);
}

function formatTarget(log: AdminAuditLog) {
  return `${log.targetType}: ${shortId(log.targetId)}`;
}

function uniqueOptions(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}
