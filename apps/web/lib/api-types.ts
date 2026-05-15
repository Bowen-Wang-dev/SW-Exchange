import type { UserRole, UserStatus } from "@sw-exchange/shared";

export type WalletBalance = {
  id?: string;
  userId?: string;
  assetId?: string;
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

export type AdminWalletBalance = WalletBalance & {
  user: {
    id: string;
    email: string;
    username: string;
  };
  email: string;
  username: string;
};

export type AdminUser = {
  id: string;
  email: string;
  username: string;
  nickname: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  created_at?: string;
  updated_at?: string;
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
  totalAuditLogs: number;
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

