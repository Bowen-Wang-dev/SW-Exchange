export type NavigationItem = {
  href: string;
  label: string;
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
  { href: "/admin", label: "Admin Home" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/wallets", label: "Wallets" },
  { href: "/admin/airdrop", label: "Airdrop" },
  { href: "/admin/transfers", label: "Transfers" },
  { href: "/admin/assets", label: "Assets" },
  { href: "/admin/markets", label: "Markets" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/trades", label: "Trades" },
  { href: "/admin/fees", label: "Fees" },
  { href: "/admin/ledger", label: "Ledger" },
  { href: "/admin/audit-logs", label: "Audit Logs" },
];
