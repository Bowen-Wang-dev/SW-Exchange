import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";

export default function AdminTradesPage() {
  return (
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Admin Trades"
            title="Trade review"
            description="Trade review is preview-only until the v0.6 matching engine creates real fills and fees."
            action={<StatusBadge label="Preview" tone="neutral" />}
          />

          <DataTable
            columns={["Trade ID", "Buyer", "Seller", "Price", "Amount", "Buyer Fee", "Seller Fee"]}
            rows={[
              [
                "—",
                "—",
                "—",
                "—",
                "—",
                "—",
                "—",
              ],
              [
                "—",
                "—",
                "—",
                "—",
                "—",
                "—",
                "—",
              ],
            ]}
          />
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
