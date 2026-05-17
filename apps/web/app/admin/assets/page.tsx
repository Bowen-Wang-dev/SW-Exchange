"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { AssetIcon, AssetIdentity } from "@/components/ui/asset-icon";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest, ApiError } from "@/lib/api-client";
import type { AssetRow, MarketRow, MarketStatus } from "@/lib/api-types";

export default function AdminAssetsPage() {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [editingAsset, setEditingAsset] = useState<AssetRow | null>(null);
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

    void loadControls(active);

    return () => {
      active = false;
    };
  }, []);

  async function loadControls(active = true) {
    try {
      setIsLoading(true);
      const [assetResponse, marketResponse] = await Promise.all([
        apiRequest<AssetRow[]>("/assets"),
        apiRequest<MarketRow[]>("/markets"),
      ]);
      if (active) {
        setAssets(assetResponse);
        setMarkets(marketResponse);
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

  async function updateAssetStatus(asset: AssetRow, status: "ACTIVE" | "PAUSED") {
    const noteInput = window.prompt(
      `Optional audit note for ${status.toLowerCase()} ${asset.symbol}:`,
    );
    if (noteInput === null) {
      return;
    }
    const note = noteInput.trim();

    try {
      setUpdatingKey(`asset:${asset.symbol}`);
      setError(null);
      setSuccess(null);
      const updatedAsset = await apiRequest<AssetRow>(`/admin/assets/${asset.symbol}/status`, {
        method: "PATCH",
        body: {
          status,
          ...(note ? { note } : {}),
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

  async function updateMarketStatus(market: MarketRow, status: MarketStatus) {
    const noteInput = window.prompt(
      `Optional audit note for ${status.toLowerCase()} ${market.symbol}:`,
    );
    if (noteInput === null) {
      return;
    }
    const note = noteInput.trim();

    try {
      setUpdatingKey(`market:${market.symbol}`);
      setError(null);
      setSuccess(null);
      const updatedMarket = await apiRequest<MarketRow>(
        `/admin/markets/${encodeURIComponent(market.symbol)}/status`,
        {
          method: "PATCH",
          body: {
            status,
            ...(note ? { note } : {}),
          },
        },
      );

      setMarkets((currentMarkets) =>
        currentMarkets.map((currentMarket) =>
          currentMarket.id === updatedMarket.id ? updatedMarket : currentMarket,
        ),
      );
      setSuccess(`${updatedMarket.symbol} market is now ${updatedMarket.status}.`);
    } catch (updateError) {
      setError(
        updateError instanceof ApiError ? updateError.message : "Unable to update market status.",
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
            description="The seeded asset universe remains small in v0.x. Admins can pause assets, edit display metadata, and manage the SWL/SWC market from this existing operations page."
            action={<StatusBadge label="v0.11 Metadata" tone="warning" />}
          />

          {error ? <Notice tone="danger" message={error} /> : null}
          {success ? <Notice tone="success" message={success} /> : null}
          {isLoading ? <Notice tone="info" message="Loading asset controls..." /> : null}

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

          {editingAsset ? (
            <section className="panel rounded-3xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                    Asset Metadata
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    Edit {editingAsset.symbol}
                  </h2>
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
                      setMetadataForm((current) => ({
                        ...current,
                        displayName: event.target.value,
                      }))
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
                      setMetadataForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
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

          <DataTable
            columns={["Market", "Status", "Action", "Notes"]}
            rows={markets.map((market) => [
              market.symbol,
              <StatusBadge
                key={`${market.symbol}-status`}
                label={market.status}
                tone={market.status === "ACTIVE" ? "success" : "warning"}
              />,
              <StatusButton
                key={`${market.symbol}-action`}
                label={market.status === "ACTIVE" ? "Pause" : "Resume"}
                disabled={updatingKey === `market:${market.symbol}`}
                tone={market.status === "ACTIVE" ? "warning" : "success"}
                onClick={() =>
                  void updateMarketStatus(market, market.status === "ACTIVE" ? "PAUSED" : "ACTIVE")
                }
              />,
              "Paused markets block new orders and matching; users can still view the book/history and cancel open orders.",
            ])}
          />
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

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${classes}`}>
      {message}
    </div>
  );
}
