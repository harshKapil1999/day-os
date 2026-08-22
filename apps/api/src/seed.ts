import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { seedDatabaseUser } from "./store/database-bridge.js";

loadEnv({ path: resolve(process.cwd(), "../../.env"), quiet: true });
loadEnv({ quiet: true });

const data = await seedDatabaseUser();
process.stdout.write(`Seeded DayOS development data for ${data.profile.authUserId}.\n`);
