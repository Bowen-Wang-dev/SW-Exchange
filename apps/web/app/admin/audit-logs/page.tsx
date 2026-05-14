import { PageTemplate } from "@/components/page-template";

export default function AdminAuditLogsPage() {
  return (
    <PageTemplate
      eyebrow="Admin"
      title="Audit logs"
      description="Audit logs will capture who changed what, when it changed, and the before/after context for sensitive admin operations."
      cards={[
        {
          title: "Planned record shape",
          points: [
            "Admin user, action, target type, target ID, and timestamp.",
            "JSON before and after snapshots where relevant.",
            "Searchable history for operational accountability.",
          ],
        },
        {
          title: "Why it matters",
          points: [
            "Airdrops and status changes need traceability.",
            "Simple role design does not remove the need for auditability.",
            "This becomes more important as more testers join public registration.",
          ],
        },
      ]}
    />
  );
}
