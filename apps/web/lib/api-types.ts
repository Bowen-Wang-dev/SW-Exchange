import type { UserRole, UserStatus } from "@sw-exchange/shared";

export type AssetMetadataFields = {
  displayName?: string | null;
  iconUrl?: string | null;
  iconSource?: "MANUAL" | "PUBLIC" | "FALLBACK" | string | null;
  sortOrder?: number | null;
  description?: string | null;
};

export type WalletBalance = {
  id?: string;
  userId?: string;
  assetId?: string;
  walletType?: WalletType;
  asset: string;
  symbol: string;
  name: string;
  decimals: number;
  available: string;
  locked: string;
  total: string;
  availableRaw: string;
  lockedRaw: string;
  totalRaw: string;
} & AssetMetadataFields;

export type WalletType = "MAIN" | "FEE" | "TREASURY" | "AIRDROP" | "HOT";

export type AdminWalletBalance = WalletBalance & {
  user: {
    id: string;
    email: string;
    username: string;
    isSystem?: boolean;
  };
  email: string;
  username: string;
  isSystem?: boolean;
};

export type AdminWalletBucketBalance = WalletBalance & {
  walletType: WalletType;
  displayName: string;
  status: "ACTIVE" | "PLACEHOLDER" | "FUTURE_V1";
};

export type AdminWalletBucketTransferResponse = {
  id: string;
  assetSymbol: string;
  asset: string;
  amount: string;
  amountRaw: string;
  fromWalletType: WalletType;
  toWalletType: WalletType;
  source: {
    walletType: WalletType;
    available: string;
    availableRaw: string;
    locked: string;
    lockedRaw: string;
  };
  destination: {
    walletType: WalletType;
    available: string;
    availableRaw: string;
    locked: string;
    lockedRaw: string;
  };
  auditLogId: string;
};

export type AdminUser = {
  id: string;
  email: string;
  username: string;
  nickname: string | null;
  role: UserRole;
  status: UserStatus;
  isSystem?: boolean;
  createdAt: string;
  updatedAt: string;
  created_at?: string;
  updated_at?: string;
};

export type AssetStatus = "ACTIVE" | "PAUSED";

export type AssetRow = {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  isActive: boolean;
  status?: AssetStatus;
  createdAt?: string;
  updatedAt?: string;
} & AssetMetadataFields;

export type MarketStatus = "ACTIVE" | "PAUSED";

export type MarketRow = {
  id: string;
  symbol: string;
  status: MarketStatus;
  baseAssetId: string;
  quoteAssetId: string;
  baseAssetSymbol?: string;
  quoteAssetSymbol?: string;
  baseAssetName?: string;
  quoteAssetName?: string;
  baseAssetDisplayName?: string | null;
  quoteAssetDisplayName?: string | null;
  baseAssetIconUrl?: string | null;
  quoteAssetIconUrl?: string | null;
  baseAssetIconSource?: string | null;
  quoteAssetIconSource?: string | null;
  priceDecimals: number;
  amountDecimals: number;
  minOrderAmount?: string;
  minOrderAmountRaw?: string;
  minNotional?: string;
  minNotionalRaw?: string;
  createdAt?: string;
  updatedAt?: string;
  created_at?: string;
  updated_at?: string;
};

export type MarketTicker = {
  marketSymbol: string;
  baseAssetSymbol: string;
  quoteAssetSymbol: string;
  baseAssetName?: string;
  quoteAssetName?: string;
  baseAssetDisplayName?: string | null;
  quoteAssetDisplayName?: string | null;
  baseAssetIconUrl?: string | null;
  quoteAssetIconUrl?: string | null;
  baseAssetIconSource?: string | null;
  quoteAssetIconSource?: string | null;
  lastPrice: string | null;
  bestBid: string | null;
  bestAsk: string | null;
  high24h: string | null;
  low24h: string | null;
  volume24h: string;
  quoteVolume24h: string;
  change24h: string | null;
  change24hPercent: string | null;
  tradeCount24h: number;
  totalTradeCount?: number;
  openOrderCount?: number;
  status?: MarketStatus;
  updatedAt: string;
};

export type CandleInterval = "1m" | "5m" | "15m" | "1h" | "1d";

export type MarketCandle = {
  marketSymbol: string;
  interval: CandleInterval;
  startTime: string;
  endTime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  quoteVolume: string;
  tradeCount: number;
};

