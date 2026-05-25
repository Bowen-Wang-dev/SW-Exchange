import type { ReactNode } from "react";
import { StatusBadge } from "./status-badge";

type StatCardProps = {
  label: string;
  badgeLabel?: string;
  value: string;
  hint: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  extra?: ReactNode;
};

export function StatCard({
  label,
  badgeLabel,
  value,
  hint,
  tone = "neutral",
  extra,
}: StatCardProps) {
  return (
    <section className="panel rounded-3xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
            {label}
          </p>
          <p className="mt-3 text-2xl font-semibold text-[var(--foreground)]">{value}</p>
        </div>
        <StatusBadge label={badgeLabel ?? label} tone={tone} />
      </div>
      <p className="mt-3 text-sm text-[var(--foreground-soft)]">{hint}</p>
      {extra ? <div className="mt-4">{extra}</div> : null}
    </section>
  );
}
