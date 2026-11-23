import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { CookieOptions } from "express";
import { env } from "../../config/env.js";

const BCRYPT_ROUNDS = 10;
export const AUTH_COOKIE_NAME = "cs_session";

export const AUTH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: "/",
};

export interface TokenPayload {
  sub: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { sub?: string };
    if (typeof decoded === "object" && decoded && typeof decoded.sub === "string") {
      return { sub: decoded.sub };
    }
    return null;
  } catch {
    return null;
  }
}
