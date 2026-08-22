import { ZodError } from "zod";
import type { ErrorRequestHandler } from "express";
import { AppError } from "../lib/errors.js";
import { logger } from "./request-context.js";

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  void _next;
  if (error instanceof ZodError) return res.status(422).json({ error: { code: "VALIDATION_ERROR", message: error.issues[0]?.message ?? "Invalid request.", requestId: req.requestId } });
  if (error instanceof AppError) return res.status(error.status).json({ error: { code: error.code, message: error.message, requestId: req.requestId } });
  logger.error({ error, requestId: req.requestId }, "unhandled request error");
  return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong.", requestId: req.requestId } });
};
