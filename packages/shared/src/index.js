export const USER_ROLES = ["USER", "ADMIN"];
export const USER_STATUSES = ["ACTIVE", "FROZEN", "BANNED"];
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
];
export const DEFAULT_MARKETS = [
    {
        symbol: "SWL/SWC",
        baseAssetSymbol: "SWL",
        quoteAssetSymbol: "SWC",
    },
];
