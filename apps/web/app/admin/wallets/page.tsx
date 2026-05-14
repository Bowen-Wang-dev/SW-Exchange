import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";

export default function AdminWalletsPage() {
  return (
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Admin Wallets"
            title="Wallet oversight"
            description="Monitor user wallet balances across SWC and SWL with a centralized exchange operations layout."
            action={<StatusBadge label="Viewer" tone="info" />}
          />

          <DataTable
            columns={["User", "Asset", "Available", "Locked", "Total", "Status"]}
            rows={[
              [
                "admin",
                "SWC",
                "1,000,000.00",
                "0.00",
                "1,000,000.00",
                <StatusBadge key="admin-wallet-status" label="Healthy" tone="success" />,
              ],
              [
                "user_demo",
                "SWL",
                "17,480.00",
                "420.00",
                "17,900.00",
                <StatusBadge key="user-wallet-status" label="Locked Funds" tone="warning" />,
              ],
            ]}
          />
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
