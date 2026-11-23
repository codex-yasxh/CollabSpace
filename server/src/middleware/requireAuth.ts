import type { Request, Response, NextFunction } from "express";
import { AppError } from "./errorHandler.js";
import { AUTH_COOKIE_NAME, verifyToken } from "../modules/auth/authService.js";
import { findById } from "../modules/users/userRepository.js";

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = (req.cookies?.[AUTH_COOKIE_NAME] || req.cookies?.["cs_session"]) as string | undefined;

  if (!token) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication required.");
  }

  const payload = verifyToken(token);
  if (!payload) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication required.");
  }

  const user = await findById(payload.userId);
  if (!user) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication required.");
  }

  req.user = user;
  next();
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = (req.cookies?.[AUTH_COOKIE_NAME] || req.cookies?.["cs_session"]) as string | undefined;
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const user = await findById(payload.userId);
      if (user) {
        req.user = user;
      }
    }
  }
  next();
}
