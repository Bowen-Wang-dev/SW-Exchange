"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { AssetPairIcons } from "@/components/ui/asset-icon";
import { StatusBadge } from "@/components/ui/status-badge";
import type { MarketSummary } from "@/lib/api-types";

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
    <div ref={rootRef} className="relative w-full sm:w-auto">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="group inline-flex w-full min-w-[220px] items-center gap-3 rounded-2xl border border-[var(--border-strong)] bg-white/[0.04] px-3 py-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition hover:border-[var(--accent)] hover:bg-white/[0.06] sm:w-[255px]"
      >
        <AssetPairIcons
          baseSymbol={activeMarket?.baseAssetSymbol ?? marketBaseSymbol(selectedMarketSymbol)}
          quoteSymbol={activeMarket?.quoteAssetSymbol ?? marketQuoteSymbol(selectedMarketSymbol)}
          baseName={activeMarket?.baseAssetDisplayName ?? activeMarket?.baseAssetName}
          quoteName={activeMarket?.quoteAssetDisplayName ?? activeMarket?.quoteAssetName}
          baseIconUrl={activeMarket?.baseAssetIconUrl}
          quoteIconUrl={activeMarket?.quoteAssetIconUrl}
          size={30}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
            Spot market
          </span>
          <span className="mt-1 flex items-center gap-2">
            <span className="truncate text-lg font-semibold text-white">{selectedMarketSymbol}</span>
            <ChevronIcon open={isOpen} />
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-[var(--foreground-muted)] group-hover:text-[var(--foreground-soft)]">
            Click to switch
          </span>
        </span>
      </button>

      {isOpen ? (
        <div className="panel-strong absolute left-0 top-full z-30 mt-2 max-h-[72vh] w-[min(560px,calc(100vw-2rem))] rounded-2xl border border-[var(--border-strong)] p-3 shadow-[0_24px_70px_rgba(2,5,18,0.72)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
                Markets
              </p>
              <p className="mt-1 text-xs text-[var(--foreground-soft)]">
                Search by symbol or asset name.
              </p>
            </div>
            <StatusBadge label={`${filteredMarkets.length} Listed`} tone="info" />
          </div>

          <label className="mt-3 grid gap-2 text-sm text-[var(--foreground-soft)]">
            <span className="sr-only">Search markets</span>
            <input
              ref={inputRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search markets..."
              className="rounded-xl border border-[var(--border)] bg-[#0a1122] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[var(--accent)]"
            />
          </label>

          <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--border)]">
            <div className="hidden grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)_minmax(0,0.8fr)] gap-3 bg-white/[0.03] px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-muted)] sm:grid">
              <span>Market</span>
              <span>Last / 24h</span>
              <span className="text-right">Volume</span>
            </div>
            <div className="exchange-scrollbar max-h-[min(380px,calc(72vh-150px))] overflow-y-auto">
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
                      className={`grid w-full gap-3 border-t border-[var(--border)] px-3 py-2.5 text-left text-sm transition first:border-t-0 sm:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)_minmax(0,0.8fr)] ${
                        isSelected ? "bg-[var(--accent-soft)]" : "bg-white/[0.01] hover:bg-white/[0.04]"
                      }`}
                    >
                      <span className="inline-flex min-w-0 items-center gap-3">
                        <AssetPairIcons
                          baseSymbol={market.baseAssetSymbol}
                          quoteSymbol={market.quoteAssetSymbol}
                          baseName={market.baseAssetDisplayName ?? market.baseAssetName}
                          quoteName={market.quoteAssetDisplayName ?? market.quoteAssetName}
                          baseIconUrl={market.baseAssetIconUrl}
                          quoteIconUrl={market.quoteAssetIconUrl}
                          size={26}
                        />
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
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-white">{market.lastPrice ?? "—"}</span>
                        <span className={`block truncate text-xs ${changeClass(market.change24hPercent)}`}>
                          {market.change24hPercent ? `${market.change24hPercent}%` : "—"}
                        </span>
                      </span>
                      <span className="min-w-0 sm:text-right">
                        <span className="block truncate text-[var(--foreground-soft)]">
                          {market.volume24h} {market.baseAssetSymbol}
                        </span>
                        <span className="mt-1 block">
                          {market.status === "ACTIVE" ? (
                            <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--foreground-muted)]">
                              Live
                            </span>
                          ) : (
                            <StatusBadge label={market.status} tone="warning" />
                          )}
                        </span>
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
