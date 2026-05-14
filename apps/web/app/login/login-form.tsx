"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/providers/auth-provider";

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const user = await login(identifier, password);
      const next =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("next")
          : null;

      if (next) {
        router.push(next);
        return;
      }

      router.push(user.role === "ADMIN" ? "/admin" : "/dashboard");
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Login failed. Please try again.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="panel-strong rounded-[28px] p-6 sm:p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
          SW Exchange
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-white">Sign in to the exchange</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--foreground-soft)]">
          Use your email or username plus password to access the simulated trading environment.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Field
            label="Identifier"
            name="identifier"
            autoComplete="username"
            placeholder="Email or username"
            value={identifier}
            onChange={setIdentifier}
          />
          <Field
            label="Password"
            name="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={setPassword}
            type="password"
          />

          {error ? (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Signing in..." : "Login"}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between gap-3 text-sm">
          <span className="text-[var(--foreground-muted)]">No account yet?</span>
          <Link href="/register" className="font-medium text-[var(--accent-strong)]">
            Register
          </Link>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  autoComplete,
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  name: string;
  autoComplete?: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
        {label}
      </span>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required
        className="w-full rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
      />
    </label>
  );
}
