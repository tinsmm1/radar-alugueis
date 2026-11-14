import { defineConfig, devices } from "@playwright/test";

export const E2E_PORT = 3800;
export const E2E_DB = process.env.E2E_DATABASE_URL ?? "postgres://postgres:radar@127.0.0.1:54500/radar_e2e";
export const E2E_PASSWORD = "senha-e2e-segura";

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  use: { baseURL: `http://127.0.0.1:${E2E_PORT}`, locale: "pt-BR", timezoneId: "America/Sao_Paulo" },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, storageState: "e2e/.auth.json" }, dependencies: ["setup"], testIgnore: /mobile/ },
    { name: "mobile", use: { ...devices["Pixel 7"], storageState: "e2e/.auth.json" }, dependencies: ["setup"], testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: `pnpm exec next start -p ${E2E_PORT}`,
    url: `http://127.0.0.1:${E2E_PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { DATABASE_URL: E2E_DB, APP_PASSWORD: E2E_PASSWORD, LOG_LEVEL: "warn", NODE_ENV: "production" },
  },
});
