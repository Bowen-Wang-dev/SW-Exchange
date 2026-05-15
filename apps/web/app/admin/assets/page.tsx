"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiRequest, ApiError } from "@/lib/api-client";

type AssetRow = {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  isActive: boolean;
};

export default function AdminAssetsPage() {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAssets() {
      try {
        const response = await apiRequest<AssetRow[]>("/assets");
        if (active) {
          setAssets(response);
          setError(null);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof ApiError ? loadError.message : "Unable to load assets.");
        }
      }
    }

    void loadAssets();

    return () => {
      active = false;
    };
  }, []);

  return (
    <ProtectedRoute requireAdmin fallbackPath="/dashboard">
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Admin Assets"
            title="Asset registry"
            description="The seeded asset universe remains small in v0.x. This page gives admins a clean table view of the exchange inventory."
            action={<StatusBadge label="Seeded" tone="success" />}
          />

          {error ? <Notice message={error} /> : null}

          <DataTable
            columns={["Symbol", "Name", "Decimals", "Status", "Notes"]}
            rows={assets.map((asset) => [
              asset.symbol,
              asset.name,
              String(asset.decimals),
              <StatusBadge
                key={`${asset.symbol}-status`}
                label={asset.isActive ? "Active" : "Paused"}
                tone={asset.isActive ? "success" : "warning"}
              />,
              asset.symbol === "SWC"
                ? "Simulated settlement unit, HKD reference only"
                : "Virtual volatile token",
            ])}
          />
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function Notice({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
      {message}
    </div>
  );
}
