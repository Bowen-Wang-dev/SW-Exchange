"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminNotice } from "@/components/admin/admin-notice";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ApiError, apiRequest } from "@/lib/api-client";
import type { SensitiveActionItem, SensitiveActionsResponse } from "@/lib/api-types";

export default function AdminSensitiveActionsPage() {
  const [actions, setActions] = useState<SensitiveActionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadActions() {
      try {
        setIsLoading(true);
        const response = await apiRequest<SensitiveActionsResponse>("/admin/security-actions");
        if (active) {
          setActions(response.actions);
          setError(null);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof ApiError ? loadError.message : "Unable to load sensitive actions.",
          );
          setActions([]);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadActions();

    return () => {
      active = false;
    };
  }, []);

  const adminOnlyCount = useMemo(
    () => actions.filter((action) => action.requiresAdminRole).length,
    [actions],
  );
  const twoFactorPlannedCount = useMemo(
    () => actions.filter((action) => action.requires2FA).length,
    [actions],
  );
  const criticalCount = useMemo(
    () => actions.filter((action) => action.severity === "CRITICAL").length,
    [actions],
  );

  return (
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Admin Security"
            title="Sensitive action policy matrix"
            description="This v1.0.2 matrix tracks planned requirements for future high-impact actions. Email verification state now exists, but 2FA and password re-auth enforcement are still not active yet."
            action={<StatusBadge label="Foundation" tone="info" />}
          />

          <AdminNotice
            tone="warning"
            message="Planned requirements are documented here for future rollout only. This page does not mean deposit, withdrawal, blockchain, or TOTP flows are live, and email verification is not yet enforced for sensitive actions."
          />

          <div className="grid gap-4 lg:grid-cols-4">
            <StatCard
              label="Tracked Actions"
              badgeLabel="Policy"
              value={String(actions.length)}
              hint="Canonical sensitive-action keys currently defined for future security work."
              tone="info"
            />
            <StatCard
              label="Critical"
              badgeLabel="Severity"
              value={String(criticalCount)}
              hint="High-impact actions that should require the strictest future checks."
              tone="danger"
            />
            <StatCard
              label="Admin-only"
              badgeLabel="Planned"
              value={String(adminOnlyCount)}
              hint="Actions expected to require admin role or future RBAC scopes."
              tone="warning"
            />
            <StatCard
              label="2FA Planned"
              badgeLabel="Future"
              value={String(twoFactorPlannedCount)}
              hint="Actions intended to require TOTP once 2FA exists."
              tone="success"
            />
          </div>

          {error ? <AdminNotice tone="danger" message={error} /> : null}
          {isLoading ? <AdminNotice tone="info" message="Loading sensitive actions..." /> : null}

          {!isLoading && !error ? (
            actions.length > 0 ? (
              <DataTable
                columns={["Action", "Severity", "Requirements", "Notes"]}
                rows={actions.map((action) => [
                  <ActionCell key={action.key} action={action} />,
                  <StatusBadge
                    key={`${action.key}-severity`}
                    label={action.severity}
                    tone={severityTone(action.severity)}
                  />,
                  <RequirementsCell key={`${action.key}-requirements`} action={action} />,
                  <div key={`${action.key}-notes`} className="min-w-[320px] text-sm text-[var(--foreground-soft)]">
                    {action.notes}
                  </div>,
                ])}
              />
            ) : (
              <AdminNotice tone="info" message="No sensitive actions are defined." />
            )
          ) : null}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function ActionCell({ action }: { action: SensitiveActionItem }) {
  return (
    <div className="min-w-[240px] space-y-1">
      <div className="font-semibold text-[var(--foreground)]">{action.displayName}</div>
      <div className="font-mono text-xs text-[var(--foreground-muted)]">{action.key}</div>
    </div>
  );
}

function RequirementsCell({ action }: { action: SensitiveActionItem }) {
  return (
    <div className="min-w-[260px] space-y-2">
      <RequirementRow label="Password re-auth" enabled={action.requiresPasswordReauth} />
      <RequirementRow label="Email verification" enabled={action.requiresEmailVerification} />
      <RequirementRow label="TOTP 2FA" enabled={action.requires2FA} />
      <RequirementRow label="Admin role" enabled={action.requiresAdminRole} />
    </div>
  );
}

function RequirementRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2">
      <span className="text-sm text-[var(--foreground-soft)]">{label}</span>
      <StatusBadge label={enabled ? "PLANNED" : "NO"} tone={enabled ? "warning" : "neutral"} />
    </div>
  );
}

function severityTone(severity: SensitiveActionItem["severity"]) {
  switch (severity) {
    case "INFO":
      return "info";
    case "WARNING":
      return "warning";
    case "CRITICAL":
      return "danger";
  }
}
