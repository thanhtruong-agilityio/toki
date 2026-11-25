import { defineConfig, devices } from "@playwright/test";
import { assertInContainer } from "./e2e/support/guard";

// The UI parity check (TOKI-109): the app compared with the prototype. It runs only inside the
// Playwright container, started by `pnpm test:e2e:parity`, so that the reference images and the
// capture come from the same Chromium and the same fonts (R10). Only Vite is started: every
// `/api` call is stubbed, so the check needs no server and no database.
assertInContainer(process.env);

const WEB_PORT = 5193;

export default defineConfig({
  testDir: "./e2e/parity",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // The reporter writes report.md and report.json to the folder that CI uploads (R11).
  reporter: [["list"], ["./e2e/support/parity-reporter.ts"]],
  // The folder that the container mounts at /out; CI uploads it.
  outputDir: `${process.env.PARITY_OUT ?? "e2e/assets/parity"}/results`,
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    timezoneId: "Asia/Ho_Chi_Minh",
    locale: "en-US",
    deviceScaleFactor: 1,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm --filter @toki/web exec vite --host 127.0.0.1 --port ${WEB_PORT}`,
    url: `http://127.0.0.1:${WEB_PORT}`,
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 90_000,
  },
});
