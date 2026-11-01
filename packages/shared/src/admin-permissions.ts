// Versioned, explicit registry. Changing a role requires a reviewed data migration.
export const ADMIN_PERMISSIONS = [
  "users.read", "users.manage", "assets.read", "assets.manage", "markets.read", "markets.manage",
  "fees.read", "fees.manage", "wallets.read", "wallets.manage", "airdrops.execute",
  "reports.read", "orders.read", "trades.read", "transfers.read", "ledger.read", "audit.read",
  "feature_flags.read", "admin_roles.read", "admin_roles.manage",
] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];
export const ADMIN_ROLE_KEYS = ["super_admin", "operator", "viewer"] as const;
export type AdminRoleKey = (typeof ADMIN_ROLE_KEYS)[number];
const readPermissions: AdminPermission[] = [
  "users.read", "assets.read", "markets.read", "fees.read", "wallets.read", "reports.read",
  "orders.read", "trades.read", "transfers.read", "ledger.read", "audit.read", "feature_flags.read", "admin_roles.read",
];
export const ADMIN_ROLE_DEFINITIONS: ReadonlyArray<{
  key: AdminRoleKey; description: string; permissions: readonly AdminPermission[];
}> = [
  { key: "super_admin", description: "Full administrative authority, including financial operations and role management.", permissions: ADMIN_PERMISSIONS },
  { key: "operator", description: "Read operations and manage ordinary user status, assets and markets. No financial mutations or administrator management.", permissions: [...readPermissions, "users.manage", "assets.manage", "markets.manage"] },
  { key: "viewer", description: "Read-only administrative review. No mutations.", permissions: readPermissions },
];

// Complete report response includes raw audit/trade/transfer records and fee balances.
// Require every underlying scope before querying any subsection; do not widen reports.read.
export const ADMIN_REPORT_PERMISSIONS = [
  "reports.read", "audit.read", "fees.read", "wallets.read", "trades.read", "transfers.read",
] as const satisfies readonly AdminPermission[];

// Every complete fee-settings response includes protected fee-wallet balances,
// including the response returned by either settings mutation alias.
export const ADMIN_FEE_SETTINGS_READ_PERMISSIONS = [
  "fees.read", "wallets.read",
] as const satisfies readonly AdminPermission[];
