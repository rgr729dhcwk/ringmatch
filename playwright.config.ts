import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "off",
  },
  projects: [
    { name: "pixel7", use: { ...devices["Pixel 7"] } },
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    // Uses a separate test DB so e2e runs never touch your dev data.
    command: `node scripts/e2e-prepare.mjs && npx next build && npx next start -H 127.0.0.1 -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: { DATABASE_URL: "file:./e2e.db", NEXT_DIST_DIR: ".next-e2e", RINGMATCH_OFFLINE: "1" },
  },
});
