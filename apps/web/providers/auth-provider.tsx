"use client";

import type { AdminPermission, AdminRoleKey } from "@sw-exchange/shared";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { apiRequest, logResolvedApiBaseUrl } from "@/lib/api-client";
import {
  clearStoredAccessToken,
  getStoredAccessToken,
  normalizeAuthUser,
  setStoredAccessToken,
  type AuthResponse,
  type LoginChallenge,
  type AuthUser as AuthUserType,
  type AuthUser,
} from "@/lib/auth";

export type AdminCapabilities = { roles: AdminRoleKey[]; permissions: AdminPermission[]; effectivePermissions: AdminPermission[]; enforcementEnabled: boolean };

type AuthContextValue = {
  adminCapabilities: AdminCapabilities | null;
  canAdmin: (permission: AdminPermission) => boolean;
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<AuthUser | LoginChallenge>;
  completeTwoFactorLogin: (challengeToken: string, code: string) => Promise<AuthUser>;
  acceptSession: (response: AuthResponse) => AuthUser;
  register: (
    email: string,
    username: string,
    password: string,
    nickname?: string,
  ) => Promise<AuthUser>;
  logout: () => void;
  loadMe: () => Promise<AuthUser | null>;
  isAuthenticated: () => boolean;
  isAdmin: () => boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type SessionResponseUser = AuthUserType | {
  sub: string;
  email: string;
  username: string;
  nickname?: string | null;
  role: AuthUserType["role"];
  status: AuthUserType["status"];
  isSystem?: boolean;
  twoFactorEnabled?: boolean;
  twoFactorEnabledAt?: string | null;
  emailVerified?: boolean;
  emailVerifiedAt?: string | null;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<{ token: string; value: AdminCapabilities } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const sessionRequestIdRef = useRef(0);

  useEffect(() => {
    logResolvedApiBaseUrl();

    const storedToken = getStoredAccessToken();
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    setToken(storedToken);
    void loadMeWithToken(storedToken);
  }, []);

  useEffect(() => {
    if (!token || user?.role !== "ADMIN" || user.status !== "ACTIVE") { setCapabilities(null); return; }
    let active = true;
    const refresh = async () => {
      try {
        const value = await apiRequest<AdminCapabilities>("/admin/capabilities", { token });
        if (active) setCapabilities({ token, value });
      } catch { if (active) setCapabilities(null); }
    };
    void refresh();
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [token, user?.id, user?.role, user?.status]);

  const adminCapabilities = capabilities?.token === token ? capabilities?.value ?? null : null;
  function canAdmin(permission: AdminPermission) {
    return user?.role === "ADMIN" && user.status === "ACTIVE" && Boolean(adminCapabilities?.effectivePermissions.includes(permission));
  }

  async function loadMeWithToken(accessToken: string) {
    const requestId = ++sessionRequestIdRef.current;

    try {
      const response = await apiRequest<{ user: SessionResponseUser }>("/auth/me", {
        token: accessToken,
      });
      const normalized = normalizeAuthUser(response.user);
      if (sessionRequestIdRef.current !== requestId) {
        return null;
      }
      setUser(normalized);
      return normalized;
    } catch {
      if (sessionRequestIdRef.current !== requestId) {
        return null;
      }
      clearStoredAccessToken();
      setToken(null);
      setUser(null);
      return null;
    } finally {
      if (sessionRequestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }

  async function login(identifier: string, password: string) {
    sessionRequestIdRef.current += 1;

    try {
      const response = await apiRequest<AuthResponse | LoginChallenge>("/auth/login", {
        method: "POST",
        body: { identifier: identifier.trim(), password },
      });

      if ("twoFactorRequired" in response) {
        clearStoredAccessToken();
        setToken(null);
        setUser(null);
        return response;
      }
      return acceptSession(response);
    } finally {
      setIsLoading(false);
    }
  }

  function acceptSession(response: AuthResponse) {
    sessionRequestIdRef.current += 1;
    const normalized = normalizeAuthUser(response.user);
    setStoredAccessToken(response.accessToken);
    setToken(response.accessToken);
    setUser(normalized);
    setIsLoading(false);
    return normalized;
  }

  async function completeTwoFactorLogin(challengeToken: string, code: string) {
    const response = await apiRequest<AuthResponse>("/auth/2fa/login", { method: "POST", body: { challengeToken, code } });
    return acceptSession(response);
  }

  async function register(email: string, username: string, password: string, nickname?: string) {
    sessionRequestIdRef.current += 1;

    try {
      const response = await apiRequest<AuthResponse>("/auth/register", {
        method: "POST",
        body: {
          email,
          username,
          password,
          ...(nickname?.trim() ? { nickname: nickname.trim() } : {}),
        },
      });

      const normalized = normalizeAuthUser(response.user);
      setStoredAccessToken(response.accessToken);
      setToken(response.accessToken);
      setUser(normalized);
      return normalized;
    } finally {
      setIsLoading(false);
    }
  }

  function logout() {
    sessionRequestIdRef.current += 1;
    const storedToken = getStoredAccessToken();
    if (storedToken) {
      void apiRequest<{ success: true }>("/auth/logout", {
        method: "POST",
        token: storedToken,
      }).catch(() => undefined);
    }
    clearStoredAccessToken();
    setToken(null);
    setUser(null);
    setIsLoading(false);
  }

  async function loadMe() {
    const storedToken = getStoredAccessToken();
    if (!storedToken) {
      sessionRequestIdRef.current += 1;
      setIsLoading(false);
      setUser(null);
      setToken(null);
      return null;
    }

    setToken(storedToken);
    setIsLoading(true);
    return loadMeWithToken(storedToken);
  }

  function isAuthenticated() {
    return Boolean(user && token);
  }

  function isAdmin() {
    return user?.role === "ADMIN";
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        adminCapabilities,
        canAdmin,
        isLoading,
        login,
        completeTwoFactorLogin,
        acceptSession,
        register,
        logout,
        loadMe,
        isAuthenticated,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
