import type { UserRole, UserStatus } from "@sw-exchange/shared";

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
};

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
};

export type MarketStatus = "ACTIVE" | "PAUSED";

export type MarketRow = {
  id: string;
  symbol: string;
  status: MarketStatus;
  baseAssetId: string;
  quoteAssetId: string;
  priceDecimals: number;
  amountDecimals: number;
  createdAt?: string;
  updatedAt?: string;
};

export type LedgerEntry = {
  id: string;
  userId: string;
  asset: string;
  assetSymbol: string;
  assetName: string;
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
  };
  userEmail: string;
  username: string;
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
