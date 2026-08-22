import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), "../../.env"), quiet: true });

const config: NextConfig = {
  transpilePackages: ["@dayos/api-client", "@dayos/domain"],
  typedRoutes: true,
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  experimental: { optimizePackageImports: ["lucide-react", "recharts"] }
};
export default config;
