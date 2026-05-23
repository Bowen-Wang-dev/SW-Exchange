"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { AssetIcon } from "@/components/ui/asset-icon";
import { StatusBadge } from "@/components/ui/status-badge";
import type { MarketStatus, MarketSummary } from "@/lib/api-types";

type MarketSelectorEntry = Pick<
  MarketSummary,
  | "marketSymbol"
  | "baseAssetSymbol"
  | "quoteAssetSymbol"
  | "baseAssetName"
  | "quoteAssetName"
  | "baseAssetDisplayName"
  | "quoteAssetDisplayName"
  | "baseAssetIconUrl"
  | "quoteAssetIconUrl"
  | "lastPrice"
  | "volume24h"
  | "change24hPercent"
  | "status"
>;

type MarketSelectorProps = {
  markets: MarketSummary[];
  selectedMarketSymbol: string;
  selectedMarket: MarketSelectorEntry | null;
  onSelect: (marketSymbol: string) => void;
};

export function MarketSelector({
  markets,
  selectedMarketSymbol,
  selectedMarket,
  onSelect,
}: MarketSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const marketOptions = useMemo(() => {
    const deduped = new Map<string, MarketSelectorEntry>();

    for (const market of markets) {
      deduped.set(market.marketSymbol, market);
    }

    if (selectedMarket && !deduped.has(selectedMarket.marketSymbol)) {
      deduped.set(selectedMarket.marketSymbol, selectedMarket);
    }

    return [...deduped.values()].sort((left, right) =>
      left.marketSymbol.localeCompare(right.marketSymbol),
    );
  }, [markets, selectedMarket]);

  const filteredMarkets = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return marketOptions;
    }

    return marketOptions.filter((market) =>
      [
        market.marketSymbol,
        market.baseAssetSymbol,
        market.quoteAssetSymbol,
        market.baseAssetName,
        market.quoteAssetName,
        market.baseAssetDisplayName,
        market.quoteAssetDisplayName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [deferredSearch, marketOptions]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const activeMarket = selectedMarket ?? marketOptions.find((market) => market.marketSymbol === selectedMarketSymbol) ?? null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex min-w-[260px] items-center gap-3 rounded-2xl border border-[var(--border-strong)] bg-white/[0.04] px-4 py-3 text-left transition hover:border-[var(--accent)] hover:bg-white/[0.06]"
      >
        <span className="flex -space-x-2">
          <AssetIcon
            symbol={activeMarket?.baseAssetSymbol ?? marketBaseSymbol(selectedMarketSymbol)}
            name={activeMarket?.baseAssetDisplayName ?? activeMarket?.baseAssetName}
            iconUrl={activeMarket?.baseAssetIconUrl}
            size={32}
          />
          <AssetIcon
            symbol={activeMarket?.quoteAssetSymbol ?? marketQuoteSymbol(selectedMarketSymbol)}
            name={activeMarket?.quoteAssetDisplayName ?? activeMarket?.quoteAssetName}
            iconUrl={activeMarket?.quoteAssetIconUrl}
            size={32}
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
            Spot market
          </span>
          <span className="mt-1 flex items-center gap-2">
            <span className="truncate text-xl font-semibold text-white">{selectedMarketSymbol}</span>
            <ChevronIcon open={isOpen} />
          </span>
        </span>
      </button>

      {isOpen ? (
        <div className="panel-strong absolute left-0 top-full z-30 mt-3 w-[min(860px,calc(100vw-2rem))] rounded-3xl border border-[var(--border-strong)] p-4 shadow-[0_30px_80px_rgba(2,5,18,0.7)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
                Markets
              </p>
              <p className="mt-1 text-sm text-[var(--foreground-soft)]">
                Search by symbol or asset name.
              </p>
            </div>
            <StatusBadge label={`${filteredMarkets.length} Listed`} tone="info" />
          </div>

          <label className="mt-4 grid gap-2 text-sm text-[var(--foreground-soft)]">
            <span className="sr-only">Search markets</span>
            <input
              ref={inputRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search markets..."
              className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)]"
            />
          </label>

          <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)]">
            <div className="grid grid-cols-[minmax(190px,1.5fr)_minmax(90px,0.8fr)_minmax(110px,0.8fr)_minmax(130px,0.9fr)_90px] gap-3 bg-white/[0.03] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
              <span>Market</span>
              <span>Last</span>
              <span>24h Change</span>
              <span>24h Volume</span>
              <span className="text-right">Status</span>
            </div>
            <div className="exchange-scrollbar max-h-[420px] overflow-y-auto">
              {filteredMarkets.length > 0 ? (
                filteredMarkets.map((market) => {
                  const isSelected = market.marketSymbol === selectedMarketSymbol;

                  return (
                    <button
                      key={market.marketSymbol}
                      type="button"
                      onClick={() => {
                        onSelect(market.marketSymbol);
                        setIsOpen(false);
                        setSearch("");
                      }}
                      className={`grid w-full grid-cols-[minmax(190px,1.5fr)_minmax(90px,0.8fr)_minmax(110px,0.8fr)_minmax(130px,0.9fr)_90px] gap-3 border-t border-[var(--border)] px-4 py-3 text-left text-sm transition first:border-t-0 ${
                        isSelected ? "bg-[var(--accent-soft)]" : "bg-white/[0.01] hover:bg-white/[0.04]"
                      }`}
                    >
                      <span className="inline-flex min-w-0 items-center gap-3">
                        <span className="flex -space-x-2">
                          <AssetIcon
                            symbol={market.baseAssetSymbol}
                            name={market.baseAssetDisplayName ?? market.baseAssetName}
                            iconUrl={market.baseAssetIconUrl}
                            size={28}
                          />
                          <AssetIcon
                            symbol={market.quoteAssetSymbol}
                            name={market.quoteAssetDisplayName ?? market.quoteAssetName}
                            iconUrl={market.quoteAssetIconUrl}
                            size={28}
                          />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-white">
                            {market.marketSymbol}
                          </span>
                          <span className="block truncate text-xs text-[var(--foreground-muted)]">
                            {market.baseAssetDisplayName ?? market.baseAssetName ?? market.baseAssetSymbol}
                            {" / "}
                            {market.quoteAssetDisplayName ?? market.quoteAssetName ?? market.quoteAssetSymbol}
                          </span>
                        </span>
                      </span>
                      <span className="font-medium text-white">{market.lastPrice ?? "—"}</span>
                      <span className={changeClass(market.change24hPercent)}>
                        {market.change24hPercent ? `${market.change24hPercent}%` : "—"}
                      </span>
                      <span className="text-[var(--foreground-soft)]">
                        {market.volume24h} {market.baseAssetSymbol}
                      </span>
                      <span className="flex justify-end">
                        <StatusBadge
                          label={market.status}
                          tone={market.status === "ACTIVE" ? "success" : "warning"}
                        />
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="px-4 py-8 text-center text-sm text-[var(--foreground-muted)]">
                  No markets matched your search.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={`h-4 w-4 shrink-0 text-[var(--foreground-muted)] transition ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 7 5 6 5-6" />
    </svg>
  );
}

function changeClass(value?: string | null) {
  if (!value || value === "0") {
    return "text-[var(--foreground-soft)]";
  }

  return value.startsWith("-") ? "text-rose-300" : "text-emerald-300";
}

function marketBaseSymbol(marketSymbol: string) {
  return marketSymbol.split("/")[0] || "SWL";
}

function marketQuoteSymbol(marketSymbol: string) {
  return marketSymbol.split("/")[1] || "SWC";
}
