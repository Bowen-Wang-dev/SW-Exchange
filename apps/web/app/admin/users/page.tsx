import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";

export default function AdminUsersPage() {
  return (
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Admin Users"
            title="User management"
            description="Review account role and status in a dense admin table. Mutations remain deferred until later milestones."
            action={<StatusBadge label="Read-Only" tone="info" />}
          />

          <DataTable
            columns={["Email", "Username", "Role", "Status", "Created", "Actions"]}
            rows={[
              [
                "admin@swexchange.local",
                "admin",
                <StatusBadge key="admin-role" label="Admin" tone="warning" />,
                <StatusBadge key="admin-status" label="Active" tone="success" />,
                "2026-05-14",
                "View wallets",
              ],
              [
                "user@example.com",
                "user_demo",
                <StatusBadge key="user-role" label="User" tone="info" />,
                <StatusBadge key="user-status" label="Active" tone="success" />,
                "2026-05-14",
                "Freeze later",
              ],
            ]}
          />
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
