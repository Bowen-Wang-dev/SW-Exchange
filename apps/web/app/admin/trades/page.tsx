import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { ADMIN_TRADE_REVIEW_COPY } from "@/lib/milestone-copy";

export default function AdminTradesPage() {
  return (
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Admin Trades"
            title="Trade review"
            description={ADMIN_TRADE_REVIEW_COPY}
            action={<StatusBadge label="Preview" tone="neutral" />}
          />

          <DataTable
            columns={["Trade ID", "Buyer", "Seller", "Price", "Amount", "Buyer Fee (v0.7)", "Seller Fee (v0.7)"]}
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
