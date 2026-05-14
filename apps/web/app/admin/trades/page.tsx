import { PageTemplate } from "@/components/page-template";

export default function AdminTradesPage() {
  return (
    <PageTemplate
      eyebrow="Admin"
      title="Trade review"
      description="The trade review area will give admins visibility into fills, fees, and counterparties once the trading engine is introduced."
      cards={[
        {
          title: "Planned data",
          points: [
            "Buyer, seller, price, amount, and execution time.",
            "Buyer fee and seller fee for the 0.1% platform charge.",
            "Links back to the originating buy and sell orders.",
          ],
        },
        {
          title: "v0.x scaffold status",
          points: [
            "Trade schema exists already.",
            "Trade APIs are placeholders.",
            "Fee aggregation for admin reporting remains future work.",
          ],
        },
      ]}
    />
  );
}
