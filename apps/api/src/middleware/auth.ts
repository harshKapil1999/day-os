import { verifyToken } from "@clerk/backend";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    if (env.AUTH_MODE === "demo" && env.NODE_ENV !== "production") {
      req.authUserId = req.header("x-dayos-demo-user") ?? "demo_user_alex";
      return next();
    }
    const value = req.header("authorization");
    if (!value?.startsWith("Bearer ")) throw new AppError("UNAUTHORIZED", "Sign in to continue.", 401);
    const token = value.slice(7);
    const payload = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY! });
    req.authUserId = payload.sub;
    next();
  } catch (error) {
    next(error instanceof AppError ? error : new AppError("UNAUTHORIZED", "Your session could not be verified.", 401));
  }
}
