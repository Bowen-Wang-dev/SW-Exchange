"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/providers/auth-provider";

export function RegisterForm() {
  const router = useRouter();
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await register(email, username, password, nickname);
      router.push("/dashboard");
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Registration failed. Please try again.";
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
        <h1 className="mt-4 text-3xl font-semibold text-[var(--foreground)]">Create your account</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--foreground-soft)]">
          Registration is public in v0.x. Your account opens an internal-only simulated trading
          profile with no deposit or withdraw features.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Field
            label="Email"
            name="email"
            autoComplete="email"
            placeholder="name@example.com"
            value={email}
            onChange={setEmail}
          />
          <Field
            label="Username"
            name="username"
            autoComplete="username"
            placeholder="Choose a username"
            value={username}
            onChange={setUsername}
          />
          <Field
            label="Nickname"
            name="nickname"
            autoComplete="nickname"
            placeholder="Optional display nickname"
            value={nickname}
            onChange={setNickname}
          />
          <Field
            label="Password"
            name="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={setPassword}
            type="password"
          />

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-xs leading-5 text-[var(--foreground-soft)]">
            The nickname field is optional. The backend stores email, username, password, and
            nickname for admin review.
          </div>

          {error ? (
            <div className="rounded-2xl border border-[var(--notice-danger-border)] bg-[var(--notice-danger-bg)] px-4 py-3 text-sm text-[var(--notice-danger-text)]">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Creating account..." : "Register"}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between gap-3 text-sm">
          <span className="text-[var(--foreground-muted)]">Already registered?</span>
          <Link href="/login" className="font-medium text-[var(--accent-strong)]">
            Login
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
        required={label !== "Nickname"}
        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
      />
    </label>
  );
}
