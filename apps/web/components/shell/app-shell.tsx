"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/providers/auth-provider";
import { Sidebar } from "./sidebar";
import { TopNav } from "./top-nav";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const { user } = useAuth();

  return (
    <div className="app-grid min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-4 px-3 py-3 sm:px-4">
        <TopNav />
        {user?.status === "FROZEN" ? (
          <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
            Your account is frozen. You can view balances and history but cannot perform transfers or
            trades.
          </div>
        ) : null}
        <div className="grid flex-1 gap-4 xl:grid-cols-[250px_minmax(0,1fr)]">
          <div className="xl:sticky xl:top-[108px] xl:h-[calc(100vh-124px)]">
            <Sidebar />
          </div>
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
