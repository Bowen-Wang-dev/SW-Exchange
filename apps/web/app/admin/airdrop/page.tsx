"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AdminConfirmationDialog,
  type AdminConfirmationView,
} from "@/components/admin/admin-confirmation-dialog";
import { AdminNotice } from "@/components/admin/admin-notice";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest, ApiError } from "@/lib/api-client";
import type { AirdropResponse, AssetRow } from "@/lib/api-types";
import { shortId } from "@/lib/format";

type PendingAirdropAction = {
  target: string;
  assetSymbol: string;
  amount: string;
  note: string;
};

const LARGE_AIRDROP_THRESHOLD = 1000;

export default function AdminAirdropPage() {
  const [target, setTarget] = useState("");
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [assetSymbol, setAssetSymbol] = useState("SWC");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAirdropAction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<AirdropResponse | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAssets() {
      try {
        const response = await apiRequest<AssetRow[]>("/assets");
        if (active) {
          const activeAssets = response.filter((asset) => asset.isActive);
          setAssets(activeAssets);
          if (!activeAssets.some((asset) => asset.symbol === assetSymbol)) {
            setAssetSymbol(activeAssets[0]?.symbol ?? "SWC");
          }
        }
      } catch {
        if (active) {
          setAssets([]);
        }
      }
    }

    void loadAssets();

    return () => {
      active = false;
    };
  }, [assetSymbol]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedTarget = target.trim();
    if (!trimmedTarget) {
      setError("Enter a user ID, username, or email.");
      return;
    }

    const nextAction = {
      target: trimmedTarget,
      assetSymbol,
      amount: amount.trim(),
      note,
    };

    if (isLargeAirdrop(nextAction.amount)) {
      setPendingAction(nextAction);
      return;
    }

    void submitAirdrop(nextAction);
  }

  async function submitAirdrop(action: PendingAirdropAction) {
    try {
      setIsSubmitting(true);
      const response = await apiRequest<AirdropResponse>("/admin/airdrop", {
        method: "POST",
        body: {
          ...buildTargetPayload(action.target),
          assetSymbol: action.assetSymbol,
          amount: action.amount,
          ...(action.note.trim() ? { note: action.note.trim() } : {}),
        },
      });

      setSuccess(response);
      setPendingAction(null);
      setAmount("");
      setNote("");
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Unable to complete airdrop.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const confirmation = useMemo(() => {
    if (!pendingAction) {
      return null;
    }

    return buildAirdropConfirmation(pendingAction, isSubmitting);
  }, [pendingAction, isSubmitting]);

  return (
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Admin Airdrop"
            title="Airdrop asset"
            description="Credit a user's available wallet balance with clearer guardrails and confirmation for large funding actions."
            action={<StatusBadge label="Live" tone="success" />}
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
                    className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                  />
                </label>

                <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                  Asset
                  <select
                    value={assetSymbol}
                    onChange={(event) => setAssetSymbol(event.target.value)}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                  >
                    {buildAssetOptions(assets, assetSymbol).map((asset) => (
                      <option key={asset} value={asset}>
                        {asset}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                  Amount
                  <input
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="1000 or 12.5"
                    inputMode="decimal"
                    className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                  />
                </label>

                <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                  Audit note
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Optional admin note"
                    rows={3}
                    className="resize-none rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                  />
                </label>

                <AdminNotice
                  tone={isLargeAirdrop(amount) ? "warning" : "info"}
                  message={
                    isLargeAirdrop(amount)
                      ? `Large airdrop confirmation will appear for amounts at or above ${LARGE_AIRDROP_THRESHOLD}.`
                      : "Airdrops write wallet, ledger, and admin audit records together."
                  }
                />

                {error ? <AdminNotice tone="danger" message={error} /> : null}
                {success ? (
                  <AdminNotice
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
                  "Only active assets are allowed.",
                  "Target users must be ACTIVE; FROZEN and BANNED accounts cannot receive airdrops.",
                  "Amounts must be positive plain decimal strings, never scientific notation.",
                  "Current airdrop remains unlimited in v0.x and does not consume the AIRDROP bucket.",
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

        <AdminConfirmationDialog
          confirmation={
            confirmation
              ? {
                  ...confirmation,
                  noteValue: pendingAction?.note ?? "",
                  onNoteChange: (value) =>
                    setPendingAction((current) => (current ? { ...current, note: value } : current)),
                }
              : null
          }
          isSubmitting={isSubmitting}
          onCancel={() => {
            if (!isSubmitting) {
              setPendingAction(null);
            }
          }}
          onConfirm={() => {
            if (pendingAction) {
              void submitAirdrop(pendingAction);
            }
          }}
        />
      </AppShell>
    </ProtectedRoute>
  );
}

function buildAssetOptions(assets: AssetRow[], selectedAsset: string) {
  const options = new Set<string>([selectedAsset]);
  for (const asset of assets) {
    options.add(asset.symbol);
  }

  return [...options].filter(Boolean);
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

function isLargeAirdrop(amount: string) {
  const value = Number(amount);
  return Number.isFinite(value) && value >= LARGE_AIRDROP_THRESHOLD;
}

function buildAirdropConfirmation(
  pendingAction: PendingAirdropAction,
  isSubmitting: boolean,
): AdminConfirmationView {
  return {
    eyebrow: "Confirm Large Airdrop",
    title: `Airdrop ${pendingAction.amount} ${pendingAction.assetSymbol}?`,
    description:
      "This large airdrop directly credits the target user's MAIN wallet and writes paired ledger and audit records.",
    confirmLabel: isSubmitting ? "Airdropping..." : "Confirm airdrop",
    tone: "warning",
    details: [
      { label: "Target", value: pendingAction.target },
      { label: "Asset", value: pendingAction.assetSymbol },
      { label: "Amount", value: pendingAction.amount || "—" },
      { label: "Threshold", value: String(LARGE_AIRDROP_THRESHOLD) },
    ],
    impacts: [
      "Target user must be ACTIVE and the asset must be ACTIVE.",
      "The user's available MAIN balance increases immediately on success.",
      "Current v0.x airdrop does not consume the AIRDROP bucket.",
    ],
    warning: "This is an operational funding action. Historical records remain visible after execution.",
    noteLabel: "Audit note (optional)",
    notePlaceholder: "Reason for this large airdrop",
  };
}
