import { PageTemplate } from "@/components/page-template";

export default function AdminHomePage() {
  return (
    <PageTemplate
      eyebrow="Admin"
      title="Admin dashboard"
      description="The admin dashboard will centralize user oversight, airdrops, asset controls, order review, ledger review, and audit visibility."
      cards={[
        {
          title: "Primary admin jobs",
          points: [
            "View users and wallet balances.",
            "Airdrop SWC or SWL and review resulting ledger changes.",
            "Inspect orders, trades, and audit logs.",
          ],
        },
        {
          title: "Scope control",
          points: [
            "One admin role only in v0.x.",
            "No complex permission matrix or RBAC editor.",
            "No chain operations, deposits, or withdrawals here yet.",
          ],
        },
      ]}
    />
  );
}
