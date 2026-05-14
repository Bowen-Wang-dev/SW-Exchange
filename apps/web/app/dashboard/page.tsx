import { PageTemplate } from "@/components/page-template";

export default function DashboardPage() {
  return (
    <PageTemplate
      eyebrow="User"
      title="Dashboard"
      description="The dashboard will become the user’s home base for balances, open orders, recent trades, and ledger activity."
      cards={[
        {
          title: "Planned widgets",
          points: [
            "Portfolio summary for SWC and SWL.",
            "Quick links into transfer and trade flows.",
            "Recent orders, trades, and ledger entries.",
          ],
        },
        {
          title: "v0.x limits",
          points: [
            "No market overview with candlestick charts.",
            "No deposit or withdraw modules.",
            "Single exchange pair only: SWL/SWC.",
          ],
        },
      ]}
    />
  );
}
