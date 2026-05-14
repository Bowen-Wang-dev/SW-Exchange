import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";

export default function AdminAuditLogsPage() {
  return (
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Admin Audit"
            title="Audit log review"
            description="Audit tracking is critical even in a single-admin system. This placeholder page establishes the final table shape."
            action={<StatusBadge label="Ops Trail" tone="warning" />}
          />

          <DataTable
            columns={["Log ID", "Admin", "Action", "Target", "Before/After", "Created"]}
            rows={[
              [
                "aud_demo_4001",
                "admin",
                "USER_STATUS_REVIEW",
                "user:user_demo",
                "before/after placeholder",
                "2026-05-14 11:30:00",
              ],
              [
                "aud_demo_4002",
                "admin",
                "AIRDROP_PREVIEW",
                "wallet:user_demo",
                "before/after placeholder",
                "2026-05-14 11:45:00",
              ],
            ]}
          />
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
