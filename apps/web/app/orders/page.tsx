import { PageTemplate } from "@/components/page-template";

export default function OrdersPage() {
  return (
    <PageTemplate
      eyebrow="User"
      title="Orders"
      description="This screen will eventually show open and historical limit orders for the currently signed-in user."
      cards={[
        {
          title: "Planned order states",
          points: [
            "OPEN, PARTIAL_FILLED, FILLED, CANCELLED, and REJECTED.",
            "Separate active orders from history views.",
            "Expose locked funds tied to each order.",
          ],
        },
        {
          title: "Implementation status",
          points: [
            "Schema is present in the database foundation.",
            "Placement and cancellation APIs are still placeholders.",
            "Matching safety and concurrency work remains for later.",
          ],
        },
      ]}
    />
  );
}
