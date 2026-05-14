import { PageTemplate } from "@/components/page-template";

export default function HomePage() {
  return (
    <PageTemplate
      eyebrow="Launchpad"
      title="SW Exchange web foundation"
      description="This initial web-only shell gives us a clear path into registration, login, wallet balances, internal transfers, SWL/SWC trading, and the admin dashboard without introducing blockchain or mobile app scope."
      cards={[
        {
          title: "Product boundaries",
          points: [
            "Public registration, no KYC, no blockchain integration in v0.x.",
            "Only SWC and SWL exist today, with SWL/SWC as the sole market.",
            "Limit orders only. No market orders, no candlestick charts yet.",
          ],
        },
        {
          title: "Next implementation steps",
          points: [
            "Connect login and register forms to the NestJS API.",
            "Load wallet, ledger, and market data from placeholder endpoints.",
            "Add protected navigation and role-aware admin routing.",
          ],
        },
      ]}
    />
  );
}
