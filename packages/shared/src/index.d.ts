export declare const USER_ROLES: readonly ["USER", "ADMIN"];
export type UserRole = (typeof USER_ROLES)[number];
export declare const USER_STATUSES: readonly ["ACTIVE", "FROZEN", "BANNED"];
export type UserStatus = (typeof USER_STATUSES)[number];
export declare const DEFAULT_ASSETS: readonly [{
    readonly symbol: "SWC";
    readonly name: "SW Cash";
    readonly displayName: "SW Cash";
    readonly decimals: 18;
    readonly iconSource: "FALLBACK";
    readonly sortOrder: 10;
    readonly description: "Simulated settlement unit referencing HKD display only, not redeemable.";
}, {
    readonly symbol: "SWL";
    readonly name: "SW LUNA";
    readonly displayName: "SW LUNA";
    readonly decimals: 18;
    readonly iconSource: "FALLBACK";
    readonly sortOrder: 20;
    readonly description: "Virtual volatile token for simulation.";
}];
export declare const DEFAULT_MARKETS: readonly [{
    readonly symbol: "SWL/SWC";
    readonly baseAssetSymbol: "SWL";
    readonly quoteAssetSymbol: "SWC";
}];
