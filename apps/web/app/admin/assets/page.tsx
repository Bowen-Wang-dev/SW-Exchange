"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest, ApiError } from "@/lib/api-client";
import type { AssetRow, MarketRow, MarketStatus } from "@/lib/api-types";

export default function AdminAssetsPage() {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
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
            description="The seeded asset universe remains small in v0.x. Admins can pause assets and the SWL/SWC market from this existing operations page."
            action={<StatusBadge label="v0.9 Controls" tone="warning" />}
          />

          {error ? <Notice tone="danger" message={error} /> : null}
          {success ? <Notice tone="success" message={success} /> : null}
          {isLoading ? <Notice tone="info" message="Loading asset controls..." /> : null}

          <DataTable
            columns={["Symbol", "Name", "Decimals", "Status", "Action", "Notes"]}
            rows={assets.map((asset) => [
              asset.symbol,
              asset.name,
              String(asset.decimals),
              <StatusBadge
                key={`${asset.symbol}-status`}
                label={assetStatus(asset)}
                tone={asset.isActive ? "success" : "warning"}
              />,
              <StatusButton
                key={`${asset.symbol}-action`}
                label={asset.isActive ? "Pause" : "Resume"}
                disabled={updatingKey === `asset:${asset.symbol}`}
                tone={asset.isActive ? "warning" : "success"}
                onClick={() => void updateAssetStatus(asset, asset.isActive ? "PAUSED" : "ACTIVE")}
              />,
              asset.symbol === "SWC"
                ? "Simulated settlement unit, HKD reference only"
                : "Virtual volatile token",
            ])}
          />

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
  tone: "success" | "warning";
  onClick: () => void;
}) {
  const classes =
    tone === "success"
      ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200 hover:border-emerald-200"
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
