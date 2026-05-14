export const USER_ROLES = ["USER", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["ACTIVE", "FROZEN", "BANNED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const DEFAULT_ASSETS = [
  {
    symbol: "SWC",
    name: "SW Cash",
    decimals: 18,
    description: "Internal simulated settlement unit with HKD reference pricing only.",
  },
  {
    symbol: "SWL",
    name: "SW LUNA",
    decimals: 18,
    description: "Internal volatile virtual asset for simulated spot trading.",
  },
] as const;

export const DEFAULT_MARKETS = [
  {
    symbol: "SWL/SWC",
    baseAssetSymbol: "SWL",
    quoteAssetSymbol: "SWC",
  },
] as const;

export const TRADING_FEE_BPS = 10;
export const TRADING_FEE_RATE = "0.001";
