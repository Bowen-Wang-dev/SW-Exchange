import type { UserRole, UserStatus } from "@sw-exchange/shared";

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  nickname?: string | null;
  role: UserRole;
  status: UserStatus;
  isSystem?: boolean;
  emailVerified: boolean;
  emailVerifiedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AuthResponse = {
  accessToken: string;
  user: AuthUser;
};

type SessionUserPayload = {
  id?: string;
  sub?: string;
  email: string;
  username: string;
  nickname?: string | null;
  role: UserRole;
  status: UserStatus;
  isSystem?: boolean;
  emailVerified?: boolean;
  emailVerifiedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

const ACCESS_TOKEN_KEY = "sw_exchange_access_token";
let memoryAccessToken: string | null = null;

export function getStoredAccessToken() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(ACCESS_TOKEN_KEY) ?? memoryAccessToken;
  } catch {
    return memoryAccessToken;
  }
}

export function setStoredAccessToken(token: string) {
  memoryAccessToken = token;

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } catch {
    // If storage is unavailable, keep the in-memory session for the current tab.
  }
}

export function clearStoredAccessToken() {
  memoryAccessToken = null;

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    // Storage may be blocked by the browser; failing to clear should not freeze auth state.
  }
}

export function normalizeAuthUser(user: SessionUserPayload): AuthUser {
  return {
    id: user.id ?? user.sub ?? "",
    email: user.email,
    username: user.username,
    nickname: user.nickname,
    role: user.role,
    status: user.status,
    isSystem: user.isSystem,
    emailVerified: Boolean(user.emailVerifiedAt ?? user.emailVerified),
    emailVerifiedAt: user.emailVerifiedAt ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
