import { PageTemplate } from "@/components/page-template";

export default function RegisterPage() {
  return (
    <PageTemplate
      eyebrow="Auth"
      title="Register"
      description="Public registration stays open in v0.x, with email, username, and password as the initial account fields."
      cards={[
        {
          title: "Planned registration flow",
          points: [
            "Collect email, username, and password.",
            "Create a USER account and issue a JWT.",
            "Automatically prepare internal wallets for SWC and SWL.",
          ],
        },
        {
          title: "Guardrails",
          points: [
            "No KYC required in this version.",
            "No blockchain address generation yet.",
            "Validation should reject duplicate emails and usernames.",
          ],
        },
      ]}
    />
  );
}
