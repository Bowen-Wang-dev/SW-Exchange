"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { topNavigation } from "@/lib/navigation";
import { apiRequest } from "@/lib/api-client";
import type { MarketSummary } from "@/lib/api-types";
import { AssetPairIcons } from "@/components/ui/asset-icon";
import { useAuth } from "@/providers/auth-provider";

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAdmin, isAuthenticated, isLoading, logout, user } = useAuth();
  const [markets, setMarkets] = useState<MarketSummary[]>([]);
  const [search, setSearch] = useState("");
  const authenticated = isAuthenticated();
  const admin = isAdmin();

  useEffect(() => {
    let active = true;

    async function loadMarkets() {
      try {
        const response = await apiRequest<MarketSummary[]>("/markets/summary");
        if (active) {
          setMarkets(response);
        }
      } catch {
        if (active) {
          setMarkets([]);
        }
      }
    }

    void loadMarkets();

    return () => {
      active = false;
    };
  }, []);

  const tradePanelMarkets = useMemo(() => {
    const query = search.trim().toLowerCase();
    const sortedMarkets = [...markets].sort((left, right) => {
      const rightVolume = parseSortableNumber(right.volume24h);
      const leftVolume = parseSortableNumber(left.volume24h);
      return rightVolume - leftVolume || left.marketSymbol.localeCompare(right.marketSymbol);
    });

    const activeMarkets = sortedMarkets.filter((market) => market.status === "ACTIVE");
    const searchableMarkets = query
      ? sortedMarkets.filter((market) => marketMatchesQuery(market, query))
      : activeMarkets.length > 0
        ? activeMarkets
        : sortedMarkets;

    return searchableMarkets.slice(0, 8);
  }, [markets, search]);

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <header className="panel-strong sticky top-0 z-20 shrink-0 rounded-3xl px-4 py-4 backdrop-blur sm:px-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/10 text-lg font-semibold text-[var(--accent)]">
              SW
            </div>
            <div>
              <p className="text-sm font-semibold text-white">SW Exchange</p>
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--foreground-muted)]">
                Simulated CEX v0.x
              </p>
            </div>
          </Link>

          <nav className="flex flex-wrap items-center gap-2">
            {topNavigation.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

              if (item.href === "/trade") {
                return (
                  <div key={item.href} className="group relative">
                    <Link
                      href={item.href}
                      className={`rounded-2xl px-3 py-2 text-sm transition ${
                        active
                          ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                          : "text-[var(--foreground-soft)] hover:bg-white/[0.04] hover:text-white"
                      }`}
                    >
                      {item.label}
                    </Link>

                    <div className="pointer-events-none absolute left-0 top-full z-30 mt-2 w-[min(740px,calc(100vw-2rem))] opacity-0 transition duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                      <div className="panel-strong overflow-hidden rounded-3xl border border-[var(--border-strong)] shadow-[0_24px_70px_rgba(2,5,18,0.72)]">
                        <div className="grid gap-4 p-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                          <div className="space-y-3">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
                                Spot
                              </p>
                              <h3 className="mt-2 text-lg font-semibold text-white">
                                Trade markets
                              </h3>
                              <p className="mt-2 text-sm text-[var(--foreground-soft)]">
                                Open a market or jump into the busiest spot pairs.
                              </p>
                            </div>
                            <Link
                              href="/markets"
                              className="inline-flex rounded-2xl border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--foreground-soft)] transition hover:border-[var(--accent)] hover:text-white"
                            >
                              View all markets
                            </Link>
                          </div>

                          <div className="min-w-0">
                            <label className="grid gap-2 text-sm text-[var(--foreground-soft)]">
                              <span className="sr-only">Search trade markets</span>
                              <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search markets..."
                                className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[var(--accent)]"
                              />
                            </label>

                            <div className="data-divider mt-3 max-h-[320px] overflow-y-auto rounded-2xl border border-[var(--border)] exchange-scrollbar">
                              {tradePanelMarkets.length > 0 ? (
                                tradePanelMarkets.map((market) => (
                                  <Link
                                    key={market.marketSymbol}
                                    href={`/trade?market=${encodeURIComponent(market.marketSymbol)}`}
                                    className="grid grid-cols-[minmax(0,1fr)_84px_76px] gap-3 border-t border-[var(--border)] px-3 py-2.5 text-sm transition first:border-t-0 hover:bg-white/[0.04]"
                                  >
                                    <span className="inline-flex min-w-0 items-center gap-2">
                                      <AssetPairIcons
                                        baseSymbol={market.baseAssetSymbol}
                                        quoteSymbol={market.quoteAssetSymbol}
                                        baseName={market.baseAssetDisplayName ?? market.baseAssetName}
                                        quoteName={market.quoteAssetDisplayName ?? market.quoteAssetName}
                                        baseIconUrl={market.baseAssetIconUrl}
                                        quoteIconUrl={market.quoteAssetIconUrl}
                                        size={20}
                                      />
                                      <span className="min-w-0">
                                        <span className="block truncate font-medium text-white">
                                          {market.marketSymbol}
                                        </span>
                                        <span className="block truncate text-xs text-[var(--foreground-muted)]">
                                          {market.baseAssetDisplayName ?? market.baseAssetName ?? market.baseAssetSymbol}
                                          {" / "}
                                          {market.quoteAssetDisplayName ?? market.quoteAssetName ?? market.quoteAssetSymbol}
                                        </span>
                                      </span>
                                    </span>
                                    <span className="font-medium text-white">
                                      {market.lastPrice ?? "—"}
                                    </span>
                                    <span className={changeToneClass(market.change24hPercent)}>
                                      {formatPercent(market.change24hPercent)}
                                    </span>
                                  </Link>
                                ))
                              ) : (
                                <div className="px-3 py-5 text-sm text-[var(--foreground-muted)]">
                                  No markets matched your search.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-2xl px-3 py-2 text-sm transition ${
                    active
                      ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                      : "text-[var(--foreground-soft)] hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}

            {admin ? (
              <Link
                href="/admin"
                className={`rounded-2xl px-3 py-2 text-sm transition ${
                  pathname === "/admin" || pathname.startsWith("/admin/")
                    ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                    : "text-[var(--foreground-soft)] hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                Admin
              </Link>
            ) : null}
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isLoading ? (
            <div className="rounded-2xl border border-[var(--border)] bg-white/[0.03] px-4 py-2">
              <p className="text-sm font-medium text-white">Loading session</p>
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                Auth state syncing
              </p>
            </div>
          ) : authenticated ? (
            <>
              <details className="relative">
                <summary className="list-none rounded-2xl border border-[var(--border)] bg-white/[0.03] px-4 py-2 cursor-pointer">
                  <p className="text-sm font-medium text-white">{user?.username ?? "User"}</p>
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                    {user?.role ?? "USER"} / {user?.status ?? "ACTIVE"}
                  </p>
                </summary>
                <div className="panel-strong absolute right-0 mt-2 w-52 rounded-2xl p-2">
                  <Link
                    href={admin ? "/admin" : "/dashboard"}
                    className="block rounded-xl px-3 py-2 text-sm text-[var(--foreground-soft)] transition hover:bg-white/[0.04] hover:text-white"
                  >
                    {admin ? "Admin Console" : "Dashboard"}
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm text-[var(--foreground-soft)] transition hover:bg-white/[0.04] hover:text-white"
                  >
                    Logout
                  </button>
                </div>
              </details>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-2xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground-soft)] transition hover:border-[var(--border-strong)] hover:text-white"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-2xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-[var(--accent-strong)]"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function marketMatchesQuery(market: MarketSummary, query: string) {
  return [
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
    .includes(query);
}

function parseSortableNumber(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPercent(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return `${value}%`;
}

function changeToneClass(value: string | null | undefined) {
  if (!value || value === "0") {
    return "text-[var(--foreground-soft)]";
  }

  return value.startsWith("-") ? "text-rose-300" : "text-emerald-300";
}
