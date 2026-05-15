import type { Request } from "express";

export interface AuthenticatedUser {
  sub: string;
  email: string;
  username: string;
  nickname?: string | null;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "FROZEN" | "BANNED";
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
