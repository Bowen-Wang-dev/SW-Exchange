import { PageTemplate } from "@/components/page-template";

export default function AdminLedgerPage() {
  return (
    <PageTemplate
      eyebrow="Admin"
      title="Ledger review"
      description="Admins will use this screen to inspect the accounting trail behind airdrops, transfers, trading effects, and later manual adjustments."
      cards={[
        {
          title: "Visibility goals",
          points: [
            "Filter entries by user, asset, and entry type.",
            "Show post-change available and locked balances.",
            "Trace every ledger row back to its source object.",
          ],
        },
        {
          title: "Audit mindset",
          points: [
            "Ledger is the source of truth for balance movements.",
            "No silent balance changes should bypass it.",
            "Admin activity should correlate with separate audit logs.",
          ],
        },
      ]}
    />
  );
}
