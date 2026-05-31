"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ApiError, apiRequest } from "@/lib/api-client";
import type { EmailVerificationConfirmResponse } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";

export function VerifyEmailClient() {
  const searchParams = useSearchParams();
  const { isAuthenticated, loadMe } = useAuth();
  const authenticated = isAuthenticated();
  const token = useMemo(() => searchParams.get("token")?.trim() || "", [searchParams]);
  const attemptedTokenRef = useRef<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    token ? "loading" : "idle",
  );
  const [message, setMessage] = useState(
    token
      ? "Confirming your email token..."
      : "Paste the token from the verification email or open the verification link directly.",
  );
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function confirmToken(currentToken: string) {
      try {
        setStatus("loading");
        const response = await apiRequest<EmailVerificationConfirmResponse>(
          "/auth/email-verification/confirm",
          {
            method: "POST",
            body: { token: currentToken },
          },
        );

        if (!active) {
          return;
        }

        setVerifiedAt(response.emailVerifiedAt);
        setStatus("success");
        setMessage(
          response.alreadyVerified
            ? "This email was already verified. The token has been consumed safely."
            : "Your email has been verified successfully.",
        );
        if (authenticated) {
          await loadMe();
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setStatus("error");
        setMessage(
          error instanceof ApiError
            ? error.message
            : "Unable to confirm the email verification token.",
        );
      }
    }

    if (token && attemptedTokenRef.current !== token) {
      attemptedTokenRef.current = token;
      void confirmToken(token);
    }

    return () => {
      active = false;
    };
  }, [authenticated, loadMe, token]);

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          eyebrow="Account Security"
          title="Email verification"
          description="This v1.0.2 foundation confirms email ownership without blocking login or trading. Sensitive-action enforcement remains future work."
          action={
            <StatusBadge
              label={
                status === "success"
                  ? "Verified"
                  : status === "error"
                    ? "Error"
                    : status === "loading"
                      ? "Checking"
                      : "Ready"
              }
              tone={
                status === "success"
                  ? "success"
                  : status === "error"
                    ? "danger"
                    : status === "loading"
                      ? "warning"
                      : "info"
              }
            />
          }
        />

        <section className="panel rounded-3xl p-5">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
            <p className="text-sm text-[var(--foreground-soft)]">{message}</p>
            {verifiedAt ? (
              <p className="mt-2 text-sm text-[var(--foreground-soft)]">
                Verified at:{" "}
                <span className="font-medium text-[var(--foreground)]">{formatDateTime(verifiedAt)}</span>
              </p>
            ) : null}
            {!token ? (
              <p className="mt-2 text-sm text-[var(--foreground-muted)]">
                Use the verification link from the email, or paste the token into the Dashboard security card.
              </p>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={authenticated ? "/dashboard" : "/login"}
              className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[var(--accent-strong)]"
            >
              {authenticated ? "Go to Dashboard" : "Go to Login"}
            </Link>
            <Link
              href="/dashboard"
              className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--foreground-soft)] transition hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
            >
              Open Security Card
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
