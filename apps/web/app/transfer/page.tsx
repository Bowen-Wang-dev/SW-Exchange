import { PageTemplate } from "@/components/page-template";

export default function TransferPage() {
  return (
    <PageTemplate
      eyebrow="User"
      title="Transfer"
      description="Internal transfers will let users send SWC or SWL to another user by username or email, with no transfer fee in v0.x."
      cards={[
        {
          title: "Planned flow",
          points: [
            "Recipient lookup by username or email.",
            "Asset selector for SWC or SWL.",
            "Amount entry using precise integer minimal units in the API.",
          ],
        },
        {
          title: "Validation notes",
          points: [
            "Reject self-transfer and invalid amounts.",
            "Reject transfers for frozen users.",
            "Complete transfers immediately with paired ledger entries.",
          ],
        },
      ]}
    />
  );
}
