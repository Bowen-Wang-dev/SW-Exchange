"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { topNavigation } from "@/lib/navigation";
import { useAuth } from "@/providers/auth-provider";

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAdmin, isAuthenticated, isLoading, logout, user } = useAuth();
  const authenticated = isAuthenticated();
  const admin = isAdmin();

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
