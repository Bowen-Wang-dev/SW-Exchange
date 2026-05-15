"use client";

import { FormEvent, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest, ApiError } from "@/lib/api-client";
import type { AirdropResponse } from "@/lib/api-types";
import { shortId } from "@/lib/format";

export default function AdminAirdropPage() {
  const [target, setTarget] = useState("");
  const [assetSymbol, setAssetSymbol] = useState<"SWC" | "SWL">("SWC");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<AirdropResponse | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedTarget = target.trim();
    if (!trimmedTarget) {
      setError("Enter a user ID, username, or email.");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await apiRequest<AirdropResponse>("/admin/airdrop", {
        method: "POST",
        body: {
          ...buildTargetPayload(trimmedTarget),
          assetSymbol,
          amount: amount.trim(),
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      });

      setSuccess(response);
      setAmount("");
      setNote("");
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : "Unable to complete airdrop.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Admin Airdrop"
            title="Airdrop SWC or SWL"
            description="Credit a user's available wallet balance. Every airdrop writes wallet, ledger, and admin audit records together."
            action={<StatusBadge label="Enabled v0.3" tone="warning" />}
          />

          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <section className="panel rounded-3xl p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                Airdrop Form
              </p>

              <form onSubmit={handleSubmit} className="mt-4 grid gap-4">
                <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                  Target user identifier
                  <input
                    value={target}
                    onChange={(event) => setTarget(event.target.value)}
                    placeholder="User ID, username, or email"
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

                <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                  Amount
                  <input
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="1000 or 12.5"
                    className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
                  />
                </label>

                <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                  Note
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Optional admin note"
                    rows={3}
                    className="resize-none rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
                  />
                </label>

                {error ? <Notice tone="danger" message={error} /> : null}
                {success ? (
                  <Notice
                    tone="success"
                    message={`Airdropped ${success.amount} ${success.assetSymbol} to ${success.targetUser.username}. New available balance: ${success.newAvailable}. Ledger: ${shortId(success.ledgerEntryId)}.`}
                  />
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Executing airdrop..." : "Execute airdrop"}
                </button>
              </form>
            </section>

            <section className="panel rounded-3xl p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                Guardrails
              </p>
              <div className="data-divider mt-4 rounded-2xl border border-[var(--border)]">
                {[
                  "Only active SWC and SWL assets are allowed.",
                  "Amounts must be positive plain decimal strings, never scientific notation.",
                  "Airdrops write wallet, ledger, and audit records in one transaction.",
                  "Only a single full-permission admin exists in v0.x.",
                ].map((item) => (
                  <div key={item} className="px-4 py-3 text-sm text-[var(--foreground-soft)]">
                    {item}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function buildTargetPayload(target: string) {
  if (target.includes("@")) {
    return { email: target };
  }

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(target)) {
    return { userId: target };
  }

  return { username: target };
}

function Notice({
  tone,
  message,
}: {
  tone: "success" | "danger";
  message: string;
}) {
  const classes =
    tone === "danger"
      ? "border-rose-300/20 bg-rose-300/10 text-rose-100"
      : "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${classes}`}>{message}</div>;
}
