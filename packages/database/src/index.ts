import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export * from "./schema.js";

export function createDatabase(url: string) {
  const client = postgres(url, { prepare: false, max: 10, idle_timeout: 20 });
  return { db: drizzle(client, { schema }), close: () => client.end({ timeout: 5 }) };
}

export type Database = ReturnType<typeof createDatabase>["db"];
