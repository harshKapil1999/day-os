import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./middleware/request-context.js";

const port = env.PORT ?? env.API_PORT;
const server = createApp().listen(port, () => logger.info({ port }, "DayOS API ready"));
function shutdown(signal: string) { logger.info({ signal }, "shutting down"); server.close((error) => { if (error) { logger.error(error); process.exitCode = 1; } process.exit(); }); }
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
