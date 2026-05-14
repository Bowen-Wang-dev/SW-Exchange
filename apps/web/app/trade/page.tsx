import { PageTemplate } from "@/components/page-template";

export default function TradePage() {
  return (
    <PageTemplate
      eyebrow="User"
      title="Trade"
      description="The trading page will host the SWL/SWC limit-order workflow, order book views, and recent trades once the matching engine arrives."
      cards={[
        {
          title: "v0.x market rules",
          points: [
            "Only SWL/SWC is available.",
            "Only limit orders are supported.",
            "Trading fee is 0.1% for both buyer and seller.",
          ],
        },
        {
          title: "Deferred work",
          points: [
            "No order matching logic is implemented yet.",
            "No market orders or K-line chart in this version.",
            "No on-chain settlement or external liquidity integration.",
          ],
        },
      ]}
    />
  );
}
