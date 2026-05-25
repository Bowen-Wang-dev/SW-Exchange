"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest, ApiError } from "@/lib/api-client";
import type { AdminUser } from "@/lib/api-types";
import { formatDateTime, shortId } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";

export default function AdminUsersPage() {
  const { loadMe, user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
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

  async function updateStatus(targetUser: AdminUser, status: AdminUser["status"]) {
    if (targetUser.id === currentUser?.id && status !== "ACTIVE") {
      setError("You cannot freeze or ban your own admin account.");
      setSuccess(null);
      return;
    }

    const noteInput = window.prompt(
      `Optional audit note for ${status.toLowerCase()} ${targetUser.username}:`,
    );
    if (noteInput === null) {
      return;
    }
    const note = noteInput.trim();

    try {
      setUpdatingUserId(targetUser.id);
      setError(null);
      setSuccess(null);
      const updatedUser = await apiRequest<AdminUser>(`/admin/users/${targetUser.id}/status`, {
        method: "PATCH",
        body: {
          status,
          ...(note ? { note } : {}),
        },
      });

      setUsers((currentUsers) =>
        currentUsers.map((user) => (user.id === updatedUser.id ? updatedUser : user)),
      );
      if (updatedUser.id === currentUser?.id) {
        await loadMe();
      }
      setSuccess(`${updatedUser.username} is now ${updatedUser.status}.`);
    } catch (updateError) {
      setError(
        updateError instanceof ApiError ? updateError.message : "Unable to update user status.",
      );
    } finally {
      setUpdatingUserId(null);
    }
  }

  return (
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Admin Users"
            title="User management"
            description="Review account role, status, and profile metadata. Password hashes are never returned."
            action={<StatusBadge label="Live" tone="success" />}
          />

          {error ? <Notice tone="danger" message={error} /> : null}
          {success ? <Notice tone="success" message={success} /> : null}
          {isLoading ? <Notice tone="info" message="Loading users..." /> : null}

          {!isLoading && !error ? (
            users.length > 0 ? (
              <DataTable
                columns={[
                  "ID",
                  "Email",
                  "Username",
                  "Nickname",
                  "Role",
                  "Status",
                  "Created",
                  "Updated",
                  "Actions",
                ]}
                rows={users.map((user) => [
                  shortId(user.id),
                  user.email,
                  user.username,
                  user.isSystem ? "System account" : user.nickname ?? "-",
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
                  formatDateTime(user.createdAt),
                  formatDateTime(user.updatedAt),
                  <UserStatusActions
                    key={`${user.id}-actions`}
                    user={user}
                    currentUserId={currentUser?.id}
                    isUpdating={updatingUserId === user.id}
                    onUpdate={updateStatus}
                  />,
                ])}
              />
            ) : (
              <Notice tone="info" message="No users found." />
            )
          ) : null}
        </div>
      </AppShell>
    </ProtectedRoute>
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
        <StatusButton
          label="Freeze"
          disabled={isUpdating}
          tone="warning"
          onClick={() => onUpdate(user, "FROZEN")}
        />
        <StatusButton
          label="Ban"
          disabled={isUpdating}
          tone="danger"
          onClick={() => onUpdate(user, "BANNED")}
        />
      </div>
    );
  }

  if (user.status === "FROZEN") {
    return (
      <div className="flex flex-wrap gap-2">
        <StatusButton
          label="Unfreeze"
          disabled={isUpdating}
          tone="success"
          onClick={() => onUpdate(user, "ACTIVE")}
        />
        <StatusButton
          label="Ban"
          disabled={isUpdating}
          tone="danger"
          onClick={() => onUpdate(user, "BANNED")}
        />
      </div>
    );
  }

  return (
    <StatusButton
      label="Unban"
      disabled={isUpdating}
      tone="success"
      onClick={() => onUpdate(user, "ACTIVE")}
    />
  );
}

function StatusButton({
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

function Notice({ tone, message }: { tone: "info" | "danger" | "success"; message: string }) {
  const classes =
    tone === "danger"
      ? "border-[var(--notice-danger-border)] bg-[var(--notice-danger-bg)] text-[var(--notice-danger-text)]"
      : tone === "success"
        ? "border-[var(--notice-success-border)] bg-[var(--notice-success-bg)] text-[var(--notice-success-text)]"
        : "border-[var(--notice-info-border)] bg-[var(--notice-info-bg)] text-[var(--notice-info-text)]";

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${classes}`}>{message}</div>;
}
