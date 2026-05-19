"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { AssetIcon, AssetIdentity } from "@/components/ui/asset-icon";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest, ApiError } from "@/lib/api-client";
import type { AssetRow } from "@/lib/api-types";

const INITIAL_CREATE_ASSET_FORM = {
  symbol: "",
  name: "",
  displayName: "",
  decimals: "18",
  iconUrl: "",
  description: "",
  status: "ACTIVE" as "ACTIVE" | "PAUSED",
};

export default function AdminAssetsPage() {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [editingAsset, setEditingAsset] = useState<AssetRow | null>(null);
  const [createAssetForm, setCreateAssetForm] = useState(INITIAL_CREATE_ASSET_FORM);
  const [metadataForm, setMetadataForm] = useState({
    displayName: "",
    iconUrl: "",
    description: "",
    sortOrder: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void loadAssets(active);

    return () => {
      active = false;
    };
  }, []);

  async function loadAssets(active = true) {
    try {
      setIsLoading(true);
      const response = await apiRequest<AssetRow[]>("/assets");
      if (active) {
        setAssets(response);
        setError(null);
      }
    } catch (loadError) {
      if (active) {
        setError(loadError instanceof ApiError ? loadError.message : "Unable to load assets.");
      }
    } finally {
      if (active) {
        setIsLoading(false);
      }
    }
  }

  async function handleCreateAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const symbol = createAssetForm.symbol.trim().toUpperCase();
    const name = createAssetForm.name.trim();
    const decimalsInput = createAssetForm.decimals.trim();
    const decimals = Number.parseInt(decimalsInput, 10);

    if (!/^[A-Z0-9]{2,16}$/.test(symbol)) {
      setError("Symbol must be 2-16 uppercase letters or numbers.");
      return;
    }

    if (!name) {
      setError("Name is required.");
      return;
    }

    if (!/^\d+$/.test(decimalsInput) || Number.isNaN(decimals) || decimals < 0 || decimals > 18) {
      setError("Decimals must be a whole number between 0 and 18.");
      return;
    }

    try {
      setIsCreating(true);
      const createdAsset = await apiRequest<AssetRow>("/admin/assets", {
        method: "POST",
        body: {
          symbol,
          name,
          displayName: createAssetForm.displayName.trim() || null,
          decimals,
          iconUrl: createAssetForm.iconUrl.trim() || null,
          description: createAssetForm.description.trim() || null,
          status: createAssetForm.status,
        },
      });

      setCreateAssetForm(INITIAL_CREATE_ASSET_FORM);
      setSuccess(`${createdAsset.symbol} created and wallet coverage initialized.`);
      await loadAssets();
    } catch (createError) {
      setError(createError instanceof ApiError ? createError.message : "Unable to create asset.");
    } finally {
      setIsCreating(false);
    }
  }

  async function updateAssetStatus(asset: AssetRow, status: "ACTIVE" | "PAUSED") {
    const noteInput = window.prompt(`Optional audit note for ${status.toLowerCase()} ${asset.symbol}:`);
    if (noteInput === null) {
      return;
    }

    try {
      setUpdatingKey(`asset:${asset.symbol}`);
      setError(null);
      setSuccess(null);
      const updatedAsset = await apiRequest<AssetRow>(`/admin/assets/${asset.symbol}/status`, {
        method: "PATCH",
        body: {
          status,
          ...(noteInput.trim() ? { note: noteInput.trim() } : {}),
        },
      });

      setAssets((currentAssets) =>
        currentAssets.map((currentAsset) =>
          currentAsset.id === updatedAsset.id ? updatedAsset : currentAsset,
        ),
      );
      setSuccess(`${updatedAsset.symbol} is now ${assetStatus(updatedAsset)}.`);
    } catch (updateError) {
      setError(
        updateError instanceof ApiError ? updateError.message : "Unable to update asset status.",
      );
    } finally {
      setUpdatingKey(null);
    }
  }

  function beginMetadataEdit(asset: AssetRow) {
    setEditingAsset(asset);
    setMetadataForm({
      displayName: asset.displayName ?? "",
      iconUrl: asset.iconUrl ?? "",
      description: asset.description ?? "",
      sortOrder: asset.sortOrder === null || asset.sortOrder === undefined ? "" : String(asset.sortOrder),
    });
    setError(null);
    setSuccess(null);
  }

  async function updateAssetMetadata() {
    if (!editingAsset) {
      return;
    }

    const displayName = metadataForm.displayName.trim();
    const iconUrl = metadataForm.iconUrl.trim();
    const description = metadataForm.description.trim();
    const sortOrderInput = metadataForm.sortOrder.trim();
    const sortOrder = sortOrderInput ? Number.parseInt(sortOrderInput, 10) : null;

    if (sortOrderInput && !/^-?\d+$/.test(sortOrderInput)) {
      setError("Sort order must be a whole number.");
      return;
    }

    try {
      setUpdatingKey(`metadata:${editingAsset.symbol}`);
      setError(null);
      setSuccess(null);
      const updatedAsset = await apiRequest<AssetRow>(
        `/admin/assets/${editingAsset.symbol}/metadata`,
        {
          method: "PATCH",
          body: {
            displayName: displayName || null,
            iconUrl: iconUrl || null,
            description: description || null,
            sortOrder,
          },
        },
      );

      setAssets((currentAssets) =>
        currentAssets.map((currentAsset) =>
          currentAsset.id === updatedAsset.id ? updatedAsset : currentAsset,
        ),
      );
      setEditingAsset(null);
      setSuccess(`${updatedAsset.symbol} metadata updated.`);
    } catch (updateError) {
      setError(
        updateError instanceof ApiError ? updateError.message : "Unable to update asset metadata.",
      );
    } finally {
      setUpdatingKey(null);
    }
  }

  return (
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Admin Assets"
            title="Asset registry"
            description="Create virtual assets, manage manual metadata, and control whether an asset is active for airdrop and new order flows."
            action={
              <div className="flex flex-wrap gap-2">
                <StatusBadge label="v0.14 Live" tone="success" />
                <Link
                  href="/admin/markets"
                  className="rounded-2xl border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground-soft)] transition hover:border-[var(--border-strong)] hover:text-white"
                >
                  Open Markets
                </Link>
              </div>
            }
          />

          {error ? <Notice tone="danger" message={error} /> : null}
          {success ? <Notice tone="success" message={success} /> : null}
          {isLoading ? <Notice tone="info" message="Loading asset controls..." /> : null}

          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <section className="panel rounded-3xl p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                    Create Asset
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">List a virtual asset</h2>
                </div>
                <StatusBadge label={createAssetForm.status} tone={createAssetForm.status === "ACTIVE" ? "success" : "warning"} />
              </div>

              <form onSubmit={handleCreateAsset} className="mt-5 grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                    Symbol
                    <input
                      value={createAssetForm.symbol}
                      onChange={(event) =>
                        setCreateAssetForm((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))
                      }
                      placeholder="SWT"
                      maxLength={16}
                      className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
                    />
                  </label>

                  <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                    Name
                    <input
                      value={createAssetForm.name}
                      onChange={(event) =>
                        setCreateAssetForm((current) => ({ ...current, name: event.target.value }))
                      }
                      placeholder="SW Test"
                      className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
                    />
                  </label>

                  <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                    Display name
                    <input
                      value={createAssetForm.displayName}
                      onChange={(event) =>
                        setCreateAssetForm((current) => ({ ...current, displayName: event.target.value }))
                      }
                      placeholder="SW Test"
                      className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
                    />
                  </label>

                  <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                    Decimals
                    <input
                      value={createAssetForm.decimals}
                      onChange={(event) =>
                        setCreateAssetForm((current) => ({ ...current, decimals: event.target.value }))
                      }
                      inputMode="numeric"
                      placeholder="18"
                      className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
                    />
                  </label>

                  <label className="grid gap-2 text-sm text-[var(--foreground-soft)] md:col-span-2">
                    Icon URL
                    <input
                      value={createAssetForm.iconUrl}
                      onChange={(event) =>
                        setCreateAssetForm((current) => ({ ...current, iconUrl: event.target.value }))
                      }
                      placeholder="https://example.com/icon.png"
                      className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
                    />
                  </label>

                  <label className="grid gap-2 text-sm text-[var(--foreground-soft)] md:col-span-2">
                    Description
                    <textarea
                      value={createAssetForm.description}
                      onChange={(event) =>
                        setCreateAssetForm((current) => ({ ...current, description: event.target.value }))
                      }
                      rows={3}
                      placeholder="Manual simulation asset note"
                      className="resize-none rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
                    />
                  </label>

                  <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                    Status
                    <select
                      value={createAssetForm.status}
                      onChange={(event) =>
                        setCreateAssetForm((current) => ({
                          ...current,
                          status: event.target.value as "ACTIVE" | "PAUSED",
                        }))
                      }
                      className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="PAUSED">PAUSED</option>
                    </select>
                  </label>
                </div>

                <div className="rounded-2xl border border-blue-300/20 bg-blue-300/10 px-4 py-3 text-sm text-blue-100">
                  New assets create zero-balance MAIN wallets for existing users and zero-balance admin bucket wallets without touching existing balances.
                </div>

                <button
                  type="submit"
                  disabled={isCreating}
                  className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCreating ? "Creating asset..." : "Create asset"}
                </button>
              </form>
            </section>

            <section className="panel rounded-3xl p-5">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                  Asset Controls
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">Manage existing assets</h2>
              </div>

              <div className="mt-5">
                <DataTable
                  columns={["Icon", "Symbol", "Name", "Display Name", "Decimals", "Status", "Actions"]}
                  rows={assets.map((asset) => [
                    <AssetIcon
                      key={`${asset.symbol}-icon`}
                      symbol={asset.symbol}
                      name={asset.displayName ?? asset.name}
                      iconUrl={asset.iconUrl}
                    />,
                    asset.symbol,
                    asset.name,
                    asset.displayName ?? asset.name,
                    String(asset.decimals),
                    <StatusBadge
                      key={`${asset.symbol}-status`}
                      label={assetStatus(asset)}
                      tone={asset.isActive ? "success" : "warning"}
                    />,
                    <div key={`${asset.symbol}-actions`} className="flex flex-wrap gap-2">
                      <StatusButton
                        label="Edit metadata"
                        disabled={updatingKey === `metadata:${asset.symbol}`}
                        tone="info"
                        onClick={() => beginMetadataEdit(asset)}
                      />
                      <StatusButton
                        label={asset.isActive ? "Pause" : "Resume"}
                        disabled={updatingKey === `asset:${asset.symbol}`}
                        tone={asset.isActive ? "warning" : "success"}
                        onClick={() => void updateAssetStatus(asset, asset.isActive ? "PAUSED" : "ACTIVE")}
                      />
                    </div>,
                  ])}
                />
              </div>
            </section>
          </div>

          {editingAsset ? (
            <section className="panel rounded-3xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                    Asset Metadata
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">Edit {editingAsset.symbol}</h2>
                </div>
                <AssetIdentity
                  symbol={editingAsset.symbol}
                  name={editingAsset.name}
                  displayName={metadataForm.displayName || editingAsset.displayName}
                  iconUrl={metadataForm.iconUrl || editingAsset.iconUrl}
                  size={32}
                />
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                  Display name
                  <input
                    value={metadataForm.displayName}
                    onChange={(event) =>
                      setMetadataForm((current) => ({ ...current, displayName: event.target.value }))
                    }
                    placeholder={editingAsset.name}
                    className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
                  />
                </label>

                <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                  Icon URL
                  <input
                    value={metadataForm.iconUrl}
                    onChange={(event) =>
                      setMetadataForm((current) => ({ ...current, iconUrl: event.target.value }))
                    }
                    placeholder="https://example.com/icon.png"
                    className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
                  />
                </label>

                <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                  Sort order
                  <input
                    value={metadataForm.sortOrder}
                    onChange={(event) =>
                      setMetadataForm((current) => ({ ...current, sortOrder: event.target.value }))
                    }
                    placeholder="10"
                    inputMode="numeric"
                    className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
                  />
                </label>

                <label className="grid gap-2 text-sm text-[var(--foreground-soft)] md:col-span-2">
                  Description
                  <textarea
                    value={metadataForm.description}
                    onChange={(event) =>
                      setMetadataForm((current) => ({ ...current, description: event.target.value }))
                    }
                    rows={3}
                    className="resize-none rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
                  />
                </label>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <StatusButton
                  label="Save metadata"
                  disabled={updatingKey === `metadata:${editingAsset.symbol}`}
                  tone="success"
                  onClick={() => void updateAssetMetadata()}
                />
                <button
                  type="button"
                  onClick={() => setEditingAsset(null)}
                  className="rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground-soft)] transition hover:border-[var(--border-strong)] hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </section>
          ) : null}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function assetStatus(asset: AssetRow) {
  return asset.isActive ? "ACTIVE" : "PAUSED";
}

function StatusButton({
  label,
  disabled,
  tone,
  onClick,
}: {
  label: string;
  disabled: boolean;
  tone: "success" | "warning" | "info";
  onClick: () => void;
}) {
  const classes =
    tone === "success"
      ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200 hover:border-emerald-200"
      : tone === "info"
        ? "border-blue-300/30 bg-blue-300/10 text-blue-100 hover:border-blue-200"
        : "border-amber-300/30 bg-amber-300/10 text-amber-200 hover:border-amber-200";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${classes}`}
    >
      {disabled ? "Updating..." : label}
    </button>
  );
}

function Notice({ tone, message }: { tone: "info" | "danger" | "success"; message: string }) {
  const classes =
    tone === "danger"
      ? "border-rose-300/20 bg-rose-300/10 text-rose-100"
      : tone === "success"
        ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
        : "border-blue-300/20 bg-blue-300/10 text-blue-100";

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${classes}`}>{message}</div>;
}
