import { AppShell } from "@/components/shell/app-shell";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { DashboardContent } from "./user-dashboard";

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <DashboardContent />
      </AppShell>
    </ProtectedRoute>
  );
}
