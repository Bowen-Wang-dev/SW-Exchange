"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest, ApiError } from "@/lib/api-client";
import type { AdminTransferEntry } from "@/lib/api-types";
import { downloadCsv } from "@/lib/csv";
import { formatDateTime } from "@/lib/format";

export default function AdminTransfersPage() {
  const [transfers, setTransfers] = useState<AdminTransferEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadTransfers() {
      try {
        setIsLoading(true);
        const response = await apiRequest<AdminTransferEntry[]>("/admin/transfers");
        if (active) {
          setTransfers(response);
          setError(null);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof ApiError
              ? loadError.message
              : "Unable to load internal transfers.",
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadTransfers();

    return () => {
      active = false;
    };
  }, []);

  function exportTransfers() {
    downloadCsv(
      "admin-transfers.csv",
      transfers.map((transfer) => ({
        time: formatDateTime(transfer.createdAt),
        from: transfer.from.username,
        fromEmail: transfer.from.email,
        to: transfer.to.username,
        toEmail: transfer.to.email,
        asset: transfer.assetSymbol,
        amount: transfer.amount,
        status: transfer.status,
        note: transfer.note ?? "",
      })),
    );
  }

  return (
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Admin Transfers"
            title="Internal transfer review"
            description="Review all free SWC/SWL MAIN-to-MAIN user internal transfers, newest first. Admin bucket movements appear in the ledger and audit log instead."
            action={
              <button
                type="button"
                onClick={exportTransfers}
                className="rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)] transition hover:border-[var(--accent-strong)]"
              >
                Export CSV
              </button>
            }
          />

          {error ? <Notice tone="danger" message={error} /> : null}
          {isLoading ? <Notice tone="info" message="Loading transfers..." /> : null}

          {!isLoading && !error ? (
            transfers.length > 0 ? (
              <DataTable
                columns={["Time", "From", "To", "Asset", "Amount", "Status", "Note"]}
                rows={transfers.map((transfer) => [
                  formatDateTime(transfer.createdAt),
                  <UserCell
                    key={`${transfer.id}-from`}
                    username={transfer.from.username}
                    email={transfer.from.email}
                  />,
                  <UserCell
                    key={`${transfer.id}-to`}
                    username={transfer.to.username}
                    email={transfer.to.email}
                  />,
                  transfer.assetSymbol,
                  <span key={`${transfer.id}-amount`} className="font-medium text-white">
                    {transfer.amount}
                  </span>,
                  <StatusBadge
                    key={`${transfer.id}-status`}
                    label={transfer.status}
                    tone={transfer.status === "SUCCESS" ? "success" : "danger"}
                  />,
                  transfer.note ?? "-",
                ])}
              />
            ) : (
              <Notice tone="info" message="No internal transfers found." />
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
      <p className="text-xs text-[var(--foreground-muted)]">{email || "-"}</p>
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
