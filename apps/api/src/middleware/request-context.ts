import type { NextFunction, Request, Response } from "express";
import pino from "pino";
import { env } from "../config/env.js";

export const logger = pino({ level: env.LOG_LEVEL, redact: ["req.headers.authorization", "DATABASE_URL", "CLERK_SECRET_KEY"] });

export function requestContext(req: Request, res: Response, next: NextFunction) {
  const started = performance.now();
  req.requestId = req.header("x-request-id") ?? crypto.randomUUID();
  res.setHeader("x-request-id", req.requestId);
  res.on("finish", () => logger.info({ requestId: req.requestId, method: req.method, route: req.route?.path ?? req.path, status: res.statusCode, durationMs: Math.round(performance.now() - started), userId: req.authUserId }, "request"));
  next();
}
