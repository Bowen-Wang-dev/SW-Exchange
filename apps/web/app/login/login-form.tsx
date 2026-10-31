"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LoginChallenge } from "@/lib/auth";
import { useAuth } from "@/providers/auth-provider";

export function LoginForm() {
  const router = useRouter();
  const { login, completeTwoFactorLogin } = useAuth();
  const [challenge, setChallenge] = useState<LoginChallenge | null>(null);
  const [code, setCode] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (challenge && Date.now() >= Date.parse(challenge.expiresAt)) {
        setChallenge(null);
        setCode("");
        throw new Error("Login challenge expired. Please enter your password again.");
      }
      const user = challenge ? await completeTwoFactorLogin(challenge.challengeToken, code.trim()) : await login(identifier, password);
      if ("twoFactorRequired" in user) {
        setChallenge(user);
        setPassword("");
        setAttempts(0);
        return;
      }
      const next = getSafeNextPath();

      if (next) {
        router.push(next);
        return;
      }

      router.push(user.role === "ADMIN" ? "/admin" : "/dashboard");
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Login failed. Please try again.";
      setError(message);
      setCode("");
      if (challenge) {
        setAttempts(attempts + 1);
        if (attempts + 1 >= 5 || Date.now() >= Date.parse(challenge.expiresAt)) {
          setChallenge(null);
          setError("Please sign in again to start a new verification attempt.");
        }
      }
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
        <h1 className="mt-4 text-3xl font-semibold text-[var(--foreground)]">Sign in to the exchange</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--foreground-soft)]">
          Use your email or username plus password to access the simulated trading environment.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {!challenge ? <>
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

          </> : <>
            <p className="text-sm text-[var(--foreground-soft)]">Enter a fresh 6-digit authenticator code or one unused recovery code. This login attempt expires in 5 minutes.</p>
            <Field label="Authenticator or recovery code" name="second-factor" autoComplete="one-time-code" placeholder="6 digits or recovery code" value={code} onChange={setCode} />
            <button type="button" disabled={isSubmitting} className="text-sm text-[var(--accent)]" onClick={() => { setChallenge(null); setCode(""); setError(null); }}>Start again with password</button>
          </>}

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
            {isSubmitting ? "Signing in..." : challenge ? "Verify and sign in" : "Login"}
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

function getSafeNextPath() {
  if (typeof window === "undefined") {
    return null;
  }

  const next = new URLSearchParams(window.location.search).get("next");
  if (!next?.startsWith("/") || next.startsWith("//")) {
    return null;
  }

  try {
    const nextUrl = new URL(next, window.location.origin);
    if (nextUrl.origin !== window.location.origin) {
      return null;
    }

    return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
  } catch {
    return null;
  }
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
        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
      />
    </label>
  );
}
