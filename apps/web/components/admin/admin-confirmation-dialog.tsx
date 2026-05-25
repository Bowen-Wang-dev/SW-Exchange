"use client";

import { useEffect } from "react";
import { StatusBadge } from "@/components/ui/status-badge";

type ConfirmationTone = "neutral" | "success" | "warning" | "danger" | "info";

export type AdminConfirmationView = {
  eyebrow: string;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: ConfirmationTone;
  details?: Array<{ label: string; value: string }>;
  impacts?: string[];
  warning?: string | null;
  noteLabel?: string;
  notePlaceholder?: string;
  noteValue?: string;
  onNoteChange?: (value: string) => void;
};

export function AdminConfirmationDialog({
  confirmation,
  isSubmitting,
  onCancel,
  onConfirm,
}: {
  confirmation: AdminConfirmationView | null;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
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
      <div className="panel-strong relative z-10 w-full max-w-2xl rounded-3xl border border-[var(--border-strong)] p-5 shadow-[0_30px_80px_rgba(2,5,18,0.72)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
              {confirmation.eyebrow}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
              {confirmation.title}
            </h2>
            <p className="mt-3 text-sm text-[var(--foreground-soft)]">{confirmation.description}</p>
          </div>
          <StatusBadge label={confirmation.confirmLabel} tone={confirmation.tone ?? "warning"} />
        </div>

        {confirmation.details && confirmation.details.length > 0 ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {confirmation.details.map((detail) => (
              <div
                key={`${detail.label}-${detail.value}`}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                  {detail.label}
                </p>
                <p className="mt-1 break-words text-sm font-semibold text-[var(--foreground)]">
                  {detail.value}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {confirmation.impacts && confirmation.impacts.length > 0 ? (
          <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
              Impact
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--foreground-soft)]">
              {confirmation.impacts.map((impact) => (
                <li key={impact}>{impact}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {confirmation.noteLabel && confirmation.onNoteChange ? (
          <label className="mt-5 grid gap-2 text-sm text-[var(--foreground-soft)]">
            {confirmation.noteLabel}
            <textarea
              value={confirmation.noteValue ?? ""}
              onChange={(event) => confirmation.onNoteChange?.(event.target.value)}
              placeholder={confirmation.notePlaceholder ?? "Optional audit note"}
              rows={3}
              className="resize-none rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
            />
          </label>
        ) : null}

        {confirmation.warning ? (
          <div className="mt-5 rounded-2xl border border-[var(--notice-warning-border)] bg-[var(--notice-warning-bg)] px-4 py-3 text-sm text-[var(--notice-warning-text)]">
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
            className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Applying..." : confirmation.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
