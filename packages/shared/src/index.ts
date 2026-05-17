export const USER_ROLES = ["USER", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["ACTIVE", "FROZEN", "BANNED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

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
