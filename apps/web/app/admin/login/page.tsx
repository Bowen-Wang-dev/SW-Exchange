import { PageTemplate } from "@/components/page-template";

export default function AdminLoginPage() {
  return (
    <PageTemplate
      eyebrow="Admin"
      title="Admin login"
      description="The first versions can share the main JWT auth flow and redirect admins into the dashboard after successful login."
      cards={[
        {
          title: "Authentication approach",
          points: [
            "Single auth backend for both USER and ADMIN roles.",
            "Admin account is seeded from environment variables.",
            "Role-aware redirect can replace a separate admin-only login later if preferred.",
          ],
        },
        {
          title: "Security notes",
          points: [
            "No complex RBAC yet, just USER and ADMIN roles.",
            "Admin endpoints must remain role-protected in the API.",
            "Audit logging is required for admin actions.",
          ],
        },
      ]}
    />
  );
}
