export declare const USER_ROLES: readonly ["USER", "ADMIN"];
export type UserRole = (typeof USER_ROLES)[number];
export declare const USER_STATUSES: readonly ["ACTIVE", "FROZEN", "BANNED"];
export type UserStatus = (typeof USER_STATUSES)[number];
export declare const DEFAULT_ASSETS: readonly [{
    readonly symbol: "SWC";
    readonly name: "SW Cash";
    readonly decimals: 18;
    readonly description: "Internal simulated settlement unit with HKD reference pricing only.";
}, {
    readonly symbol: "SWL";
    readonly name: "SW LUNA";
    readonly decimals: 18;
    readonly description: "Internal volatile virtual asset for simulated spot trading.";
}];
export declare const DEFAULT_MARKETS: readonly [{
    readonly symbol: "SWL/SWC";
    readonly baseAssetSymbol: "SWL";
    readonly quoteAssetSymbol: "SWC";
}];
