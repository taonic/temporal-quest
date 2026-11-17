// The Derby load test (load/), apart from the e2e tiers: run by hand or by
// .github/workflows/derby-load.yml, never by the daily run. See load/derby-load.spec.mjs.
//
//   DERBY_CODE=… npx playwright test -c load.config.mjs
//
// One worker a racer. No traces, videos or screenshots: the repo is public, so are a run's
// artifacts, and a trace carries the racers' session cookies. Its failures are in the report.
import { defineConfig, devices } from "@playwright/test";

import { BASE_URL } from "./env.mjs";

export default defineConfig({
  testDir: "./load",
  timeout: 75 * 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: 0,
  workers: Number(process.env.DERBY_PER_SHARD || process.env.DERBY_RACERS || 20),
  reporter: [["list"], ["json", { outputFile: "reports/load/playwright.json" }]],
  use: {
    baseURL: BASE_URL,
    actionTimeout: 30_000,
    trace: "off",
    screenshot: "off",
    video: "off",
    colorScheme: "light",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
});
