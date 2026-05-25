export const USER_ROLES = ["USER", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["ACTIVE", "FROZEN", "BANNED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const FEATURE_FLAG_GROUPS = ["FUNDING", "SECURITY", "OPERATIONS", "TRADING"] as const;
export type FeatureFlagGroup = (typeof FEATURE_FLAG_GROUPS)[number];

export const FEATURE_FLAG_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type FeatureFlagRiskLevel = (typeof FEATURE_FLAG_RISK_LEVELS)[number];

export type FeatureFlagDefinition = {
  key: string;
  displayName: string;
  description: string;
  group: FeatureFlagGroup;
  riskLevel: FeatureFlagRiskLevel;
  plannedMilestone: string;
  defaultEnabled: boolean;
};

export const FEATURE_FLAG_DEFINITIONS = [
  {
    key: "enableDeposits",
    displayName: "Deposits",
    description: "Allows deposit-related UI and backend credit workflows.",
    group: "FUNDING",
    riskLevel: "CRITICAL",
    plannedMilestone: "v1.x funding",
    defaultEnabled: false,
  },
  {
    key: "enableWithdrawals",
    displayName: "Withdrawals",
    description: "Allows withdrawal request creation and execution workflows.",
    group: "FUNDING",
    riskLevel: "CRITICAL",
    plannedMilestone: "v1.x funding",
    defaultEnabled: false,
  },
  {
    key: "enableAutoWithdrawals",
    displayName: "Auto Withdrawals",
    description: "Allows policy-based automatic withdrawal release.",
    group: "FUNDING",
    riskLevel: "CRITICAL",
    plannedMilestone: "v1.x funding",
    defaultEnabled: false,
  },
  {
    key: "enableManualWithdrawalReview",
    displayName: "Manual Withdrawal Review",
    description: "Keeps future withdrawals on an admin review path instead of immediate execution.",
    group: "FUNDING",
    riskLevel: "HIGH",
    plannedMilestone: "v1.x funding",
    defaultEnabled: false,
  },
  {
    key: "enableChainGateway",
    displayName: "Chain Gateway",
    description: "Master gate for chain asset registry, deposit, withdrawal, and reconciliation modules.",
    group: "FUNDING",
    riskLevel: "CRITICAL",
    plannedMilestone: "v1.x chain gateway",
    defaultEnabled: false,
  },
  {
    key: "enable2FA",
    displayName: "TOTP 2FA",
    description: "Allows TOTP enrollment, challenge, and enforcement flows.",
    group: "SECURITY",
    riskLevel: "HIGH",
    plannedMilestone: "v1.x security",
    defaultEnabled: false,
  },
  {
    key: "enableEmailVerification",
    displayName: "Email Verification",
    description: "Allows verified-email requirements for account and sensitive actions.",
    group: "SECURITY",
    riskLevel: "HIGH",
    plannedMilestone: "v1.x security",
    defaultEnabled: false,
  },
  {
    key: "enableSupportTickets",
    displayName: "Support Tickets",
    description: "Allows an optional user and admin support ticket workflow.",
    group: "OPERATIONS",
    riskLevel: "MEDIUM",
    plannedMilestone: "future operations",
    defaultEnabled: false,
  },
  {
    key: "enableAdminRolePermissions",
    displayName: "Admin Role Permissions",
    description: "Allows scoped admin permissions instead of broad admin or non-admin access only.",
    group: "SECURITY",
    riskLevel: "HIGH",
    plannedMilestone: "v1.x security",
    defaultEnabled: false,
  },
  {
    key: "enableMarginTrading",
    displayName: "Margin Trading",
    description: "Allows planned margin simulation modules.",
    group: "TRADING",
    riskLevel: "CRITICAL",
    plannedMilestone: "v2.x trading",
    defaultEnabled: false,
  },
  {
    key: "enableFuturesTrading",
    displayName: "Futures Trading",
    description: "Allows planned perpetual or futures simulation modules.",
    group: "TRADING",
    riskLevel: "CRITICAL",
    plannedMilestone: "v2.x trading",
    defaultEnabled: false,
  },
  {
    key: "enableShorting",
    displayName: "Shorting",
    description: "Allows planned short-exposure flows within leveraged simulation modules.",
    group: "TRADING",
    riskLevel: "CRITICAL",
    plannedMilestone: "v2.x trading",
    defaultEnabled: false,
  },
  {
    key: "enableLiquidation",
    displayName: "Liquidation",
    description: "Allows planned liquidation simulation for leveraged positions.",
    group: "TRADING",
    riskLevel: "CRITICAL",
    plannedMilestone: "v2.x trading",
    defaultEnabled: false,
  },
  {
    key: "enableAdvancedOrders",
    displayName: "Advanced Orders",
    description: "Allows planned non-basic order types such as stop or post-only flows.",
    group: "TRADING",
    riskLevel: "HIGH",
    plannedMilestone: "future spot expansion",
    defaultEnabled: false,
  },
] as const satisfies readonly FeatureFlagDefinition[];

export type FeatureFlagKey = (typeof FEATURE_FLAG_DEFINITIONS)[number]["key"];

export const FEATURE_FLAG_KEYS = FEATURE_FLAG_DEFINITIONS.map((flag) => flag.key) as FeatureFlagKey[];

export function isFeatureFlagKey(value: string): value is FeatureFlagKey {
  return FEATURE_FLAG_KEYS.includes(value as FeatureFlagKey);
}

export const DEFAULT_ASSETS = [
  {
    symbol: "SWC",
    name: "SW Cash",
    displayName: "SW Cash",
    decimals: 18,
    iconSource: "FALLBACK",
    sortOrder: 10,
    description: "Simulated settlement unit referencing HKD display only, not redeemable.",
  },
  {
    symbol: "SWL",
    name: "SW LUNA",
    displayName: "SW LUNA",
    decimals: 18,
    iconSource: "FALLBACK",
    sortOrder: 20,
    description: "Virtual volatile token for simulation.",
  },
  {
    symbol: "SWD",
    name: "SW DOGE",
    displayName: "SW DOGE",
    decimals: 18,
    iconSource: "FALLBACK",
    sortOrder: 30,
    description: "Virtual demo asset used to verify multi-market simulation support.",
  },
] as const;

export const DEFAULT_MARKETS = [
  {
    symbol: "SWL/SWC",
    baseAssetSymbol: "SWL",
    quoteAssetSymbol: "SWC",
  },
  {
    symbol: "SWD/SWC",
    baseAssetSymbol: "SWD",
    quoteAssetSymbol: "SWC",
  },
] as const;
