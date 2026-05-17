export const KNOWN_ASSET_ICON_URLS: Record<string, string> = {
  BTC: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
  ETH: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
  BNB: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png",
  USDT: "https://assets.coingecko.com/coins/images/325/large/Tether.png",
  USDC: "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png",
};

export function resolveAssetIconUrl(symbol: string, iconUrl?: string | null) {
  if (iconUrl?.trim()) {
    return iconUrl.trim();
  }

  return KNOWN_ASSET_ICON_URLS[symbol.trim().toUpperCase()] ?? null;
}
