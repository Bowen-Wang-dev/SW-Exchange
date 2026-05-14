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
            description="Monitor fills and fees in the same compact visual system as the rest of the exchange console."
            action={<StatusBadge label="Placeholder" tone="neutral" />}
          />

          <DataTable
            columns={["Trade ID", "Buyer", "Seller", "Price", "Amount", "Buyer Fee", "Seller Fee"]}
            rows={[
              [
                "trd_demo_2001",
                "buyer_demo",
                "seller_demo",
                "0.142800",
                "480.00",
                "0.48 SWL",
                "68.54 SWC",
              ],
              [
                "trd_demo_2002",
                "buyer_demo",
                "seller_demo",
                "0.142700",
                "300.00",
                "0.30 SWL",
                "42.81 SWC",
              ],
            ]}
          />
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
