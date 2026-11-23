import { Router, type Request, type Response, type NextFunction } from "express";
import { registerSchema, loginSchema } from "./authSchemas.js";
import {
  hashPassword,
  verifyPassword,
  signToken,
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_OPTIONS,
} from "./authService.js";
import { createUser, findByEmail } from "../users/userRepository.js";
import { AppError } from "../../middleware/errorHandler.js";
import { requireAuth } from "../../middleware/requireAuth.js";

export const authRouter = Router();

authRouter.post(
  "/register",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = registerSchema.parse(req.body);

      const existingUser = await findByEmail(data.email);
      if (existingUser) {
        throw new AppError(409, "CONFLICT", "An account already exists with that email.");
      }

      const passwordHash = await hashPassword(data.password);
      const user = await createUser({
        name: data.name,
        email: data.email,
        password_hash: passwordHash,
      });

      const token = signToken({ userId: user.id, email: user.email });
      res.cookie(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);

      res.status(201).json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          created_at: user.created_at,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post(
  "/login",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = loginSchema.parse(req.body);

      const user = await findByEmail(data.email);
      if (!user) {
        throw new AppError(401, "UNAUTHORIZED", "Email or password is incorrect.");
      }

      const isPasswordValid = await verifyPassword(data.password, user.password_hash);
      if (!isPasswordValid) {
        throw new AppError(401, "UNAUTHORIZED", "Email or password is incorrect.");
      }

      const token = signToken({ userId: user.id, email: user.email });
      res.cookie(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);

      res.status(200).json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          created_at: user.created_at,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post("/logout", (_req: Request, res: Response): void => {
  res.clearCookie(AUTH_COOKIE_NAME, { path: "/" });
  res.status(200).json({ ok: true });
});

authRouter.get(
  "/me",
  requireAuth,
  (req: Request, res: Response): void => {
    const user = req.user!;
    res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        created_at: user.created_at,
      },
    });
  },
);
