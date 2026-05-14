import { PageTemplate } from "@/components/page-template";

export default function LedgerPage() {
  return (
    <PageTemplate
      eyebrow="User"
      title="Ledger"
      description="Ledger history is the accounting backbone of the exchange and should explain every balance change in a traceable way."
      cards={[
        {
          title: "Planned entry types",
          points: [
            "AIRDROP, TRANSFER_IN, TRANSFER_OUT, ORDER_LOCK, ORDER_UNLOCK.",
            "TRADE_BUY, TRADE_SELL, FEE, and ADMIN_ADJUST.",
            "Each entry should include post-change available and locked balances.",
          ],
        },
        {
          title: "Correctness expectations",
          points: [
            "Ledger writes must happen inside the same transaction as balance updates.",
            "Reference links should point to transfers, orders, trades, or admin actions.",
            "v1.x deposit and withdraw entry types are intentionally absent.",
          ],
        },
      ]}
    />
  );
}
