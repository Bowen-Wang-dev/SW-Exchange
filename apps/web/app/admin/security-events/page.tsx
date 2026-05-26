"use client";

import { useEffect, useMemo, useState } from "react";
import { SECURITY_EVENT_SEVERITIES, SECURITY_EVENT_TYPES } from "@sw-exchange/shared";
import { AdminNotice } from "@/components/admin/admin-notice";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ApiError, apiRequest } from "@/lib/api-client";
import type { SecurityEventItem, SecurityEventsResponse } from "@/lib/api-types";
import { formatDateTime, shortId, stringifyAuditValue, stringifyAuditValuePretty } from "@/lib/format";

type Filters = {
  eventType: string;
  severity: string;
  actorUserId: string;
  targetType: string;
  search: string;
  limit: string;
};

const DEFAULT_FILTERS: Filters = {
  eventType: "ALL",
  severity: "ALL",
  actorUserId: "",
  targetType: "",
  search: "",
  limit: "100",
};

export default function AdminSecurityEventsPage() {
  const [events, setEvents] = useState<SecurityEventItem[]>([]);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadEvents(DEFAULT_FILTERS);
  }, []);

  const criticalCount = useMemo(
    () => events.filter((event) => event.severity === "CRITICAL").length,
    [events],
  );
  const authEventCount = useMemo(
    () => events.filter((event) => event.eventType.startsWith("AUTH_")).length,
    [events],
  );
  const adminActionCount = useMemo(
    () =>
      events.filter((event) =>
        [
          "USER_STATUS_CHANGED",
          "ASSET_STATUS_CHANGED",
          "MARKET_STATUS_CHANGED",
          "FEE_SETTINGS_UPDATED",
          "ADMIN_AIRDROP_CREATED",
          "ADMIN_WALLET_TRANSFER_CREATED",
        ].includes(event.eventType),
      ).length,
    [events],
  );

  async function loadEvents(nextFilters: Filters) {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();

      if (nextFilters.eventType !== "ALL") {
        params.set("eventType", nextFilters.eventType);
      }
      if (nextFilters.severity !== "ALL") {
        params.set("severity", nextFilters.severity);
      }
      if (nextFilters.actorUserId.trim()) {
        params.set("actorUserId", nextFilters.actorUserId.trim());
      }
      if (nextFilters.targetType.trim()) {
        params.set("targetType", nextFilters.targetType.trim().toUpperCase());
      }
      if (nextFilters.search.trim()) {
        params.set("search", nextFilters.search.trim());
      }
      params.set("limit", nextFilters.limit);

      const response = await apiRequest<SecurityEventsResponse>(
        `/admin/security-events?${params.toString()}`,
      );
      setEvents(response.events);
      setFilters(nextFilters);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : "Unable to load security events.");
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Admin Security"
            title="Security event review"
            description="Review current login and high-impact admin security events. This log complements existing audit records and is sanitized to avoid storing raw secrets, tokens, or passwords."
            action={<StatusBadge label="Read Only" tone="warning" />}
          />

          <AdminNotice
            tone="info"
            message="Current v1.0.1 coverage focuses on login outcomes plus selected admin controls. 2FA, email verification, withdrawal, deposit, and blockchain security flows are not implemented yet."
          />

          <div className="grid gap-4 lg:grid-cols-4">
            <StatCard
              label="Loaded Events"
              badgeLabel="Current"
              value={String(events.length)}
              hint="Rows returned by the current filter set."
              tone="info"
            />
            <StatCard
              label="Critical"
              badgeLabel="Severity"
              value={String(criticalCount)}
              hint="Critical rows usually represent bans, pauses, or high-impact admin wallet actions."
              tone="danger"
            />
            <StatCard
              label="Auth Events"
              badgeLabel="Current"
              value={String(authEventCount)}
              hint="Successful and failed login activity currently recorded by the runtime."
              tone="success"
            />
            <StatCard
              label="Admin Actions"
              badgeLabel="Current"
              value={String(adminActionCount)}
              hint="Security-focused records for current admin status, fee, airdrop, and bucket operations."
              tone="warning"
            />
          </div>

          <section className="panel rounded-3xl p-4">
            <div className="grid gap-3 lg:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))]">
              <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                Search
                <input
                  value={filters.search}
                  onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                  placeholder="Event type, actor, target, metadata, IP"
                  className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                />
              </label>
              <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                Event type
                <select
                  value={filters.eventType}
                  onChange={(event) => setFilters((current) => ({ ...current, eventType: event.target.value }))}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                >
                  <option value="ALL">All</option>
                  {SECURITY_EVENT_TYPES.map((eventType) => (
                    <option key={eventType} value={eventType}>
                      {eventType}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                Severity
                <select
                  value={filters.severity}
                  onChange={(event) => setFilters((current) => ({ ...current, severity: event.target.value }))}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                >
                  <option value="ALL">All</option>
                  {SECURITY_EVENT_SEVERITIES.map((severity) => (
                    <option key={severity} value={severity}>
                      {severity}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                Actor user ID
                <input
                  value={filters.actorUserId}
                  onChange={(event) => setFilters((current) => ({ ...current, actorUserId: event.target.value }))}
                  placeholder="UUID"
                  className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                />
              </label>
              <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                Target type
                <input
                  value={filters.targetType}
                  onChange={(event) => setFilters((current) => ({ ...current, targetType: event.target.value }))}
                  placeholder="USER, ASSET, MARKET"
                  className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                />
              </label>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-[180px_auto_auto]">
              <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                Limit
                <select
                  value={filters.limit}
                  onChange={(event) => setFilters((current) => ({ ...current, limit: event.target.value }))}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                >
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => void loadEvents(filters)}
                  className="w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[var(--accent-strong)]"
                >
                  Apply filters
                </button>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => void loadEvents(DEFAULT_FILTERS)}
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold text-[var(--foreground-soft)] transition hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
                >
                  Clear filters
                </button>
              </div>
            </div>
          </section>

          {error ? <AdminNotice tone="danger" message={error} /> : null}
          {isLoading ? <AdminNotice tone="info" message="Loading security events..." /> : null}

          {!isLoading && !error ? (
            events.length > 0 ? (
              <DataTable
                columns={["Time", "Event", "Severity", "Actor", "Target", "Summary", "Details"]}
                rows={events.map((event) => [
                  formatDateTime(event.createdAt),
                  <EventTypeCell key={`${event.id}-event`} event={event} />,
                  <StatusBadge
                    key={`${event.id}-severity`}
                    label={event.severity}
                    tone={severityTone(event.severity)}
                  />,
                  <ActorCell key={`${event.id}-actor`} event={event} />,
                  <TargetCell key={`${event.id}-target`} event={event} />,
                  metadataSummary(event.metadata),
                  <EventDetails key={`${event.id}-details`} event={event} />,
                ])}
              />
            ) : (
              <AdminNotice tone="info" message="No security events match the current filters." />
            )
          ) : null}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function EventTypeCell({ event }: { event: SecurityEventItem }) {
  return (
    <div className="min-w-[220px] space-y-1">
      <div className="font-mono text-xs font-semibold text-[var(--foreground)]">{event.eventType}</div>
      <div className="text-xs text-[var(--foreground-muted)]">{shortId(event.id)}</div>
    </div>
  );
}

function ActorCell({ event }: { event: SecurityEventItem }) {
  return (
    <div className="min-w-[220px] space-y-1">
      <div className="font-medium text-[var(--foreground)]">
        {event.actorUser?.username ?? event.actorRole ?? "Anonymous"}
      </div>
      <div className="text-xs text-[var(--foreground-muted)]">
        {event.actorUser?.email ?? event.actorUserId ?? "No actor user"}
      </div>
    </div>
  );
}

function TargetCell({ event }: { event: SecurityEventItem }) {
  return (
    <div className="min-w-[180px] space-y-1">
      <StatusBadge label={event.targetType ?? "NONE"} tone="neutral" />
      <div className="text-xs text-[var(--foreground-muted)]">{event.targetId ? shortId(event.targetId) : "—"}</div>
    </div>
  );
}

function EventDetails({ event }: { event: SecurityEventItem }) {
  return (
    <details className="min-w-[320px] max-w-[560px] rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-3">
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
        View details
      </summary>
      <div className="mt-3 grid gap-3 text-sm text-[var(--foreground-soft)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
            Client
          </p>
          <p className="mt-1">IP: {event.ipAddress ?? "—"}</p>
          <p className="mt-1 break-all">UA: {event.userAgent ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
            Metadata
          </p>
          <pre className="mt-2 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-3 text-xs leading-5 text-[var(--foreground-soft)]">
            {stringifyAuditValuePretty(event.metadata)}
          </pre>
        </div>
      </div>
    </details>
  );
}

function metadataSummary(value: unknown) {
  const summary = stringifyAuditValue(value);
  return summary.length > 140 ? `${summary.slice(0, 140)}...` : summary;
}

function severityTone(severity: SecurityEventItem["severity"]) {
  switch (severity) {
    case "INFO":
      return "info";
    case "WARNING":
      return "warning";
    case "CRITICAL":
      return "danger";
  }
}
