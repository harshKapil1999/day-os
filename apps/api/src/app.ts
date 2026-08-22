import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { apiRouter } from "./modules/router.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requireAuth } from "./middleware/auth.js";
import { mutationRateLimit } from "./middleware/rate-limit.js";
import { requestContext } from "./middleware/request-context.js";
import { databaseBridge } from "./store/database-bridge.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by"); app.use(helmet()); app.use(requestContext);
  app.use(cors({ origin: (origin, callback) => !origin || origin === env.WEB_URL ? callback(null, true) : callback(new Error("Origin not allowed")), credentials: true, allowedHeaders: ["Authorization", "Content-Type", "X-Request-Id", "X-DayOS-Demo-User"] }));
  app.use(express.json({ limit: "256kb" }));
  app.get("/health", (_req, res) => res.json({ data: { status: "ok" } }));
  app.use("/api/v1", requireAuth, databaseBridge, mutationRateLimit, apiRouter);
  app.use((_req, res) => res.status(404).json({ error: { code: "NOT_FOUND", message: "Route was not found." } }));
  app.use(errorHandler);
  return app;
}
