import { config as loadEnv } from "dotenv";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { resolve } from "node:path";
import { createDatabase } from "./index.js";

loadEnv({ path: resolve(process.cwd(), "../../.env"), quiet: true });
loadEnv({ quiet: true });

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const { db, close } = createDatabase(process.env.DATABASE_URL);
await migrate(db, { migrationsFolder: "./migrations" });
await close();
