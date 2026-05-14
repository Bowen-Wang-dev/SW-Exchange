"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";

type ProtectedRouteProps = {
  children: React.ReactNode;
  requireAdmin?: boolean;
  fallbackPath?: string;
};

export function ProtectedRoute({
  children,
  requireAdmin = false,
  fallbackPath = "/login",
}: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAdmin, isAuthenticated, isLoading } = useAuth();
  const authenticated = isAuthenticated();
  const admin = isAdmin();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!authenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    if (requireAdmin && !admin) {
      router.replace(fallbackPath);
    }
  }, [admin, authenticated, fallbackPath, isLoading, pathname, requireAdmin, router]);

  if (isLoading) {
    return <AccessState title="Loading session" description="Restoring your exchange session." />;
  }

  if (!authenticated) {
    return <AccessState title="Redirecting to login" description="Authentication is required for this page." />;
  }

  if (requireAdmin && !admin) {
    return <AccessState title="Admin access required" description="This section is only available to the platform administrator." />;
  }

  return <>{children}</>;
}

function AccessState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="panel-strong w-full max-w-md rounded-3xl p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
          SW Exchange
        </p>
        <h1 className="mt-4 text-2xl font-semibold text-white">{title}</h1>
        <p className="mt-3 text-sm text-[var(--foreground-soft)]">{description}</p>
      </div>
    </div>
  );
}
