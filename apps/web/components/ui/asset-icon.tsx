"use client";

import { useEffect, useMemo, useState } from "react";
import { resolveAssetIconUrl } from "@/lib/asset-icons";

type AssetIconProps = {
  symbol: string;
  name?: string | null;
  iconUrl?: string | null;
  size?: number;
};

export function AssetIcon({ symbol, name, iconUrl, size = 28 }: AssetIconProps) {
  const resolvedIconUrl = useMemo(() => resolveAssetIconUrl(symbol, iconUrl), [symbol, iconUrl]);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const shouldShowImage = Boolean(resolvedIconUrl && failedUrl !== resolvedIconUrl);
  const label = buildFallbackLabel(symbol, name);

  useEffect(() => {
    setFailedUrl(null);
  }, [resolvedIconUrl]);

  if (shouldShowImage && resolvedIconUrl) {
    return (
      <img
        src={resolvedIconUrl}
        alt={`${name ?? symbol} icon`}
        width={size}
        height={size}
        className="shrink-0 rounded-full border border-[var(--border)] bg-white/[0.04] object-cover"
        style={{ width: size, height: size }}
        onError={() => setFailedUrl(resolvedIconUrl)}
      />
    );
  }

  return (
    <span
      aria-label={`${name ?? symbol} icon fallback`}
      className="inline-flex shrink-0 items-center justify-center rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] text-[10px] font-semibold text-[var(--accent-strong)]"
      style={{ width: size, height: size }}
    >
      {label}
    </span>
  );
}

export function AssetIdentity({
  symbol,
  name,
  displayName,
  iconUrl,
  size = 28,
}: AssetIconProps & { displayName?: string | null }) {
  const label = displayName ?? name ?? symbol;

  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <AssetIcon symbol={symbol} name={label} iconUrl={iconUrl} size={size} />
      <span className="min-w-0">
        <span className="block font-medium text-white">{symbol}</span>
        {label !== symbol ? (
          <span className="block truncate text-xs text-[var(--foreground-muted)]">{label}</span>
        ) : null}
      </span>
    </span>
  );
}

function buildFallbackLabel(symbol: string, name?: string | null) {
  const cleanSymbol = symbol.trim().toUpperCase();
  if (cleanSymbol.length > 0) {
    return cleanSymbol.slice(0, 3);
  }

  const cleanName = name?.trim().toUpperCase() ?? "";
  return cleanName.slice(0, 1) || "?";
}
