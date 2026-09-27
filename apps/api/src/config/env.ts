import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";

if (process.env.NODE_ENV !== "test" && process.env.DAYOS_TEST_MODE !== "1") {
  loadEnv({ path: resolve(process.cwd(), "../../.env"), quiet: true });
  loadEnv({ quiet: true });
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  PORT: z.coerce.number().int().positive().optional(),
  WEB_URL: z.string().url().default("http://localhost:3000"),
  CORS_ORIGINS: z.string().optional(),
  DATABASE_URL: z.string().url().optional(),
  CLERK_SECRET_KEY: z.string().min(10).optional(),
  AUTH_MODE: z.enum(["clerk", "demo"]).default("demo"),
  LOG_LEVEL: z.string().default("info")
});

export const env = envSchema.parse(process.env);

if (env.NODE_ENV === "production" && (env.AUTH_MODE !== "clerk" || !env.CLERK_SECRET_KEY || !env.DATABASE_URL)) {
  throw new Error("Production requires AUTH_MODE=clerk, CLERK_SECRET_KEY, and DATABASE_URL");
}
