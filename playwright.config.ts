import { defineConfig, devices } from "@playwright/test";

// End-to-end tests (TOKI-008 R10): the web app and the server are started
// here, Chromium only for now (spec concern 5). A flow that needs seed data
// uses its own test database and adds its own server entry (R22).
const WEB_PORT = 5173;
const SERVER_PORT = 3000;

export default defineConfig({
  testDir: "./e2e",
  // The flows that need a database have their own configs (playwright.real-server.config.ts and
  // playwright.sign-in.config.ts).
  testIgnore: [
    "real-server/**",
    "sign-in-server/**",
    "assets/**",
    "parity/**",
    "prototype/**",
    // Helpers and the Vitest tests of the helpers (TOKI-109); not Playwright tests.
    "support/**",
  ],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  // One folder for each config: Playwright empties its output folder when a run starts.
  outputDir: "e2e/assets/e2e",
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: "on",
    screenshot: "on",
    video: "on",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // The server needs a connection value to start but opens none until a
      // query runs; the tests here send none.
      command: "pnpm --filter @toki/server exec tsx src/main.ts",
      url: `http://127.0.0.1:${SERVER_PORT}/healthz`,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 60_000,
      env: {
        NODE_ENV: "development",
        SERVER_PORT: String(SERVER_PORT),
        SERVER_HOST: "127.0.0.1",
        LOG_LEVEL: "warn",
        DATABASE_URL: "postgres://e2e:e2e@127.0.0.1:1/e2e_test",
        // The server entry needs the mail values; nothing listens here, as with the database.
        SMTP_HOST: "127.0.0.1",
        SMTP_PORT: "1",
        SMTP_TLS: "none",
        MAIL_FROM_ADDRESS: "toki@example.com",
        // The first set-up values (TOKI-020 R21): fake; the step finds no database and only logs.
        FIRST_ADMIN_EMAIL: "admin@example.com",
        FIRST_ADMIN_NAME: "Test Admin",
        WORKSPACE_NAME: "Test Workspace",
        // And the auth values (TOKI-022); fake, nothing reads them in the e2e run.
        AUTH_CODE_SECRET: "e2e-code-secret-e2e-code-secret-00",
        APP_ORIGIN: "http://127.0.0.1:5173",
      },
    },
    {
      command: "pnpm --filter @toki/web exec vite --host 127.0.0.1",
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 60_000,
      // The dev proxy reads the server port from the environment first.
      env: { SERVER_PORT: String(SERVER_PORT) },
    },
  ],
});
