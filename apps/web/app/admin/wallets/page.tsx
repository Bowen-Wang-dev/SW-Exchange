import { PageTemplate } from "@/components/page-template";

export default function AdminWalletsPage() {
  return (
    <PageTemplate
      eyebrow="Admin"
      title="Wallet oversight"
      description="This screen will help admins inspect user balances across SWC and SWL without allowing unsafe direct edits."
      cards={[
        {
          title: "Planned visibility",
          points: [
            "Available and locked balances per asset.",
            "User-level balance snapshots for support and audit review.",
            "Filters by asset and account status.",
          ],
        },
        {
          title: "Guardrails",
          points: [
            "Avoid direct balance mutation outside structured flows.",
            "Prefer airdrop or admin adjustment actions with ledger entries.",
            "Keep all changes traceable in audit logs.",
          ],
        },
      ]}
    />
  );
}
