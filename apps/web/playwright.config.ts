import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", timeout: 30_000, fullyParallel: false, workers: 1,
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  webServer: { command: "DAYOS_TEST_MODE=1 AUTH_MODE=demo pnpm --dir ../.. dev", url: "http://localhost:3000", reuseExistingServer: true, timeout: 120_000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }, { name: "mobile", use: { ...devices["iPhone 14"] } }]
});
