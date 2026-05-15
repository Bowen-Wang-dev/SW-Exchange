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

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadUsers() {
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

    void loadUsers();

    return () => {
      active = false;
    };
  }, []);

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
          {isLoading ? <Notice tone="info" message="Loading users..." /> : null}

          {!isLoading && !error ? (
            users.length > 0 ? (
              <DataTable
                columns={["ID", "Email", "Username", "Nickname", "Role", "Status", "Created", "Updated"]}
                rows={users.map((user) => [
                  shortId(user.id),
                  user.email,
                  user.username,
                  user.nickname ?? "-",
                  <StatusBadge
                    key={`${user.id}-role`}
                    label={user.role}
                    tone={user.role === "ADMIN" ? "warning" : "info"}
                  />,
                  <StatusBadge
                    key={`${user.id}-status`}
                    label={user.status}
                    tone={user.status === "ACTIVE" ? "success" : "danger"}
                  />,
                  formatDateTime(user.createdAt),
                  formatDateTime(user.updatedAt),
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

function Notice({ tone, message }: { tone: "info" | "danger"; message: string }) {
  const classes =
    tone === "danger"
      ? "border-rose-300/20 bg-rose-300/10 text-rose-100"
      : "border-blue-300/20 bg-blue-300/10 text-blue-100";

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${classes}`}>{message}</div>;
}
