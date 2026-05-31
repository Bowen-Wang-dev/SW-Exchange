"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AdminConfirmationDialog, type AdminConfirmationView } from "@/components/admin/admin-confirmation-dialog";
import { AdminNotice } from "@/components/admin/admin-notice";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest, ApiError } from "@/lib/api-client";
import type { AdminUser } from "@/lib/api-types";
import { formatDateTime, shortId } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";

type UserStatusFilter = "ALL" | AdminUser["status"];
type VerificationFilter = "ALL" | "VERIFIED" | "UNVERIFIED";

type PendingUserAction = {
  user: AdminUser;
  status: AdminUser["status"];
  note: string;
};

export default function AdminUsersPage() {
  const { loadMe, user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>("ALL");
  const [verificationFilter, setVerificationFilter] = useState<VerificationFilter>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingUserAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void loadUsers(active);

    return () => {
      active = false;
    };
  }, []);

  async function loadUsers(active = true) {
    try {
      setIsLoading(true);
      const response = await apiRequest<AdminUser[]>("/admin/users");
      if (active) {
        setUsers(response);
        setError(null);
      }
    } catch (loadError) {
      if (active) {
        setError(loadError instanceof ApiError ? loadError.message : "Unable to load users.");
      }
    } finally {
      if (active) {
        setIsLoading(false);
      }
    }
  }

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return users.filter((user) => {
      if (statusFilter !== "ALL" && user.status !== statusFilter) {
        return false;
      }

      if (verificationFilter === "VERIFIED" && !user.emailVerified) {
        return false;
      }

      if (verificationFilter === "UNVERIFIED" && user.emailVerified) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [user.id, user.username, user.email, user.nickname ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [searchQuery, statusFilter, users, verificationFilter]);

  async function confirmStatusUpdate() {
    if (!pendingAction) {
      return;
    }

    const { user, status, note } = pendingAction;

    try {
      setUpdatingUserId(user.id);
      setError(null);
      setSuccess(null);
      const updatedUser = await apiRequest<AdminUser>(`/admin/users/${user.id}/status`, {
        method: "PATCH",
        body: {
          status,
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      });

      setUsers((currentUsers) =>
        currentUsers.map((current) => (current.id === updatedUser.id ? updatedUser : current)),
      );
      if (updatedUser.id === currentUser?.id) {
        await loadMe();
      }
      setPendingAction(null);
      setSuccess(`${updatedUser.username} is now ${updatedUser.status}.`);
    } catch (updateError) {
      setError(
        updateError instanceof ApiError ? updateError.message : "Unable to update user status.",
      );
    } finally {
      setUpdatingUserId(null);
    }
  }

  function requestStatusUpdate(targetUser: AdminUser, status: AdminUser["status"]) {
    if (targetUser.id === currentUser?.id && status !== "ACTIVE") {
      setError("You cannot freeze or ban your own admin account.");
      setSuccess(null);
      return;
    }

    setPendingAction({
      user: targetUser,
      status,
      note: "",
    });
  }

  const confirmation = pendingAction
    ? buildUserConfirmation(pendingAction, updatingUserId === pendingAction.user.id)
    : null;

  return (
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Admin Users"
            title="User management"
            description="Review account identity, current status, and safer status operations without weakening backend protections."
            action={<StatusBadge label="Live" tone="success" />}
          />

          <div className="grid gap-4 lg:grid-cols-5">
            <StatCard
              label="Total Users"
              badgeLabel="Loaded"
              value={String(users.length)}
              hint="Normal and admin accounts in the current response."
              tone="info"
            />
            <StatCard
              label="Active"
              badgeLabel="ACTIVE"
              value={String(users.filter((user) => user.status === "ACTIVE").length)}
              hint="Users currently allowed to trade and transfer."
              tone="success"
            />
            <StatCard
              label="Frozen"
              badgeLabel="FROZEN"
              value={String(users.filter((user) => user.status === "FROZEN").length)}
              hint="Users blocked from transfers and order actions."
              tone="warning"
            />
            <StatCard
              label="Banned"
              badgeLabel="BANNED"
              value={String(users.filter((user) => user.status === "BANNED").length)}
              hint="Users blocked from logging in."
              tone="danger"
            />
            <StatCard
              label="Verified Email"
              badgeLabel="Security"
              value={String(users.filter((user) => user.emailVerified).length)}
              hint="Accounts that have completed the v1.0.2 verification foundation."
              tone="info"
            />
          </div>

          <section className="panel rounded-3xl p-4">
            <div className="grid gap-3 lg:grid-cols-[1.2fr_220px_220px_auto]">
              <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                Search users
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Username, email, nickname, or user ID"
                  className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                />
              </label>
              <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                Status
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as UserStatusFilter)}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                >
                  <option value="ALL">All</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="FROZEN">FROZEN</option>
                  <option value="BANNED">BANNED</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                Email verification
                <select
                  value={verificationFilter}
                  onChange={(event) => setVerificationFilter(event.target.value as VerificationFilter)}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                >
                  <option value="ALL">All</option>
                  <option value="VERIFIED">Verified</option>
                  <option value="UNVERIFIED">Unverified</option>
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("ALL");
                    setVerificationFilter("ALL");
                  }}
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold text-[var(--foreground-soft)] transition hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
                >
                  Clear filters
                </button>
              </div>
            </div>
          </section>

          <AdminNotice
            tone="info"
            message="Self-freeze and self-ban remain blocked by the UI and backend. Email verification is now visible for review, but it is not yet required for login or trading."
          />

          {error ? <AdminNotice tone="danger" message={error} /> : null}
          {success ? <AdminNotice tone="success" message={success} /> : null}
          {isLoading ? <AdminNotice tone="info" message="Loading users..." /> : null}

          {!isLoading && !error ? (
            filteredUsers.length > 0 ? (
              <DataTable
                columns={["User", "ID", "Role", "Status", "Verification", "Created", "Updated", "Actions"]}
                rows={filteredUsers.map((user) => [
                  <UserCell key={`${user.id}-user`} user={user} />,
                  shortId(user.id),
                  <StatusBadge
                    key={`${user.id}-role`}
                    label={user.isSystem ? "SYSTEM" : user.role}
                    tone={user.isSystem || user.role === "ADMIN" ? "warning" : "info"}
                  />,
                  <StatusBadge
                    key={`${user.id}-status`}
                    label={user.status}
                    tone={
                      user.status === "ACTIVE"
                        ? "success"
                        : user.status === "FROZEN"
                          ? "warning"
                          : "danger"
                    }
                  />,
                  <StatusBadge
                    key={`${user.id}-email-verified`}
                    label={user.emailVerified ? "VERIFIED" : "UNVERIFIED"}
                    tone={user.emailVerified ? "success" : "warning"}
                  />,
                  formatDateTime(user.createdAt),
                  formatDateTime(user.updatedAt),
                  <UserStatusActions
                    key={`${user.id}-actions`}
                    user={user}
                    currentUserId={currentUser?.id}
                    isUpdating={updatingUserId === user.id}
                    onUpdate={requestStatusUpdate}
                  />,
                ])}
              />
            ) : (
              <AdminNotice tone="info" message="No users match the selected filters." />
            )
          ) : null}
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
          isSubmitting={Boolean(pendingAction && updatingUserId === pendingAction.user.id)}
          onCancel={() => {
            if (!updatingUserId) {
              setPendingAction(null);
            }
          }}
          onConfirm={() => void confirmStatusUpdate()}
        />
      </AppShell>
    </ProtectedRoute>
  );
}

