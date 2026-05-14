import { AppShell } from "@/components/shell/app-shell";
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return (
    <AppShell>
      <div className="flex min-h-[70vh] items-center justify-center">
        <RegisterForm />
      </div>
    </AppShell>
  );
}
