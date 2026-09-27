import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), "../../.env"), quiet: true });
const backendOrigin = (process.env.DAYOS_BACKEND_ORIGIN ?? "http://localhost:4000").replace(/\/$/, "");

const config: NextConfig = {
  transpilePackages: ["@dayos/api-client", "@dayos/domain"],
  typedRoutes: true,
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  experimental: { optimizePackageImports: ["lucide-react", "recharts"] },
  async rewrites() { return [
    { source: "/api/v1/:path*", destination: `${backendOrigin}/api/v1/:path*` },
    { source: "/health", destination: `${backendOrigin}/health` }
  ]; }
};
export default config;
