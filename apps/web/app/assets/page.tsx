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

  useEffect(() => {
    let active = true;

    async function loadAssets() {
      try {
        const response = await apiRequest<AssetRow[]>("/assets");
        if (active) {
          setAssets(response);
        }
      } catch {
        if (active) {
          setAssets([]);
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
              : [["—", "No assets found.", "—", "—", "—"]]
          }
        />
      </div>
    </AppShell>
  );
}
