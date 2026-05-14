import { PageTemplate } from "@/components/page-template";

export default function WalletPage() {
  return (
    <PageTemplate
      eyebrow="User"
      title="Wallet"
      description="Wallets are internal only in v0.x, with available and locked balances tracked in minimal units instead of floating-point values."
      cards={[
        {
          title: "Balances",
          points: [
            "Show SWC and SWL rows with available and locked balances.",
            "Display asset precision and active status from the API.",
            "Prepare hooks for future wallet history filters.",
          ],
        },
        {
          title: "Accounting rules",
          points: [
            "No direct balance edits outside controlled business actions.",
            "Every change must map back to a ledger entry.",
            "Locked balance is reserved for open orders and future controls.",
          ],
        },
      ]}
    />
  );
}
