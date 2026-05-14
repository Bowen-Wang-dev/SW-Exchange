import { PageTemplate } from "@/components/page-template";

export default function AdminAirdropPage() {
  return (
    <PageTemplate
      eyebrow="Admin"
      title="Airdrop"
      description="Airdrops are the initial way for admins to inject SWC or SWL into the simulated platform economy."
      cards={[
        {
          title: "Planned workflow",
          points: [
            "Find a user by email or username.",
            "Choose SWC or SWL and enter an amount.",
            "Write wallet updates, ledger entries, and audit logs in one transaction.",
          ],
        },
        {
          title: "Accounting notes",
          points: [
            "Use minimal-unit integers, not floating-point math.",
            "Label entries as AIRDROP with meaningful references.",
            "Keep free-form notes for internal admin context.",
          ],
        },
      ]}
    />
  );
}