export type MarketSummary = {
  marketSymbol: string;
  baseAsset?: {
    symbol: string;
    name?: string;
    displayName?: string | null;
    iconUrl?: string | null;
  };
  quoteAsset?: {
    symbol: string;
    name?: string;
    displayName?: string | null;
    iconUrl?: string | null;
  };
  baseAssetSymbol: string;
  quoteAssetSymbol: string;
  baseAssetName?: string;
  quoteAssetName?: string;
  baseAssetDisplayName?: string | null;
  quoteAssetDisplayName?: string | null;
  baseAssetIconUrl?: string | null;
  quoteAssetIconUrl?: string | null;
  baseAssetIconSource?: string | null;
  quoteAssetIconSource?: string | null;
  lastPrice: string | null;
  bestBid: string | null;
  bestAsk: string | null;
  volume24h: string;
  quoteVolume24h: string;
  change24hPercent: string | null;
  openOrderCount?: number;
  totalTradeCount?: number;
  status: MarketStatus;
};

export type PortfolioValuationAsset = {
  assetSymbol: string;
  asset?: string;
  assetName: string;
  name?: string;
  displayName?: string | null;
  iconUrl?: string | null;
  iconSource?: string | null;
  description?: string | null;
  available: string;
  locked: string;
  total: string;
  availableRaw: string;
  lockedRaw: string;
  totalRaw: string;
  priceInSWC: string | null;
  priceInSWCRaw: string | null;
  valueInSWC: string | null;
  valueInSWCRaw: string | null;
};

export type PortfolioValuation = {
  quoteAssetSymbol: "SWC" | string;
  totalEquity: string;
  totalEquityRaw: string;
  hasUnpricedAssets: boolean;
  assets: PortfolioValuationAsset[];
  updatedAt: string;
};

export type LedgerEntry = {
  id: string;
  userId: string;
  asset: string;
  assetSymbol: string;
  assetName: string;
  assetDisplayName?: string | null;
  displayName?: string | null;
  assetIconUrl?: string | null;
  iconUrl?: string | null;
  assetIconSource?: string | null;
  iconSource?: string | null;
  type: string;
  amount: string;
  amountRaw: string;
  availableAfter: string;
  lockedAfter: string;
  refType: string;
  refId: string | null;
  note: string | null;
  createdAt: string;
};

export type AdminLedgerEntry = LedgerEntry & {
  user: {
    id: string;
    email: string;
    username: string;
    role?: UserRole;
    status?: UserStatus;
    isSystem?: boolean;
  };
  userEmail: string;
  username: string;
  userRole?: UserRole;
  role?: UserRole;
  walletType?: WalletType | "ADMIN_BUCKET";
  ownerType?: "USER_WALLET" | "ADMIN_BUCKET";
};

export type AdminAuditLog = {
  id: string;
  adminUser: {
    id: string;
    email: string;
    username: string;
  };
  action: string;
  targetType: string;
  targetId: string | null;
  beforeValue: unknown;
  afterValue: unknown;
  createdAt: string;
};

export type AdminSummary = {
  totalUsers: number;
  totalWallets: number;
  totalLedgerEntries: number;
  totalTransfers: number;
  totalAuditLogs: number;
  totalOpenOrders?: number;
};

export type AdminReportsSummary = {
  userCount: number;
  activeUserCount: number;
  frozenUserCount: number;
  bannedUserCount: number;
  walletCount: number;
  orderCount: number;
  openOrderCount: number;
  tradeCount: number;
  transferCount: number;
  pausedAssetCount: number;
  pausedMarketCount: number;
  feeWalletBalances: WalletBalance[];
  marketSummary?: {
    marketSymbol: string;
    baseAssetSymbol?: string;
    quoteAssetSymbol?: string;
    lastPrice: string | null;
    volume24h: string;
    openOrderCount: number;
    totalTradeCount: number;
    status: MarketStatus;
  } | null;
  marketSummaries?: MarketSummary[];
  recentTrades: AdminTradeEntry[];
  recentTransfers: AdminTransferEntry[];
  recentAuditLogs: AdminAuditLog[];
};

export type AirdropResponse = {
  targetUser: {
    id: string;
    email: string;
    username: string;
    nickname: string | null;
    role: UserRole;
    status: UserStatus;
  };
  assetSymbol: string;
  amount: string;
  amountRaw: string;
  newAvailable: string;
  newAvailableRaw: string;
  ledgerEntryId: string;
  auditLogId: string;
};

