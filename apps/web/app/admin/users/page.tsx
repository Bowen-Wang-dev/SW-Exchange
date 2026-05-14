import { PageTemplate } from "@/components/page-template";

export default function AdminUsersPage() {
  return (
    <PageTemplate
      eyebrow="Admin"
      title="User management"
      description="Admins will review account status and eventually freeze or unfreeze users from this area."
      cards={[
        {
          title: "Planned data",
          points: [
            "Email, username, role, status, and created date.",
            "Filters for ACTIVE, FROZEN, and BANNED users.",
            "Quick links into wallets and ledger history.",
          ],
        },
        {
          title: "Actions to add later",
          points: [
            "Freeze and unfreeze accounts.",
            "Manual status review with audit logging.",
            "Optional account ban flow if needed for abuse handling.",
          ],
        },
      ]}
    />
  );
}
