"use client";

import { FormEvent, useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest, ApiError } from "@/lib/api-client";
import type {
  AdminWalletBucketBalance,
  AdminWalletBucketTransferResponse,
  WalletBalance,
  WalletType,
} from "@/lib/api-types";
import { shortId } from "@/lib/format";

type ActiveTab = "admin" | "system";

const WALLET_TYPES: WalletType[] = ["MAIN", "FEE", "TREASURY", "AIRDROP", "HOT"];

export default function AdminWalletsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("admin");
  const [adminWallets, setAdminWallets] = useState<WalletBalance[]>([]);
  const [systemWallets, setSystemWallets] = useState<AdminWalletBucketBalance[]>([]);
  const [fromWalletType, setFromWalletType] = useState<WalletType>("FEE");
  const [toWalletType, setToWalletType] = useState<WalletType>("MAIN");
  const [assetSymbol, setAssetSymbol] = useState<"SWC" | "SWL">("SWC");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<AdminWalletBucketTransferResponse | null>(null);

  useEffect(() => {
    void loadWallets();
  }, []);

  async function loadWallets() {
    try {
      setIsLoading(true);
      const [adminWalletResponse, systemWalletResponse] = await Promise.all([
        apiRequest<WalletBalance[]>("/admin/wallet"),
        apiRequest<AdminWalletBucketBalance[]>("/admin/system-wallets"),
      ]);
      setAdminWallets(adminWalletResponse);
      setSystemWallets(systemWalletResponse);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : "Unable to load wallets.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleBucketTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      setIsSubmitting(true);
      const response = await apiRequest<AdminWalletBucketTransferResponse>(
        "/admin/wallet-buckets/transfer",
        {
          method: "POST",
          body: {
            fromWalletType,
            toWalletType,
            assetSymbol,
            amount: amount.trim(),
            ...(note.trim() ? { note: note.trim() } : {}),
          },
        },
      );

      setSuccess(response);
      setAmount("");
      setNote("");
      await loadWallets();
    } catch (transferError) {
      setError(
        transferError instanceof ApiError
          ? transferError.message
          : "Unable to complete admin bucket transfer.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Admin Wallets"
            title="Wallet buckets"
            description="Review the admin MAIN wallet and platform wallet buckets for SWC and SWL."
            action={<StatusBadge label="Wallet Buckets" tone="info" />}
          />

          <div className="flex flex-wrap gap-2">
            <TabButton active={activeTab === "admin"} onClick={() => setActiveTab("admin")}>
              Admin Wallet
            </TabButton>
            <TabButton active={activeTab === "system"} onClick={() => setActiveTab("system")}>
              System Wallets
            </TabButton>
          </div>

          {error ? <Notice tone="danger" message={error} /> : null}
          {success ? (
            <Notice
              tone="success"
              message={`Moved ${success.amount} ${success.assetSymbol} from ${success.fromWalletType} to ${success.toWalletType}. Audit: ${shortId(success.auditLogId)}.`}
            />
          ) : null}
          {isLoading ? <Notice tone="info" message="Loading wallets..." /> : null}

          {!isLoading && activeTab === "admin" ? <AdminWalletTab wallets={adminWallets} /> : null}
          {!isLoading && activeTab === "system" ? (
            <SystemWalletsTab
              wallets={systemWallets}
              fromWalletType={fromWalletType}
              toWalletType={toWalletType}
              assetSymbol={assetSymbol}
              amount={amount}
              note={note}
              isSubmitting={isSubmitting}
              onFromWalletTypeChange={setFromWalletType}
              onToWalletTypeChange={setToWalletType}
              onAssetSymbolChange={setAssetSymbol}
              onAmountChange={setAmount}
              onNoteChange={setNote}
              onSubmit={handleBucketTransfer}
            />
          ) : null}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function AdminWalletTab({ wallets }: { wallets: WalletBalance[] }) {
  return (
    <div className="space-y-4">
      <Notice
        tone="info"
        message="Admin Wallet is the admin user's own internal MAIN wallet. It is separate from platform system wallet buckets."
      />
      {wallets.length > 0 ? (
        <DataTable
          columns={["Asset", "Name", "Available", "Locked", "Total"]}
          rows={wallets.map((wallet) => [
            <span key={`${wallet.id}-asset`} className="font-medium text-white">
              {wallet.asset}
            </span>,
            wallet.name,
            wallet.available,
            wallet.locked,
            wallet.total,
          ])}
        />
      ) : (
        <Notice tone="info" message="No admin MAIN wallets found." />
      )}
    </div>
  );
}

function SystemWalletsTab({
  wallets,
  fromWalletType,
  toWalletType,
  assetSymbol,
  amount,
  note,
  isSubmitting,
  onFromWalletTypeChange,
  onToWalletTypeChange,
  onAssetSymbolChange,
  onAmountChange,
  onNoteChange,
  onSubmit,
}: {
  wallets: AdminWalletBucketBalance[];
  fromWalletType: WalletType;
  toWalletType: WalletType;
  assetSymbol: "SWC" | "SWL";
  amount: string;
  note: string;
  isSubmitting: boolean;
  onFromWalletTypeChange: (value: WalletType) => void;
  onToWalletTypeChange: (value: WalletType) => void;
  onAssetSymbolChange: (value: "SWC" | "SWL") => void;
  onAmountChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="space-y-4">
        <Notice
          tone="info"
          message={
            "System wallets are admin-controlled platform wallet buckets. Fee Wallet is active, Airdrop is a placeholder for future funding rules, and Hot Wallet is a future chain placeholder."
          }
        />
        {wallets.length > 0 ? (
          <DataTable
            columns={["Wallet", "Status", "Asset", "Available", "Locked", "Total"]}
            rows={wallets.map((wallet) => [
              <span key={`${wallet.id}-wallet`} className="font-medium text-white">
                {wallet.displayName}
              </span>,
              <StatusBadge
                key={`${wallet.id}-status`}
                label={wallet.status}
                tone={bucketStatusTone(wallet.status)}
              />,
              wallet.asset,
              wallet.available,
              wallet.locked,
              wallet.total,
            ])}
          />
        ) : (
          <Notice tone="info" message="No system wallet buckets found." />
        )}
      </section>

      <section className="panel rounded-3xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
              Bucket Transfer
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">Move admin bucket funds</h2>
          </div>
          <StatusBadge label="Free" tone="success" />
        </div>

        <p className="mt-3 text-sm text-[var(--foreground-soft)]">
          Admin bucket transfers are internal and free. To send system funds to a user, first
          transfer from a system wallet to Admin Main Wallet, then use normal internal transfer.
        </p>

        <form onSubmit={onSubmit} className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
            From wallet type
            <select
              value={fromWalletType}
              onChange={(event) => onFromWalletTypeChange(event.target.value as WalletType)}
              className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
            >
              {WALLET_TYPES.map((walletType) => (
                <option key={walletType} value={walletType}>
                  {walletType}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
            To wallet type
            <select
              value={toWalletType}
              onChange={(event) => onToWalletTypeChange(event.target.value as WalletType)}
              className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
            >
              {WALLET_TYPES.map((walletType) => (
                <option key={walletType} value={walletType}>
                  {walletType}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
            Asset
            <select
              value={assetSymbol}
              onChange={(event) => onAssetSymbolChange(event.target.value as "SWC" | "SWL")}
              className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
            >
              <option value="SWC">SWC</option>
              <option value="SWL">SWL</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
            Amount
            <input
              value={amount}
              onChange={(event) => onAmountChange(event.target.value)}
              placeholder="100 or 12.34"
              inputMode="decimal"
              className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
            />
          </label>

          <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
            Note
            <textarea
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder="Optional audit note"
              rows={3}
              className="resize-none rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Moving funds..." : "Transfer bucket funds"}
          </button>
        </form>
      </section>
    </div>
  );
}

function bucketStatusTone(status: AdminWalletBucketBalance["status"]) {
  if (status === "ACTIVE") {
    return "success";
  }

  if (status === "FUTURE_V1") {
    return "info";
  }

  return "warning";
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
          : "border-[var(--border)] bg-white/[0.03] text-[var(--foreground-soft)] hover:border-[var(--border-strong)] hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function Notice({
  tone,
  message,
}: {
  tone: "success" | "danger" | "info";
  message: string;
}) {
  const classes =
    tone === "danger"
      ? "border-rose-300/20 bg-rose-300/10 text-rose-100"
      : tone === "success"
        ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
        : "border-blue-300/20 bg-blue-300/10 text-blue-100";

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${classes}`}>{message}</div>;
}
