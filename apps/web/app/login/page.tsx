import { PageTemplate } from "@/components/page-template";

export default function LoginPage() {
  return (
    <PageTemplate
      eyebrow="Auth"
      title="Login"
      description="Users will sign in with email or username plus password, then receive a JWT-backed session from the API."
      cards={[
        {
          title: "Planned form fields",
          points: [
            "Identifier input supporting email or username.",
            "Password field with JWT login flow.",
            "Role-aware redirect after successful authentication.",
          ],
        },
        {
          title: "v0.x rules",
          points: [
            "BANNED users should be blocked from login.",
            "FROZEN users may log in but should not trade or transfer.",
            "A single seeded admin will use the same auth foundation.",
          ],
        },
      ]}
    />
  );
}
