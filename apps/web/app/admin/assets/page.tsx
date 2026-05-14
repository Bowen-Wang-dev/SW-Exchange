import { PageTemplate } from "@/components/page-template";

export default function AdminAssetsPage() {
  return (
    <PageTemplate
      eyebrow="Admin"
      title="Asset management"
      description="The asset area will keep the initial SWC and SWL setup visible and allow simple active or paused status management later."
      cards={[
        {
          title: "Seeded assets",
          points: [
            "SWC as the internal settlement unit with HKD reference pricing only.",
            "SWL as the internal volatile token.",
            "Both seeded with 18 decimals in the initial database.",
          ],
        },
        {
          title: "Later controls",
          points: [
            "Toggle whether an asset is active for platform usage.",
            "Expose asset metadata to wallet and trading screens.",
            "Avoid introducing real-world redemption claims in product copy.",
          ],
        },
      ]}
    />
  );
}