function UserCell({ user }: { user: AdminUser }) {
  return (
    <div className="space-y-1">
      <p className="font-medium text-[var(--foreground)]">{user.username}</p>
      <p className="text-xs text-[var(--foreground-muted)]">{user.email}</p>
      {user.nickname ? <p className="text-xs text-[var(--foreground-muted)]">{user.nickname}</p> : null}
      {user.emailVerifiedAt ? (
        <p className="text-xs text-[var(--foreground-muted)]">
          Verified {formatDateTime(user.emailVerifiedAt)}
        </p>
      ) : null}
    </div>
  );
}

function UserStatusActions({
  user,
  currentUserId,
  isUpdating,
  onUpdate,
}: {
  user: AdminUser;
  currentUserId?: string;
  isUpdating: boolean;
  onUpdate: (user: AdminUser, status: AdminUser["status"]) => void;
}) {
  const isSelf = user.id === currentUserId;

  if (isSelf) {
    return <span className="text-xs text-[var(--foreground-muted)]">Self protected</span>;
  }

  if (user.status === "ACTIVE") {
    return (
      <div className="flex flex-wrap gap-2">
        <ActionButton label="Freeze" disabled={isUpdating} tone="warning" onClick={() => onUpdate(user, "FROZEN")} />
        <ActionButton label="Ban" disabled={isUpdating} tone="danger" onClick={() => onUpdate(user, "BANNED")} />
      </div>
    );
  }

  if (user.status === "FROZEN") {
    return (
      <div className="flex flex-wrap gap-2">
        <ActionButton label="Reactivate" disabled={isUpdating} tone="success" onClick={() => onUpdate(user, "ACTIVE")} />
        <ActionButton label="Ban" disabled={isUpdating} tone="danger" onClick={() => onUpdate(user, "BANNED")} />
      </div>
    );
  }

  return (
    <ActionButton label="Reactivate" disabled={isUpdating} tone="success" onClick={() => onUpdate(user, "ACTIVE")} />
  );
}

