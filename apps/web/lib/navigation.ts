import type { AdminPermission } from "@sw-exchange/shared";
export type NavigationItem = {
  href: string;
  label: string;
  permission?: AdminPermission;
};

export const topNavigation: NavigationItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/assets", label: "Assets" },
  { href: "/markets", label: "Markets" },
  { href: "/trade", label: "Trade" },
  { href: "/wallet", label: "Wallet" },
  { href: "/orders", label: "Orders" },
];

export const userSidebarNavigation: NavigationItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/assets", label: "Assets" },
  { href: "/wallet", label: "Wallet" },
  { href: "/transfer", label: "Transfer" },
  { href: "/trade", label: "Trade" },
  { href: "/orders", label: "Orders" },
  { href: "/trades", label: "Trades" },
  { href: "/ledger", label: "Ledger" },
];

export const adminSidebarNavigation: NavigationItem[] = [
  { href: "/admin", label: "Admin Home", permission: "reports.read" },
  { href: "/admin/roles", label: "Admin Roles", permission: "admin_roles.read" },
  { href: "/admin/users", label: "Users", permission: "users.read" },
  { href: "/admin/wallets", label: "Wallets", permission: "wallets.read" },
  { href: "/admin/airdrop", label: "Airdrop", permission: "airdrops.execute" },
  { href: "/admin/transfers", label: "Transfers", permission: "transfers.read" },
  { href: "/admin/assets", label: "Assets", permission: "assets.read" },
  { href: "/admin/markets", label: "Markets", permission: "markets.read" },
  { href: "/admin/orders", label: "Orders", permission: "orders.read" },
  { href: "/admin/trades", label: "Trades", permission: "trades.read" },
  { href: "/admin/fees", label: "Fees", permission: "fees.read" },
  { href: "/admin/feature-flags", label: "Feature Flags", permission: "feature_flags.read" },
  { href: "/admin/security-events", label: "Security Events", permission: "audit.read" },
  { href: "/admin/security-actions", label: "Sensitive Actions", permission: "audit.read" },
  { href: "/admin/ledger", label: "Ledger", permission: "ledger.read" },
  { href: "/admin/audit-logs", label: "Audit Logs", permission: "audit.read" },
];
