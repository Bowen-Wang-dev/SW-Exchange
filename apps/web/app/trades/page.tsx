import { PageTemplate } from "@/components/page-template";

export default function TradesPage() {
  return (
    <PageTemplate
      eyebrow="User"
      title="Trades"
      description="Trade history will surface fills from the SWL/SWC order book once the spot engine is implemented."
      cards={[
        {
          title: "Trade record fields",
          points: [
            "Market, price, amount, buyer, seller, and linked order IDs.",
            "Buyer fee in SWL and seller fee in SWC.",
            "Execution timestamps for auditability.",
          ],
        },
        {
          title: "Current state",
          points: [
            "Trade APIs return placeholders today.",
            "Database tables are ready for future implementation.",
            "Fee accounting is designed but not executed yet.",
          ],
        },
      ]}
    />
  );
}
