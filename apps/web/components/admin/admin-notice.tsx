type AdminNoticeTone = "info" | "success" | "warning" | "danger";

const toneClasses: Record<AdminNoticeTone, string> = {
  info: "border-[var(--notice-info-border)] bg-[var(--notice-info-bg)] text-[var(--notice-info-text)]",
  success:
    "border-[var(--notice-success-border)] bg-[var(--notice-success-bg)] text-[var(--notice-success-text)]",
  warning:
    "border-[var(--notice-warning-border)] bg-[var(--notice-warning-bg)] text-[var(--notice-warning-text)]",
  danger:
    "border-[var(--notice-danger-border)] bg-[var(--notice-danger-bg)] text-[var(--notice-danger-text)]",
};

export function AdminNotice({
  tone = "info",
  message,
}: {
  tone?: AdminNoticeTone;
  message: string;
}) {
  return <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClasses[tone]}`}>{message}</div>;
}
