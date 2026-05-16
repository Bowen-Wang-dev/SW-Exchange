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
            description="Inspect the accounting trail behind wallet balance changes, including order locks, trade settlement, trading fees, fee income, and better-price unlocks."
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
                  "Note",
                  "Created",
                ]}
                rows={entries.map((entry) => [
                  shortId(entry.id),
                  entry.user.username,
                  entry.user.email,
                  <StatusBadge
                    key={`${entry.id}-type`}
                    label={entry.type}
                    tone={ledgerTypeTone(entry.type)}
                  />,
                  entry.asset,
                  <span
                    key={`${entry.id}-amount`}
                    className={
                      entry.amount.startsWith("+")
                        ? "text-emerald-300"
                        : entry.amount.startsWith("-")
                          ? "text-rose-300"
                          : "text-white"
                    }
                  >
                    {entry.amount}
                  </span>,
                  entry.availableAfter,
                  entry.lockedAfter,
                  `${entry.refType}: ${shortId(entry.refId)}`,
                  ledgerNote(entry),
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

function ledgerTypeTone(type: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (type === "ORDER_LOCK" || type === "TRANSFER_OUT" || type === "ADMIN_BUCKET_TRANSFER_OUT") {
    return "warning";
  }

  if (type === "ORDER_UNLOCK" || type === "TRANSFER_IN" || type === "ADMIN_BUCKET_TRANSFER_IN") {
    return "info";
  }

  if (type === "FEE") {
    return "warning";
  }

  if (type === "AIRDROP" || type === "TRADE_BUY" || type === "TRADE_SELL") {
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
    return "Admin wallet bucket transfer.";
  }

  if (entry.type === "ORDER_UNLOCK") {
    return entry.note?.includes("Better price")
      ? "Better-price refund/unlock."
      : "Remaining locked balance unlocked.";
  }

  return entry.note ?? "-";
}
