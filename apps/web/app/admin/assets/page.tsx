import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";

export default function AdminAssetsPage() {
  return (
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Admin Assets"
            title="Asset registry"
            description="The seeded asset universe remains small in v0.x. This page gives admins a clean table view of the exchange inventory."
            action={<StatusBadge label="Seeded" tone="success" />}
          />

          <DataTable
            columns={["Symbol", "Name", "Decimals", "Status", "Notes"]}
            rows={[
              ["SWC", "SW Cash", "18", <StatusBadge key="swc-status" label="Active" tone="success" />, "Internal settlement unit"],
              ["SWL", "SW LUNA", "18", <StatusBadge key="swl-status" label="Active" tone="success" />, "Internal volatile asset"],
            ]}
          />
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
