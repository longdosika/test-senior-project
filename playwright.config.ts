import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const WEB_URL = "http://localhost:3000";
const API_URL = "http://localhost:4000";
// Pre-installed Chromium on some hosts; when absent, Playwright uses its own browser download.
const SYSTEM_CHROMIUM = "/opt/pw-browsers/chromium";

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.spec.ts",
  // One worker keeps the shared API database deterministic across the flows.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 45_000,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: WEB_URL,
    trace: "off",
    launchOptions: existsSync(SYSTEM_CHROMIUM) ? { executablePath: SYSTEM_CHROMIUM } : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // API on a real PostgreSQL when TEST_DATABASE_URL is set, otherwise in-memory pg-mem.
      command: "pnpm exec tsx e2e/start-api.ts",
      url: `${API_URL}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        PORT: "4000",
        CORS_ORIGIN: WEB_URL,
        ADMIN_EMAILS: "admin@e2e.test",
      },
    },
    {
      command: "pnpm exec next start -p 3000",
      url: WEB_URL,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
