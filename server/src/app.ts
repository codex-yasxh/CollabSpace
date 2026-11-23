import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./modules/auth/authRouter.js";
import { documentRouter } from "./modules/documents/documentRouter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

  // Document routes
  app.use("/api/documents", documentRouter);

  // Central error handler for /api routes
  app.use(errorHandler);

  // Serve compiled frontend in production / standalone deployment
  const clientDist = path.resolve(__dirname, "../../client/dist");
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.use((_req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  return app;
}
