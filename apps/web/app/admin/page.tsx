import { AppShell } from "@/components/shell/app-shell";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AdminDashboardContent } from "./admin-dashboard";

export default function AdminHomePage() {
  return (
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <AdminDashboardContent />
      </AppShell>
    </ProtectedRoute>
  );
}
