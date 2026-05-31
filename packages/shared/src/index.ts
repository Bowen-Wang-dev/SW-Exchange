export const USER_ROLES = ["USER", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["ACTIVE", "FROZEN", "BANNED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const FEATURE_FLAG_GROUPS = ["FUNDING", "SECURITY", "OPERATIONS", "TRADING"] as const;
export type FeatureFlagGroup = (typeof FEATURE_FLAG_GROUPS)[number];

export const FEATURE_FLAG_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type FeatureFlagRiskLevel = (typeof FEATURE_FLAG_RISK_LEVELS)[number];

export const SECURITY_EVENT_SEVERITIES = ["INFO", "WARNING", "CRITICAL"] as const;
export type SecurityEventSeverity = (typeof SECURITY_EVENT_SEVERITIES)[number];

export const SECURITY_EVENT_TYPES = [
  "AUTH_LOGIN_SUCCESS",
  "AUTH_LOGIN_FAILED",
  "AUTH_LOGOUT",
  "EMAIL_VERIFICATION_REQUESTED",
  "EMAIL_VERIFICATION_SENT",
  "EMAIL_VERIFICATION_CONFIRMED",
  "EMAIL_VERIFICATION_FAILED",
  "EMAIL_VERIFICATION_TOKEN_EXPIRED",
  "EMAIL_VERIFICATION_TOKEN_REUSED",
  "ADMIN_ACTION_CONFIRMED",
  "FEATURE_FLAG_READ_ADMIN",
  "SENSITIVE_ACTION_REQUIRED",
  "SENSITIVE_ACTION_CONFIRMED",
  "SENSITIVE_ACTION_REJECTED",
  "USER_STATUS_CHANGED",
  "ASSET_STATUS_CHANGED",
  "MARKET_STATUS_CHANGED",
  "FEE_SETTINGS_UPDATED",
  "ADMIN_AIRDROP_CREATED",
  "ADMIN_WALLET_TRANSFER_CREATED",
] as const;
export type SecurityEventType = (typeof SECURITY_EVENT_TYPES)[number];

export function isSecurityEventSeverity(value: string): value is SecurityEventSeverity {
  return SECURITY_EVENT_SEVERITIES.includes(value as SecurityEventSeverity);
}

export function isSecurityEventType(value: string): value is SecurityEventType {
  return SECURITY_EVENT_TYPES.includes(value as SecurityEventType);
}

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

export type SensitiveActionDefinition = {
  key: string;
  displayName: string;
  severity: SecurityEventSeverity;
  requiresPasswordReauth: boolean;
  requiresEmailVerification: boolean;
  requires2FA: boolean;
  requiresAdminRole: boolean;
  notes: string;
};

export const SENSITIVE_ACTION_DEFINITIONS = [
  {
    key: "CHANGE_EMAIL",
    displayName: "Change Email",
    severity: "CRITICAL",
    requiresPasswordReauth: true,
    requiresEmailVerification: true,
    requires2FA: true,
    requiresAdminRole: false,
    notes:
      "Planned-only in v1.0.2. Email verification state now exists, but future enforcement should still require fresh re-auth before the account email changes.",
  },
  {
    key: "ENABLE_2FA",
    displayName: "Enable 2FA",
    severity: "WARNING",
    requiresPasswordReauth: true,
    requiresEmailVerification: true,
    requires2FA: false,
    requiresAdminRole: false,
    notes:
      "Planned-only in v1.0.2. Future enrollment should require password re-auth and the now-live email-verification state before TOTP activation is finalized.",
  },
  {
    key: "DISABLE_2FA",
    displayName: "Disable 2FA",
    severity: "CRITICAL",
    requiresPasswordReauth: true,
    requiresEmailVerification: true,
    requires2FA: true,
    requiresAdminRole: false,
    notes:
      "Planned-only in v1.0.2. Future disable flow should require an active 2FA challenge plus fresh account re-auth.",
  },
  {
    key: "REQUEST_WITHDRAWAL",
    displayName: "Request Withdrawal",
    severity: "CRITICAL",
    requiresPasswordReauth: true,
    requiresEmailVerification: true,
    requires2FA: true,
    requiresAdminRole: false,
    notes:
      "Planned-only in v1.0.2. Withdrawals are not implemented, but future requests should require all user-side security checks.",
  },
  {
    key: "APPROVE_WITHDRAWAL",
    displayName: "Approve Withdrawal",
    severity: "CRITICAL",
    requiresPasswordReauth: true,
    requiresEmailVerification: true,
    requires2FA: true,
    requiresAdminRole: true,
    notes:
      "Planned-only in v1.0.2. Future approval should be restricted to authorized admins with fresh re-auth and 2FA.",
  },
  {
    key: "UPDATE_WITHDRAW_FEE",
    displayName: "Update Withdraw Fee",
    severity: "CRITICAL",
    requiresPasswordReauth: true,
    requiresEmailVerification: true,
    requires2FA: true,
    requiresAdminRole: true,
    notes:
      "Planned-only in v1.0.2. Future withdrawal fee policy changes should require elevated admin confirmation and security checks.",
  },
  {
    key: "ENABLE_DEPOSITS",
    displayName: "Enable Deposits",
    severity: "CRITICAL",
    requiresPasswordReauth: true,
    requiresEmailVerification: true,
    requires2FA: true,
    requiresAdminRole: true,
    notes:
      "Planned-only in v1.0.2. Deposit enablement remains future work and should be guarded as a critical admin action.",
  },
  {
    key: "ENABLE_WITHDRAWALS",
    displayName: "Enable Withdrawals",
    severity: "CRITICAL",
    requiresPasswordReauth: true,
    requiresEmailVerification: true,
    requires2FA: true,
    requiresAdminRole: true,
    notes:
      "Planned-only in v1.0.2. Withdrawal enablement remains future work and should require the strictest admin checks.",
  },
  {
    key: "UPDATE_CHAIN_CONTRACT",
    displayName: "Update Chain Contract",
    severity: "CRITICAL",
    requiresPasswordReauth: true,
    requiresEmailVerification: true,
    requires2FA: true,
    requiresAdminRole: true,
    notes:
      "Planned-only in v1.0.2. Chain contract metadata is not live, but future edits should be treated as high-impact custody configuration.",
  },
  {
    key: "ADMIN_USER_STATUS_CHANGE",
    displayName: "Admin User Status Change",
    severity: "WARNING",
    requiresPasswordReauth: true,
    requiresEmailVerification: true,
    requires2FA: true,
    requiresAdminRole: true,
    notes:
      "Planned-only in v1.0.2. Current admin status controls are live, but future sensitive-action enforcement is not yet active.",
  },
  {
    key: "ADMIN_ASSET_STATUS_CHANGE",
    displayName: "Admin Asset Status Change",
    severity: "WARNING",
    requiresPasswordReauth: true,
    requiresEmailVerification: true,
    requires2FA: true,
    requiresAdminRole: true,
    notes:
      "Planned-only in v1.0.2. Asset pause and resume actions are live, while re-auth and 2FA gates remain future work.",
  },
  {
    key: "ADMIN_MARKET_STATUS_CHANGE",
    displayName: "Admin Market Status Change",
    severity: "WARNING",
    requiresPasswordReauth: true,
    requiresEmailVerification: true,
    requires2FA: true,
    requiresAdminRole: true,
    notes:
      "Planned-only in v1.0.2. Market pause and resume actions are live, while sensitive-action enforcement remains future-only.",
  },
  {
    key: "ADMIN_WALLET_TRANSFER",
    displayName: "Admin Wallet Transfer",
    severity: "CRITICAL",
    requiresPasswordReauth: true,
    requiresEmailVerification: true,
    requires2FA: true,
    requiresAdminRole: true,
    notes:
      "Planned-only in v1.0.2. Internal admin bucket transfers are live and should later require fresh privileged confirmation.",
  },
  {
    key: "UPDATE_FEE_SETTINGS",
    displayName: "Update Fee Settings",
    severity: "WARNING",
    requiresPasswordReauth: true,
    requiresEmailVerification: true,
    requires2FA: true,
    requiresAdminRole: true,
    notes:
      "Planned-only in v1.0.2. Fee configuration is live, but the future model should require stronger admin re-auth before changes.",
  },
  {
    key: "ADMIN_AIRDROP",
    displayName: "Admin Airdrop",
    severity: "WARNING",
    requiresPasswordReauth: true,
    requiresEmailVerification: true,
    requires2FA: true,
    requiresAdminRole: true,
    notes:
      "Planned-only in v1.0.2. Admin airdrops are live today and should later use the same sensitive-action confirmation model.",
  },
] as const satisfies readonly SensitiveActionDefinition[];

export type SensitiveActionKey = (typeof SENSITIVE_ACTION_DEFINITIONS)[number]["key"];

export const SENSITIVE_ACTION_KEYS = SENSITIVE_ACTION_DEFINITIONS.map(
  (action) => action.key,
) as SensitiveActionKey[];

export function isSensitiveActionKey(value: string): value is SensitiveActionKey {
  return SENSITIVE_ACTION_KEYS.includes(value as SensitiveActionKey);
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
