"use client";

import { FormEvent, useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest, ApiError } from "@/lib/api-client";
import type { TransferHistoryEntry, TransferResponse, WalletBalance } from "@/lib/api-types";
import { formatDateTime, shortId } from "@/lib/format";

export default function TransferPage() {
  const [recipient, setRecipient] = useState("");
  const [assetSymbol, setAssetSymbol] = useState<"SWC" | "SWL">("SWC");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [wallets, setWallets] = useState<WalletBalance[]>([]);
  const [history, setHistory] = useState<TransferHistoryEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<TransferResponse | null>(null);

  useEffect(() => {
    void loadPageData();
  }, []);

  async function loadPageData() {
    try {
      setIsLoading(true);
      const [walletResponse, historyResponse] = await Promise.all([
        apiRequest<WalletBalance[]>("/wallets/me"),
        apiRequest<TransferHistoryEntry[]>("/transfers/me"),
      ]);
      setWallets(walletResponse);
      setHistory(historyResponse);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : "Unable to load transfer data.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!recipient.trim()) {
      setError("Enter a recipient username or email.");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await apiRequest<TransferResponse>("/transfers", {
        method: "POST",
        body: {
          recipient: recipient.trim(),
          assetSymbol,
          amount: amount.trim(),
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      });

      setSuccess(response);
      setAmount("");
      setNote("");
      await loadPageData();
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : "Unable to complete internal transfer.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedWallet = wallets.find((wallet) => wallet.asset === assetSymbol);

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Transfer"
            title="Internal transfer"
            description="Send SWC or SWL to another active SW Exchange user by username or email."
            action={<StatusBadge label="Transfers Live" tone="success" />}
          />

          <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
            <section className="panel rounded-3xl p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                Transfer Form
              </p>

              <form onSubmit={handleSubmit} className="mt-4 grid gap-4">
                <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                  Recipient username or email
                  <input
                    value={recipient}
                    onChange={(event) => setRecipient(event.target.value)}
                    placeholder="username or name@example.com"
                    className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
                  />
                </label>

                <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                  Asset
                  <select
                    value={assetSymbol}
                    onChange={(event) => setAssetSymbol(event.target.value as "SWC" | "SWL")}
                    className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
                  >
                    <option value="SWC">SWC</option>
                    <option value="SWL">SWL</option>
                  </select>
                </label>

                <div className="rounded-2xl border border-[var(--border)] bg-white/[0.03] px-4 py-3 text-sm text-[var(--foreground-soft)]">
                  Available:{" "}
                  <span className="font-medium text-white">
                    {selectedWallet?.available ?? "0"} {assetSymbol}
                  </span>
                </div>

                <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                  Amount
                  <input
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="100 or 12.34"
                    inputMode="decimal"
                    className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
                  />
                </label>

                <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                  Note
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Optional transfer note"
                    rows={3}
                    className="resize-none rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
                  />
                </label>

                {error ? <Notice tone="danger" message={error} /> : null}
                {success ? (
                  <Notice
                    tone="success"
                    message={`Transferred ${success.amount} ${success.assetSymbol} to ${success.to.username}. New available balance: ${success.senderNewAvailable}. Transfer: ${shortId(success.id)}.`}
                  />
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Sending transfer..." : "Send transfer"}
                </button>
              </form>
            </section>

            <section className="panel rounded-3xl p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                Rules
              </p>
              <div className="data-divider mt-4 rounded-2xl border border-[var(--border)]">
                {[
                  "Internal transfers are free.",
                  "Deposit and withdraw are disabled in v0.x.",
                  "Only available balance can be transferred.",
                  "Recipients must be ACTIVE; FROZEN and BANNED accounts are blocked from receiving.",
                ].map((item) => (
                  <div key={item} className="px-4 py-3 text-sm text-[var(--foreground-soft)]">
                    {item}
                  </div>
                ))}
              </div>
            </section>
          </div>

          {isLoading ? <Notice tone="info" message="Loading transfer history..." /> : null}

          {!isLoading ? (
            history.length > 0 ? (
              <DataTable
                columns={["Time", "Direction", "Counterparty", "Asset", "Amount", "Status", "Note"]}
                rows={history.map((entry) => [
                  formatDateTime(entry.createdAt),
                  <StatusBadge
                    key={`${entry.id}-direction`}
                    label={entry.direction}
                    tone={entry.direction === "IN" ? "success" : "warning"}
                  />,
                  <div key={`${entry.id}-counterparty`} className="space-y-1">
                    <p className="font-medium text-white">{entry.counterparty.username}</p>
                    <p className="text-xs text-[var(--foreground-muted)]">
                      {entry.counterparty.email || "-"}
                    </p>
                  </div>,
                  entry.assetSymbol,
                  <span
                    key={`${entry.id}-amount`}
                    className={entry.direction === "IN" ? "text-emerald-300" : "text-amber-200"}
                  >
                    {entry.direction === "IN" ? "+" : "-"}
                    {entry.amount}
                  </span>,
                  <StatusBadge
                    key={`${entry.id}-status`}
                    label={entry.status}
                    tone={entry.status === "SUCCESS" ? "success" : "danger"}
                  />,
                  entry.note ?? "-",
                ])}
              />
            ) : (
              <Notice tone="info" message="No internal transfers yet." />
            )
          ) : null}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function Notice({
  tone,
  message,
}: {
  tone: "success" | "danger" | "info";
  message: string;
}) {
  const classes =
    tone === "danger"
      ? "border-rose-300/20 bg-rose-300/10 text-rose-100"
      : tone === "success"
        ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
        : "border-blue-300/20 bg-blue-300/10 text-blue-100";

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${classes}`}>{message}</div>;
}