export type TransferResponse = {
  id: string;
  from: {
    id: string;
    email: string;
    username: string;
    nickname: string | null;
    role: UserRole;
    status: UserStatus;
  };
  to: {
    id: string;
    email: string;
    username: string;
    nickname: string | null;
    role: UserRole;
    status: UserStatus;
  };
  assetSymbol: string;
  amount: string;
  amountRaw: string;
  senderNewAvailable: string;
  senderNewAvailableRaw: string;
  recipientNewAvailable: string;
  recipientNewAvailableRaw: string;
  createdAt: string;
};

export type TransferHistoryEntry = {
  id: string;
  direction: "IN" | "OUT";
  counterparty: {
    username: string;
    email: string;
  };
  counterpartyUsername: string;
  counterpartyEmail: string;
  assetSymbol: string;
  amount: string;
  amountRaw: string;
  note: string | null;
  status: "SUCCESS" | "FAILED";
  createdAt: string;
};

export type AdminTransferEntry = {
  id: string;
  from: {
    id: string | null;
    username: string;
    email: string;
  };
  to: {
    id: string | null;
    username: string;
    email: string;
  };
  assetSymbol: string;
  amount: string;
  amountRaw: string;
  note: string | null;
  status: "SUCCESS" | "FAILED";
  createdAt: string;
};

export type OrderSide = "BUY" | "SELL";
export type OrderType = "LIMIT";
export type OrderStatus = "OPEN" | "PARTIAL_FILLED" | "FILLED" | "CANCELLED" | "REJECTED";

export type OrderEntry = {
  id: string;
  userId: string;
  marketId: string;
  marketSymbol: string;
  market: string;
  side: OrderSide;
  type: OrderType;
  price: string;
  priceRaw: string;
  amount: string;
  amountRaw: string;
  filledAmount: string;
  filledAmountRaw: string;
  remainingAmount: string;
  remainingAmountRaw: string;
  status: OrderStatus;
  lockedAssetId: string;
  lockedAssetSymbol: string;
  lockedAsset: {
    id: string;
    symbol: string;
  };
  lockedAmount: string;
  lockedAmountRaw: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
};

export type AdminOrderEntry = OrderEntry & {
  user: {
    id: string;
    email: string;
    username: string;
  };
  userEmail: string;
  username: string;
};

export type OrderBookLevel = {
  price: string;
  priceRaw: string;
  amount: string;
  amountRaw: string;
  orderCount: number;
};

export type OrderBook = {
  marketSymbol: string;
  market: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
};

export type TradeEntry = {
  id: string;
  marketId: string;
  marketSymbol: string;
  market: string;
  side?: OrderSide;
  price: string;
  priceRaw: string;
  amount: string;
  amountRaw: string;
  quoteAmount: string;
  quoteAmountRaw: string;
  buyerFee: string;
  buyerFeeRaw: string;
  buyerFeeAssetId: string;
  buyerFeeAssetSymbol: string;
  buyerFeeRateBps: number;
  sellerFee: string;
  sellerFeeRaw: string;
  sellerFeeAssetId: string;
  sellerFeeAssetSymbol: string;
  sellerFeeRateBps: number;
  fee?: string;
  feeRaw?: string;
  feeAssetSymbol?: string;
  feeRateBps?: number;
  createdAt: string;
};

export type AdminTradeEntry = TradeEntry & {
  buyer: {
    id: string;
    email: string;
    username: string;
  };
  seller: {
    id: string;
    email: string;
    username: string;
  };
};

export type FeeSettingsResponse = {
  id: string;
  marketId: string;
  marketSymbol: string;
  market: string;
  buyerFeeRateBps: number;
  sellerFeeRateBps: number;
  buyerFeeRatePercent: string;
  sellerFeeRatePercent: string;
  buyerFeeRateHuman: string;
  sellerFeeRateHuman: string;
  rateUnit: "basis_points";
  rateDenominator: number;
  maxFeeRateBps: number;
  maxFeeRateHuman: string;
  isActive: boolean;
  feeWallet: {
    userId: string;
    email: string;
    username: string;
    walletType: "FEE";
    displayName: "Fee Wallet";
    status: "ACTIVE";
    balances: WalletBalance[];
  };
  createdAt: string;
  updatedAt: string;
  created_at?: string;
  updated_at?: string;
};
