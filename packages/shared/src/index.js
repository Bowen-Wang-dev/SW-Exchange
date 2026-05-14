export const USER_ROLES = ["USER", "ADMIN"];
export const USER_STATUSES = ["ACTIVE", "FROZEN", "BANNED"];
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
];
export const DEFAULT_MARKETS = [
    {
        symbol: "SWL/SWC",
        baseAssetSymbol: "SWL",
        quoteAssetSymbol: "SWC",
    },
];
export const TRADING_FEE_BPS = 10;
export const TRADING_FEE_RATE = "0.001";
