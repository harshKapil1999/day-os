import { defineConfig } from "drizzle-kit";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), "../../.env"), quiet: true });
loadEnv({ quiet: true });

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgresql://dayos:dayos@localhost:5432/dayos" },
  strict: true,
  verbose: true
});
