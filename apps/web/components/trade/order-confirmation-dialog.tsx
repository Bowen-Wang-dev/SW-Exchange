"use client";

import { useEffect } from "react";
import type { OrderSide } from "@/lib/api-types";
import { StatusBadge } from "@/components/ui/status-badge";

export type ConfirmationField = {
  label: string;
  value: string;
};

export type OrderConfirmationView = {
  marketSymbol: string;
  side: OrderSide;
  type: "LIMIT" | "MARKET";
  fields: ConfirmationField[];
  warning?: string | null;
  liquidityStatus?: "FULL" | "PARTIAL" | "NONE";
  helperText?: string | null;
};

type OrderConfirmationDialogProps = {
  confirmation: OrderConfirmationView | null;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function OrderConfirmationDialog({
  confirmation,
  isSubmitting,
  onCancel,
  onConfirm,
}: OrderConfirmationDialogProps) {
  useEffect(() => {
    if (!confirmation) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) {
        onCancel();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [confirmation, isSubmitting, onCancel]);

  if (!confirmation) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] px-4 backdrop-blur-sm">
      <div
        className="absolute inset-0"
        aria-hidden="true"
        onClick={() => {
          if (!isSubmitting) {
            onCancel();
          }
        }}
      />
      <div className="panel-strong relative z-10 w-full max-w-xl rounded-3xl border border-[var(--border-strong)] p-5 shadow-[0_30px_80px_rgba(2,5,18,0.72)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
              Confirm order
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
              {confirmation.type} {confirmation.side} {confirmation.marketSymbol}
            </h2>
          </div>
          {confirmation.liquidityStatus ? (
            <StatusBadge
              label={confirmation.liquidityStatus}
              tone={liquidityTone(confirmation.liquidityStatus)}
            />
          ) : null}
        </div>

        {confirmation.helperText ? (
          <p className="mt-3 text-sm text-[var(--foreground-soft)]">{confirmation.helperText}</p>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {confirmation.fields.map((field) => (
            <div
              key={field.label}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                {field.label}
              </p>
              <p className="mt-1 break-words text-sm font-semibold text-[var(--foreground)]">{field.value}</p>
            </div>
          ))}
        </div>

        {confirmation.warning ? (
          <div className="mt-4 rounded-2xl border border-[var(--notice-warning-border)] bg-[var(--notice-warning-bg)] px-4 py-3 text-sm text-[var(--notice-warning-text)]">
            {confirmation.warning}
          </div>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--foreground-soft)] transition hover:border-[var(--border-strong)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className={`rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
              confirmation.side === "BUY"
                ? "bg-[var(--success)] text-black hover:bg-emerald-300"
                : "bg-[var(--danger)] text-white hover:bg-rose-400"
            }`}
          >
            {isSubmitting ? "Submitting..." : `Confirm ${confirmation.type} ${confirmation.side}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function liquidityTone(status: "FULL" | "PARTIAL" | "NONE") {
  if (status === "FULL") {
    return "success";
  }

  if (status === "PARTIAL") {
    return "warning";
  }

  return "danger";
}
