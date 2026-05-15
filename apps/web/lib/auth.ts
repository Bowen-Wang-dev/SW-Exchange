import type { UserRole, UserStatus } from "@sw-exchange/shared";

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  nickname?: string | null;
  role: UserRole;
  status: UserStatus;
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
  createdAt?: string;
  updatedAt?: string;
};

const ACCESS_TOKEN_KEY = "sw_exchange_access_token";

export function getStoredAccessToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setStoredAccessToken(token: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearStoredAccessToken() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function normalizeAuthUser(user: SessionUserPayload): AuthUser {
  return {
    id: user.id ?? user.sub ?? "",
    email: user.email,
    username: user.username,
    nickname: user.nickname,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
