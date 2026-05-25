"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AdminConfirmationDialog,
  type AdminConfirmationView,
} from "@/components/admin/admin-confirmation-dialog";
import { AdminNotice } from "@/components/admin/admin-notice";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { AssetIdentity } from "@/components/ui/asset-icon";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest, ApiError } from "@/lib/api-client";
import type {
  AdminWalletBucketBalance,
  AdminWalletBucketTransferResponse,
  AssetRow,
  WalletBalance,
  WalletType,
} from "@/lib/api-types";
import { shortId } from "@/lib/format";

type ActiveTab = "admin" | "system";

type PendingTransferAction = {
  fromWalletType: WalletType;
  toWalletType: WalletType;
  assetSymbol: string;
  amount: string;
  note: string;
};

const WALLET_TYPES: WalletType[] = ["MAIN", "FEE", "TREASURY", "AIRDROP", "HOT"];

export default function AdminWalletsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("admin");
  const [adminWallets, setAdminWallets] = useState<WalletBalance[]>([]);
  const [systemWallets, setSystemWallets] = useState<AdminWalletBucketBalance[]>([]);
  const [fromWalletType, setFromWalletType] = useState<WalletType>("FEE");
  const [toWalletType, setToWalletType] = useState<WalletType>("MAIN");
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [assetSymbol, setAssetSymbol] = useState("SWC");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingTransferAction | null>(null);
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
      setAssets(
        adminWalletResponse
          .map((wallet) => ({
            id: wallet.assetId ?? wallet.asset,
            symbol: wallet.asset,
            name: wallet.name,
            decimals: wallet.decimals,
            isActive: true,
          }))
          .filter((asset, index, assetRows) =>
            assetRows.findIndex((candidate) => candidate.symbol === asset.symbol) === index,
          ),
      );
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : "Unable to load wallets.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleBucketTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setPendingAction({
      fromWalletType,
      toWalletType,
      assetSymbol,
      amount: amount.trim(),
      note,
    });
  }

  async function confirmBucketTransfer() {
    if (!pendingAction) {
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await apiRequest<AdminWalletBucketTransferResponse>(
        "/admin/wallet-buckets/transfer",
        {
          method: "POST",
          body: {
            fromWalletType: pendingAction.fromWalletType,
            toWalletType: pendingAction.toWalletType,
            assetSymbol: pendingAction.assetSymbol,
            amount: pendingAction.amount,
            ...(pendingAction.note.trim() ? { note: pendingAction.note.trim() } : {}),
          },
        },
      );

      setSuccess(response);
      setPendingAction(null);
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

  const confirmation = useMemo(() => {
    if (!pendingAction) {
      return null;
    }

    return buildTransferConfirmation(pendingAction, isSubmitting);
  }, [pendingAction, isSubmitting]);

  return (
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Admin Wallets"
            title="Wallet buckets"
            description="Review admin MAIN balances and platform bucket roles with safer transfer confirmations."
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

          <AdminNotice
            tone="info"
            message="FEE receives trading fees, TREASURY is the platform treasury bucket, AIRDROP currently exists but airdrop flow does not consume it yet, and HOT remains a future chain placeholder."
          />
          {error ? <AdminNotice tone="danger" message={error} /> : null}
          {success ? (
            <AdminNotice
              tone="success"
              message={`Moved ${success.amount} ${success.assetSymbol} from ${success.fromWalletType} to ${success.toWalletType}. Audit: ${shortId(success.auditLogId)}.`}
            />
          ) : null}
          {isLoading ? <AdminNotice tone="info" message="Loading wallets..." /> : null}

          {!isLoading && activeTab === "admin" ? <AdminWalletTab wallets={adminWallets} /> : null}
          {!isLoading && activeTab === "system" ? (
            <SystemWalletsTab
              wallets={systemWallets}
              fromWalletType={fromWalletType}
              toWalletType={toWalletType}
              assetSymbol={assetSymbol}
              assets={assets}
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

        <AdminConfirmationDialog
          confirmation={
            confirmation
              ? {
                  ...confirmation,
                  noteValue: pendingAction?.note ?? "",
                  onNoteChange: (value) =>
                    setPendingAction((current) => (current ? { ...current, note: value } : current)),
                }
              : null
          }
          isSubmitting={isSubmitting}
          onCancel={() => {
            if (!isSubmitting) {
              setPendingAction(null);
            }
          }}
          onConfirm={() => void confirmBucketTransfer()}
        />
      </AppShell>
    </ProtectedRoute>
  );
}

function AdminWalletTab({ wallets }: { wallets: WalletBalance[] }) {
  return (
    <div className="space-y-4">
      <AdminNotice
        tone="info"
        message="Admin Wallet is the admin user's own internal MAIN wallet. It is separate from the platform's FEE, TREASURY, AIRDROP, and HOT buckets."
      />
      {wallets.length > 0 ? (
        <DataTable
          columns={["Asset", "Name", "Available", "Locked", "Total"]}
          rows={wallets.map((wallet) => [
            <AssetIdentity
              key={`${wallet.id}-asset`}
              symbol={wallet.asset}
              name={wallet.name}
              displayName={wallet.displayName}
              iconUrl={wallet.iconUrl}
            />,
            wallet.displayName ?? wallet.name,
            wallet.available,
            wallet.locked,
            wallet.total,
          ])}
        />
      ) : (
        <AdminNotice tone="info" message="No admin MAIN wallets found." />
      )}
    </div>
  );
}

function SystemWalletsTab({
  wallets,
  fromWalletType,
  toWalletType,
  assetSymbol,
  assets,
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
  assetSymbol: string;
  assets: AssetRow[];
  amount: string;
  note: string;
  isSubmitting: boolean;
  onFromWalletTypeChange: (value: WalletType) => void;
  onToWalletTypeChange: (value: WalletType) => void;
  onAssetSymbolChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="space-y-4">
        <DataTable
          columns={["Wallet", "Status", "Asset", "Available", "Locked", "Total"]}
          rows={wallets.map((wallet) => [
            <span key={`${wallet.id}-wallet`} className="font-medium text-[var(--foreground)]">
              {wallet.displayName}
            </span>,
            <StatusBadge
              key={`${wallet.id}-status`}
              label={wallet.status}
              tone={bucketStatusTone(wallet.status)}
            />,
            <AssetIdentity
              key={`${wallet.id}-asset`}
              symbol={wallet.asset}
              name={wallet.name}
              displayName={wallet.displayName}
              iconUrl={wallet.iconUrl}
            />,
            wallet.available,
            wallet.locked,
            wallet.total,
          ])}
        />
      </section>

      <section className="panel rounded-3xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
              Bucket Transfer
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
              Move admin bucket funds
            </h2>
          </div>
          <StatusBadge label="Internal" tone="success" />
        </div>

        <p className="mt-3 text-sm text-[var(--foreground-soft)]">
          Bucket transfers are internal admin-only wallet movements. They do not create deposit or
          withdraw behavior and do not send funds directly to normal users.
        </p>

        <form onSubmit={onSubmit} className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
            From wallet type
            <select
              value={fromWalletType}
              onChange={(event) => onFromWalletTypeChange(event.target.value as WalletType)}
              className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
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
              className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
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
              onChange={(event) => onAssetSymbolChange(event.target.value)}
              className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
            >
              {buildAssetOptions(assets, assetSymbol).map((asset) => (
                <option key={asset} value={asset}>
                  {asset}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
            Amount
            <input
              value={amount}
              onChange={(event) => onAmountChange(event.target.value)}
              placeholder="100 or 12.34"
              inputMode="decimal"
              className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
            />
          </label>

          <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
            Audit note
            <textarea
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder="Optional audit note"
              rows={3}
              className="resize-none rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Moving funds..." : "Review bucket transfer"}
          </button>
        </form>
      </section>
    </div>
  );
}

function buildAssetOptions(assets: AssetRow[], selectedAsset: string) {
  const options = new Set<string>([selectedAsset]);
  for (const asset of assets) {
    options.add(asset.symbol);
  }

  return [...options].filter(Boolean);
}

function buildTransferConfirmation(
  pendingAction: PendingTransferAction,
  isSubmitting: boolean,
): AdminConfirmationView {
  return {
    eyebrow: "Confirm Bucket Transfer",
    title: `Move ${pendingAction.amount || "—"} ${pendingAction.assetSymbol}?`,
    description:
      "This performs an internal admin bucket transfer only. It does not create deposit, withdraw, or blockchain behavior.",
    confirmLabel: isSubmitting ? "Moving..." : "Confirm transfer",
    tone: "warning",
    details: [
      { label: "From", value: pendingAction.fromWalletType },
      { label: "To", value: pendingAction.toWalletType },
      { label: "Asset", value: pendingAction.assetSymbol },
      { label: "Amount", value: pendingAction.amount || "—" },
    ],
    impacts: [
      "Only available balance is moved between admin-owned buckets.",
      "Normal users do not directly receive funds from this action.",
      "A paired audit and ledger trail remains in place.",
    ],
    warning:
      "HOT remains a placeholder bucket for future chain integration and is not a live on-chain wallet in v0.x.",
    noteLabel: "Audit note (optional)",
    notePlaceholder: "Reason for moving bucket funds",
  };
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
          : "border-[var(--border)] bg-[var(--surface-strong)] text-[var(--foreground-soft)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
      }`}
    >
      {children}
    </button>
  );
}
