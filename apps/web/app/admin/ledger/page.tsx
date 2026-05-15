"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest, ApiError } from "@/lib/api-client";
import type { AdminLedgerEntry } from "@/lib/api-types";
import { formatDateTime, shortId } from "@/lib/format";

export default function AdminLedgerPage() {
  const [entries, setEntries] = useState<AdminLedgerEntry[]>([]);
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

  return (
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Admin Ledger"
            title="Ledger review"
            description="Inspect the accounting trail behind wallet balance changes. Airdrops are recorded newest first."
            action={<StatusBadge label="Source of Truth" tone="info" />}
          />

          {error ? <Notice tone="danger" message={error} /> : null}
          {isLoading ? <Notice tone="info" message="Loading ledger entries..." /> : null}

          {!isLoading && !error ? (
            entries.length > 0 ? (
              <DataTable
                columns={[
                  "Entry ID",
                  "User",
                  "Email",
                  "Type",
                  "Asset",
                  "Amount",
                  "Available After",
                  "Locked After",
                  "Reference",
                  "Created",
                ]}
                rows={entries.map((entry) => [
                  shortId(entry.id),
                  entry.user.username,
                  entry.user.email,
                  <StatusBadge key={`${entry.id}-type`} label={entry.type} tone="success" />,
                  entry.asset,
                  <span
                    key={`${entry.id}-amount`}
                    className={entry.amount.startsWith("+") ? "text-emerald-300" : "text-white"}
                  >
                    {entry.amount}
                  </span>,
                  entry.availableAfter,
                  entry.lockedAfter,
                  `${entry.refType}: ${shortId(entry.refId)}`,
                  formatDateTime(entry.createdAt),
                ])}
              />
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
