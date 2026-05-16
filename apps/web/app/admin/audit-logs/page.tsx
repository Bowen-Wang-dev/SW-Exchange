"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest, ApiError } from "@/lib/api-client";
import type { AdminAuditLog } from "@/lib/api-types";
import { formatDateTime, shortId, stringifyAuditValue } from "@/lib/format";

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
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

  return (
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Admin Audit"
            title="Audit log review"
            description="Review admin actions newest first. Airdrops, fee settings, and v0.8 status controls record before and after state here."
            action={<StatusBadge label="Ops Trail" tone="warning" />}
          />

          {error ? <Notice tone="danger" message={error} /> : null}
          {isLoading ? <Notice tone="info" message="Loading audit logs..." /> : null}

          {!isLoading && !error ? (
            logs.length > 0 ? (
              <DataTable
                columns={["Log ID", "Admin", "Action", "Target", "Before", "After", "Created"]}
                rows={logs.map((log) => [
                  shortId(log.id),
                  `${log.adminUser.username} (${log.adminUser.email})`,
                  <StatusBadge key={`${log.id}-action`} label={log.action} tone="warning" />,
                  `${log.targetType}: ${shortId(log.targetId)}`,
                  <span key={`${log.id}-before`} className="block max-w-[360px] truncate">
                    {stringifyAuditValue(log.beforeValue)}
                  </span>,
                  <span key={`${log.id}-after`} className="block max-w-[420px] truncate">
                    {stringifyAuditValue(log.afterValue)}
                  </span>,
                  formatDateTime(log.createdAt),
                ])}
              />
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
      ? "border-rose-300/20 bg-rose-300/10 text-rose-100"
      : "border-blue-300/20 bg-blue-300/10 text-blue-100";

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${classes}`}>{message}</div>;
}
