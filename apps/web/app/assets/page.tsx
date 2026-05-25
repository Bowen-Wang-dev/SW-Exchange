"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { AssetIdentity } from "@/components/ui/asset-icon";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest } from "@/lib/api-client";
import type { AssetRow } from "@/lib/api-types";

export default function AssetsPage() {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAssets() {
      try {
        setIsLoading(true);
        const response = await apiRequest<AssetRow[]>("/assets");
        if (active) {
          setAssets(response);
          setError(null);
        }
      } catch {
        if (active) {
          setAssets([]);
          setError("Unable to load the asset directory.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadAssets();

    return () => {
      active = false;
    };
  }, []);

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          eyebrow="Assets"
          title="Virtual asset directory"
          description="Admin-created simulation assets appear here with manual metadata only. No blockchain contract metadata, deposit, or withdraw behavior is connected in v0.x."
          action={<StatusBadge label="Live" tone="success" />}
        />

        {error ? <Notice tone="danger" message={error} /> : null}
        {isLoading ? <Notice tone="info" message="Loading asset directory..." /> : null}

        {!isLoading ? (
          <DataTable
            columns={["Asset", "Name", "Decimals", "Status", "Description"]}
            rows={
              assets.length > 0
                ? assets.map((asset) => [
                    <AssetIdentity
                      key={`${asset.symbol}-asset`}
                      symbol={asset.symbol}
                      name={asset.name}
                      displayName={asset.displayName}
                      iconUrl={asset.iconUrl}
                    />,
                    asset.displayName ?? asset.name,
                    String(asset.decimals),
                    <StatusBadge
                      key={`${asset.symbol}-status`}
                      label={asset.status ?? (asset.isActive ? "ACTIVE" : "PAUSED")}
                      tone={asset.isActive ? "success" : "warning"}
                    />,
                    asset.description ?? "—",
                  ])
                : [[
                    "—",
                    "No listed assets are available yet.",
                    "—",
                    <StatusBadge key="empty-status" label="Simulation" tone="info" />,
                    "Assets appear here after admin listing and metadata setup.",
                  ]]
            }
          />
        ) : null}
      </div>
    </AppShell>
  );
}

function Notice({ tone, message }: { tone: "info" | "danger"; message: string }) {
  const classes =
    tone === "danger"
      ? "border-[var(--notice-danger-border)] bg-[var(--notice-danger-bg)] text-[var(--notice-danger-text)]"
      : "border-[var(--notice-info-border)] bg-[var(--notice-info-bg)] text-[var(--notice-info-text)]";

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${classes}`}>{message}</div>;
}
