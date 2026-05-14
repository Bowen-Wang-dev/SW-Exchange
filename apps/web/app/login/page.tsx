import { AppShell } from "@/components/shell/app-shell";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <AppShell>
      <div className="flex min-h-[70vh] items-center justify-center">
        <LoginForm />
      </div>
    </AppShell>
  );
}