function ActionButton({
  label,
  disabled,
  tone,
  onClick,
}: {
  label: string;
  disabled: boolean;
  tone: "success" | "warning" | "danger";
  onClick: () => void;
}) {
  const classes =
    tone === "success"
      ? "border-[var(--notice-success-border)] bg-[var(--notice-success-bg)] text-[var(--notice-success-text)] hover:border-[var(--success)]"
      : tone === "warning"
        ? "border-[var(--notice-warning-border)] bg-[var(--notice-warning-bg)] text-[var(--notice-warning-text)] hover:border-[var(--warning)]"
        : "border-[var(--notice-danger-border)] bg-[var(--notice-danger-bg)] text-[var(--notice-danger-text)] hover:border-[var(--danger)]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${classes}`}
    >
      {disabled ? "Updating..." : label}
    </button>
  );
}

function buildUserConfirmation(
  pendingAction: PendingUserAction,
  isSubmitting: boolean,
): AdminConfirmationView {
  const { user, status } = pendingAction;

  if (status === "BANNED") {
    return {
      eyebrow: "Confirm User Status",
      title: `Ban ${user.username}?`,
      description: "This admin action blocks future login attempts while preserving balances and records.",
      confirmLabel: isSubmitting ? "Banning..." : "Confirm ban",
      tone: "danger",
      details: [
        { label: "Target", value: user.username },
        { label: "Email", value: user.email },
        { label: "Current status", value: user.status },
        { label: "Next status", value: "BANNED" },
      ],
      impacts: [
        "BANNED users cannot log in.",
        "Authenticated API requests from banned sessions are rejected.",
        "Historical orders, trades, ledger, and balances remain preserved.",
      ],
      warning: "Use ban for hard access removal. Reactivation is a separate admin action.",
      noteLabel: "Audit note (optional)",
      notePlaceholder: "Reason for banning this user",
    };
  }

  if (status === "FROZEN") {
    return {
      eyebrow: "Confirm User Status",
      title: `Freeze ${user.username}?`,
      description: "This keeps the account visible but blocks operational actions.",
      confirmLabel: isSubmitting ? "Freezing..." : "Confirm freeze",
      tone: "warning",
      details: [
        { label: "Target", value: user.username },
        { label: "Email", value: user.email },
        { label: "Current status", value: user.status },
        { label: "Next status", value: "FROZEN" },
      ],
      impacts: [
        "FROZEN users can still log in and review balances, orders, and history.",
        "FROZEN users cannot transfer, place orders, cancel orders, or trade through matching.",
        "Existing records remain unchanged.",
      ],
      warning: "Freeze is safer than ban when the account should stay reviewable but inactive.",
      noteLabel: "Audit note (optional)",
      notePlaceholder: "Reason for freezing this user",
    };
  }

  return {
    eyebrow: "Confirm User Status",
    title: `Reactivate ${user.username}?`,
    description: "This restores normal access for the selected account.",
    confirmLabel: isSubmitting ? "Reactivating..." : "Confirm reactivation",
    tone: "success",
    details: [
      { label: "Target", value: user.username },
      { label: "Email", value: user.email },
      { label: "Current status", value: user.status },
      { label: "Next status", value: "ACTIVE" },
    ],
    impacts: [
      "ACTIVE users can log in normally.",
      "ACTIVE users can transfer and place or cancel orders again.",
      "Backend status protections remain unchanged.",
    ],
    warning: "Historical trades and balances are not rewritten; only future eligibility changes.",
    noteLabel: "Audit note (optional)",
    notePlaceholder: "Reason for reactivating this user",
  };
}
