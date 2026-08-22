import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.js";

const buckets = new Map<string, { count: number; resetAt: number }>();

export function mutationRateLimit(req: Request, _res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const now = Date.now(); const key = `${req.authUserId ?? req.ip}:${Math.floor(now / 60_000)}`;
  const bucket = buckets.get(key) ?? { count: 0, resetAt: now + 60_000 };
  bucket.count += 1; buckets.set(key, bucket);
  if (bucket.count > 120) return next(new AppError("RATE_LIMITED", "Please wait a moment and try again.", 429));
  next();
}
