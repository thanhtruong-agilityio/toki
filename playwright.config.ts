import { defineConfig, devices } from "@playwright/test";

// End-to-end tests (TOKI-008 R10): the web app and the server are started
// here, Chromium only for now (spec concern 5). A flow that needs seed data
// uses its own test database and adds its own server entry (R22).
const WEB_PORT = 5173;
const SERVER_PORT = 3000;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: "retain-on-failure",
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
