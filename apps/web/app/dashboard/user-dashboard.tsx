"use client";

import { useEffect, useState } from "react";
import { PortfolioAssetPanel } from "@/components/portfolio/portfolio-asset-panel";
import { PageHeader } from "@/components/shell/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ApiError, apiRequest } from "@/lib/api-client";
import type {
  EmailVerificationConfirmResponse,
  EmailVerificationRequestResponse,
  MarketSummary,
  PortfolioValuation,
} from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { CURRENT_MILESTONE_VERSION, REAL_TIME_SYNC_COPY } from "@/lib/milestone-copy";
import { useAuth } from "@/providers/auth-provider";

export function DashboardContent() {
  const { loadMe, user } = useAuth();
  const [valuation, setValuation] = useState<PortfolioValuation | null>(null);
  const [markets, setMarkets] = useState<MarketSummary[]>([]);
  const [verificationToken, setVerificationToken] = useState("");
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verificationExpiresAt, setVerificationExpiresAt] = useState<string | null>(null);
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [isConfirmingVerification, setIsConfirmingVerification] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadPortfolio() {
      try {
        const [valuationResponse, marketResponse] = await Promise.all([
          apiRequest<PortfolioValuation>("/wallets/me/valuation"),
          apiRequest<MarketSummary[]>("/markets/summary"),
        ]);
        if (active) {
          setValuation(valuationResponse);
          setMarkets(marketResponse);
        }
      } catch {
        if (active) {
          setValuation(null);
          setMarkets([]);
        }
      }
    }

    void loadPortfolio();

    const intervalId = window.setInterval(() => {
      void loadPortfolio();
    }, 5000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const swcAsset = valuation?.assets.find((asset) => asset.assetSymbol === "SWC");
  const nonQuoteAssets = valuation?.assets.filter((asset) => asset.assetSymbol !== "SWC") ?? [];
  const valuationAssets = valuation?.assets ?? [];
  const primaryBaseAsset = nonQuoteAssets.find((asset) => asset.assetSymbol === "SWL") ?? nonQuoteAssets[0];
  const swcBalance = swcAsset?.total ?? "0";
  const swcValue = swcAsset?.valueInSWC ?? "0";
  const baseBalance = primaryBaseAsset?.total ?? "0";
  const baseValue = primaryBaseAsset?.valueInSWC;
  const totalEquity = `${valuation?.totalEquity ?? "0"} SWC`;
  const valuationPending = Boolean(valuation?.hasUnpricedAssets);
  const visibleNonZeroAssets = valuationAssets.filter((asset) => BigInt(asset.totalRaw) > 0n).length;
  const lockedAssets = valuationAssets.filter((asset) => BigInt(asset.lockedRaw) > 0n).length;
  const emailVerifiedAt = user?.emailVerifiedAt ? formatDateTime(user.emailVerifiedAt) : null;

  async function requestEmailVerification() {
    try {
      setIsSendingVerification(true);
      setVerificationError(null);
      const response = await apiRequest<EmailVerificationRequestResponse>(
        "/auth/email-verification/request",
        {
          method: "POST",
        },
      );

      setVerificationExpiresAt(response.expiresAt);
      setVerificationMessage(
        response.alreadyVerified
          ? "This account is already verified."
          : response.deliveryProvider === "console"
            ? "Verification sent through the dev console mail provider. Use the link or token shown in the API log."
            : "Verification request accepted.",
      );
      await loadMe();
    } catch (error) {
      setVerificationError(
        error instanceof ApiError ? error.message : "Unable to send the verification email.",
      );
    } finally {
      setIsSendingVerification(false);
    }
  }

  async function confirmEmailVerification() {
    const token = verificationToken.trim();
    if (!token) {
      setVerificationError("Enter the verification token first.");
      return;
    }

    try {
      setIsConfirmingVerification(true);
      setVerificationError(null);
      const response = await apiRequest<EmailVerificationConfirmResponse>(
        "/auth/email-verification/confirm",
        {
          method: "POST",
          body: { token },
        },
      );

      setVerificationToken("");
      setVerificationExpiresAt(null);
      setVerificationMessage(
        response.alreadyVerified
          ? "This email was already verified and the token has now been consumed."
          : "Email verification completed successfully.",
      );
      await loadMe();
    } catch (error) {
      setVerificationError(
        error instanceof ApiError ? error.message : "Unable to confirm the verification token.",
      );
    } finally {
      setIsConfirmingVerification(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="User Dashboard"
        title={`Welcome ${user?.username ?? "Trader"}`}
        description={`Your ${CURRENT_MILESTONE_VERSION} console shows live balances, asset icons, market ticker data, interactive K-line candles, SWC portfolio valuation, limit and market orders, safer confirmations, refreshed trade UX, fee settlement, admin status controls, and manual listing support. ${REAL_TIME_SYNC_COPY}`}
        action={
          <StatusBadge
            label={user?.status ?? "ACTIVE"}
            tone={user?.status === "ACTIVE" ? "success" : "warning"}
          />
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Equity"
          badgeLabel="Live"
          value={totalEquity}
          hint={
            valuationPending
              ? "SWC-only for any assets that do not have a last traded SWC price yet."
              : "SWC-denominated value including available and locked balances."
          }
          tone="info"
        />
        <StatCard
          label="SWC Balance/Value"
          badgeLabel="Live"
          value={`${swcBalance} SWC`}
          hint={`Estimated value: ${swcValue} SWC.`}
          tone="success"
        />
        <StatCard
          label={`${primaryBaseAsset?.assetSymbol ?? "Base"} Balance/Value`}
          badgeLabel={primaryBaseAsset?.priceInSWC === null ? "Pending" : "Live"}
          value={`${baseBalance} ${primaryBaseAsset?.assetSymbol ?? ""}`.trim()}
          hint={
            primaryBaseAsset?.priceInSWC === null
              ? `${primaryBaseAsset.assetSymbol} valuation pending until trades exist.`
              : `Estimated value: ${baseValue ?? "0"} SWC at last price ${primaryBaseAsset?.priceInSWC ?? "—"}.`
          }
          tone="warning"
        />
        <StatCard
          label="Active Assets"
          badgeLabel="Portfolio"
          value={`${visibleNonZeroAssets} active`}
          hint={
            lockedAssets > 0
              ? `${lockedAssets} asset${lockedAssets === 1 ? "" : "s"} include locked balances in open orders.`
              : "No locked balances in the visible portfolio snapshot."
          }
          tone={lockedAssets > 0 ? "warning" : "neutral"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <section className="panel rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                Account Snapshot
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">Profile status</h2>
            </div>
            <StatusBadge label={user?.role ?? "USER"} tone="info" />
          </div>

          <div className="data-divider mt-5 rounded-2xl border border-[var(--border)]">
            <div className="px-4 py-3 text-sm text-[var(--foreground-soft)]">
              Username: <span className="font-medium text-[var(--foreground)]">{user?.username ?? "-"}</span>
            </div>
            <div className="px-4 py-3 text-sm text-[var(--foreground-soft)]">
              Email: <span className="font-medium text-[var(--foreground)]">{user?.email ?? "-"}</span>
            </div>
            <div className="px-4 py-3 text-sm text-[var(--foreground-soft)]">
              Email verification:{" "}
              <span className="font-medium text-[var(--foreground)]">
                {user?.emailVerified ? "VERIFIED" : "UNVERIFIED"}
              </span>
            </div>
            <div className="px-4 py-3 text-sm text-[var(--foreground-soft)]">
              Role: <span className="font-medium text-[var(--foreground)]">{user?.role ?? "USER"}</span>
            </div>
            <div className="px-4 py-3 text-sm text-[var(--foreground-soft)]">
              Status: <span className="font-medium text-[var(--foreground)]">{user?.status ?? "ACTIVE"}</span>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">Account security</p>
                <p className="mt-1 text-sm text-[var(--foreground-soft)]">
                  Email verification now exists as a security foundation, but it is not yet required
                  for login, trading, transfer, or admin review flows in this milestone.
                </p>
              </div>
              <StatusBadge
                label={user?.emailVerified ? "Verified" : "Unverified"}
                tone={user?.emailVerified ? "success" : "warning"}
              />
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[auto_1fr]">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--foreground-soft)]">
                <div>
                  Current email: <span className="font-medium text-[var(--foreground)]">{user?.email ?? "-"}</span>
                </div>
                <div className="mt-1">
                  Verified at:{" "}
                  <span className="font-medium text-[var(--foreground)]">
                    {emailVerifiedAt ?? "Not verified yet"}
                  </span>
                </div>
                {verificationExpiresAt ? (
                  <div className="mt-1">
                    Latest token expires:{" "}
                    <span className="font-medium text-[var(--foreground)]">
                      {formatDateTime(verificationExpiresAt)}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void requestEmailVerification()}
                    disabled={isSendingVerification}
                    className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSendingVerification ? "Sending..." : user?.emailVerified ? "Send Again" : "Send Verification Email"}
                  </button>
                  <a
                    href="/verify-email"
                    className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--foreground-soft)] transition hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
                  >
                    Open Verification Page
                  </a>
                </div>

                <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                  <input
                    value={verificationToken}
                    onChange={(event) => setVerificationToken(event.target.value)}
                    placeholder="Paste email verification token"
                    className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                  />
                  <button
                    type="button"
                    onClick={() => void confirmEmailVerification()}
                    disabled={isConfirmingVerification}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isConfirmingVerification ? "Confirming..." : "Confirm Token"}
                  </button>
                </div>
              </div>
            </div>

            {verificationMessage ? (
              <div className="mt-3 rounded-2xl border border-[var(--notice-success-border)] bg-[var(--notice-success-bg)] px-4 py-3 text-sm text-[var(--notice-success-text)]">
                {verificationMessage}
              </div>
            ) : null}
            {verificationError ? (
              <div className="mt-3 rounded-2xl border border-[var(--notice-danger-border)] bg-[var(--notice-danger-bg)] px-4 py-3 text-sm text-[var(--notice-danger-text)]">
                {verificationError}
              </div>
            ) : null}
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--notice-warning-border)] bg-[var(--notice-warning-bg)] px-4 py-3 text-sm text-[var(--notice-warning-text)]">
            SW Exchange v0.x is an off-chain simulated exchange. No deposit, withdraw, blockchain, or real-money redemption is live.
          </div>
        </section>

        <PortfolioAssetPanel
          assets={valuationAssets}
          markets={markets}
          storageKey="swx-dashboard-portfolio-assets"
          eyebrow="Portfolio Value"
          title="Asset valuation"
        />
      </div>
    </div>
  );
}
