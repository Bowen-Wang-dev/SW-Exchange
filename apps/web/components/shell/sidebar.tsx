"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminSidebarNavigation, userSidebarNavigation } from "@/lib/navigation";
import { useAuth } from "@/providers/auth-provider";

export function Sidebar() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();
  const admin = isAdmin();

  return (
    <aside className="panel flex h-full min-h-0 flex-col overflow-hidden rounded-3xl p-4">
      <div className="exchange-scrollbar min-h-0 space-y-6 overflow-y-auto pr-1">
        <NavSection title="User" items={userSidebarNavigation} pathname={pathname} />
        {admin ? (
          <NavSection title="Admin" items={adminSidebarNavigation} pathname={pathname} />
        ) : null}
      </div>
    </aside>
  );
}

function NavSection({
  title,
  items,
  pathname,
}: {
  title: string;
  items: Array<{ href: string; label: string }>;
  pathname: string;
}) {
  return (
    <section className="space-y-3">
      <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.26em] text-[var(--foreground-muted)]">
        {title}
      </p>
      <nav className="flex flex-col gap-1.5">
        {items.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-2xl px-3 py-2.5 text-sm transition ${
                active
                  ? "bg-[var(--accent-soft)] font-medium text-[var(--accent-strong)]"
                  : "text-[var(--foreground-soft)] hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
