"use client";

import { PageHeader } from "@/components/shell/page-header";
import { AppShell } from "@/components/shell/app-shell";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { DataTable } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { AdminNotice } from "@/components/admin/admin-notice";
import { formatDateTime } from "@/lib/format";
import { useFeatureFlags } from "@/lib/feature-flags";
import type { FeatureFlagItem } from "@/lib/api-types";

export default function AdminFeatureFlagsPage() {
  const { flags, isLoading, error } = useFeatureFlags({ admin: true });

  const enabledCount = flags.filter((flag) => flag.enabled).length;
  const disabledCount = flags.length - enabledCount;
  const criticalCount = flags.filter((flag) => flag.riskLevel === "CRITICAL").length;
  const securityCount = flags.filter((flag) => flag.group === "SECURITY").length;

  return (
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Admin Feature Flags"
            title="Feature flag foundation"
            description="Read-only visibility for backend-enforced flags covering optional and high-risk modules. Disabled flags are intended to block runtime behavior as well as UI entry points."
            action={<StatusBadge label="Read Only" tone="info" />}
          />

          <AdminNotice
            tone="warning"
            message="Editing is still intentionally not exposed in v1.0.2. All current high-risk and future-only flags seed disabled by default, including future enforcement flags for email verification and 2FA."
          />
          {error ? <AdminNotice tone="danger" message={error} /> : null}
          {isLoading ? <AdminNotice tone="info" message="Loading feature flags..." /> : null}

          <div className="grid gap-4 lg:grid-cols-4">
            <StatCard
              label="Tracked Flags"
              badgeLabel="Total"
              value={String(flags.length)}
              hint="Canonical flags currently known to the runtime foundation."
              tone="info"
            />
            <StatCard
              label="Enabled"
              badgeLabel="Now"
              value={String(enabledCount)}
              hint="These would be allowed by backend enforcement if matching modules existed."
              tone={enabledCount > 0 ? "warning" : "success"}
            />
            <StatCard
              label="Disabled"
              badgeLabel="Now"
              value={String(disabledCount)}
              hint="Current safe default for future-only or higher-risk capabilities."
              tone="success"
            />
            <StatCard
              label="Critical Risk"
              badgeLabel="Review"
              value={String(criticalCount)}
              hint={`${securityCount} security-oriented flags are also present in this foundation.`}
              tone="danger"
            />
          </div>

          <section className="panel rounded-3xl p-5">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                  Safety Rule
                </p>
                <p className="mt-2 text-sm text-[var(--foreground-soft)]">
                  Future deposit, withdrawal, chain, 2FA, email, role-permission, and derivatives
                  work must call backend flag checks before any protected action executes.
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                  Current State
                </p>
                <p className="mt-2 text-sm text-[var(--foreground-soft)]">
                  The foundation is live, but the gated modules themselves remain planned-only.
                  This page exposes state; it does not enable deposit, withdrawal, chain, or
                  leveraged trading behavior.
                </p>
              </div>
            </div>
          </section>

          <DataTable
            columns={["Flag", "Group", "Risk", "Planned", "Default", "Current", "Updated"]}
            rows={flags.map((flag) => [
              <FlagCell key={flag.key} flag={flag} />,
              <StatusBadge key={`${flag.key}-group`} label={flag.group} tone={groupTone(flag.group)} />,
              <StatusBadge
                key={`${flag.key}-risk`}
                label={flag.riskLevel}
                tone={riskTone(flag.riskLevel)}
              />,
              flag.plannedMilestone,
              <StatusBadge
                key={`${flag.key}-default`}
                label={flag.defaultEnabled ? "ENABLED" : "DISABLED"}
                tone={flag.defaultEnabled ? "warning" : "neutral"}
              />,
              <StatusBadge
                key={`${flag.key}-enabled`}
                label={flag.enabled ? "ENABLED" : "DISABLED"}
                tone={flag.enabled ? "warning" : "success"}
              />,
              flag.updatedAt ? formatDateTime(flag.updatedAt) : "Seed default",
            ])}
          />
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function FlagCell({ flag }: { flag: FeatureFlagItem }) {
  return (
    <div className="min-w-[280px] space-y-1">
      <div className="font-semibold text-[var(--foreground)]">{flag.displayName}</div>
      <div className="font-mono text-xs text-[var(--foreground-muted)]">{flag.key}</div>
      <div className="text-sm text-[var(--foreground-soft)]">{flag.description}</div>
    </div>
  );
}

function groupTone(group: FeatureFlagItem["group"]) {
  switch (group) {
    case "FUNDING":
      return "warning";
    case "SECURITY":
      return "danger";
    case "OPERATIONS":
      return "info";
    case "TRADING":
      return "neutral";
  }
}

function riskTone(riskLevel: FeatureFlagItem["riskLevel"]) {
  switch (riskLevel) {
    case "LOW":
      return "neutral";
    case "MEDIUM":
      return "info";
    case "HIGH":
      return "warning";
    case "CRITICAL":
      return "danger";
  }
}
