import { PageTemplate } from "@/components/page-template";

export default function AdminOrdersPage() {
  return (
    <PageTemplate
      eyebrow="Admin"
      title="Order review"
      description="Order monitoring will help admins inspect current and historical limit orders once placement and matching are added."
      cards={[
        {
          title: "Planned order insights",
          points: [
            "Market, side, price, amount, filled amount, and status.",
            "View locked balances associated with open orders.",
            "Inspect timestamps and owning users.",
          ],
        },
        {
          title: "Not built yet",
          points: [
            "No matching engine or live order book persistence flow yet.",
            "No cancel or reject handling in the UI.",
            "No intervention tools beyond read-only review for now.",
          ],
        },
      ]}
    />
  );
}
