import express from "express";
import cookieParser from "cookie-parser";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./modules/auth/authRouter.js";

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  // Auth routes
  app.use("/api/auth", authRouter);

  // Central error handler
  app.use(errorHandler);

  return app;
}
