import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "output/playwright/report", open: "never" }],
    ["json", { outputFile: "output/playwright/results.json" }],
  ],
  use: {
    baseURL: "http://localhost:5174",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: [
    {
      command: "node --import tsx scripts/e2e-server.ts",
      url: "http://localhost:3002/api/health",
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command:
        "node node_modules/vite/bin/vite.js --host localhost --port 5174 --strictPort",
      env: { API_PORT: "3002" },
      url: "http://localhost:5174",
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
});
