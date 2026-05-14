import Link from "next/link";
import type { ReactNode } from "react";
import { adminNavigation, userNavigation } from "./navigation";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="grain" />
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="glass-card mb-6 rounded-[28px] px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--accent-strong)]">
                SW Exchange v0.x
              </p>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Internal simulated exchange
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">
                  Web-only foundation for internal wallets, transfers, limit orders, and a single
                  admin dashboard. No blockchain, no deposit, no withdraw in v0.x.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link
                href="/login"
                className="rounded-full border border-[var(--border)] bg-white/70 px-4 py-2 font-medium transition hover:bg-white"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-[var(--accent)] px-4 py-2 font-medium text-white transition hover:bg-[var(--accent-strong)]"
              >
                Register
              </Link>
            </div>
          </div>
        </header>

        <div className="grid flex-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="glass-card soft-grid rounded-[28px] p-5">
            <div className="space-y-6">
              <NavSection title="User" items={userNavigation} />
              <NavSection title="Admin" items={adminNavigation} />
            </div>
          </aside>
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}

type NavSectionProps = {
  title: string;
  items: Array<{ href: string; label: string }>;
};

function NavSection({ title, items }: NavSectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--muted)]">
        {title}
      </h2>
      <nav className="flex flex-col gap-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-2xl border border-transparent bg-white/55 px-4 py-3 text-sm font-medium transition hover:border-[var(--border)] hover:bg-white/90"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </section>
  );
}
