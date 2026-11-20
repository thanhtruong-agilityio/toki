import { defineConfig, devices } from "@playwright/test";

// End-to-end tests against the real server and a real database (TOKI-026): the flows that the stubbed
// tests of playwright.config.ts cannot cover. `webServer` belongs to a config, not to a project, so
// these tests have a config of their own, with their own ports. Run with `pnpm test:e2e:real`; it
// needs TEST_DATABASE_URL (a loopback Postgres, as the database tests do) and does nothing without it.
// The `e2e` job of CI has no Postgres, so this run is local until that job gets one.
const WEB_PORT = 5183;
const SERVER_PORT = 3010;
const enabled = !!process.env.TEST_DATABASE_URL?.trim();

export default defineConfig({
  testDir: "./e2e/real-server",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: enabled
    ? [
        {
          command:
            "pnpm --filter @toki/server exec tsx tests/e2e-real-launch.ts",
          url: `http://127.0.0.1:${SERVER_PORT}/healthz`,
          reuseExistingServer: false,
          stdout: "pipe",
          stderr: "pipe",
          timeout: 90_000,
          env: {
            TEST_DATABASE_URL: process.env.TEST_DATABASE_URL!,
            NODE_ENV: "development",
            SERVER_PORT: String(SERVER_PORT),
            SERVER_HOST: "127.0.0.1",
            LOG_LEVEL: "warn",
            SMTP_HOST: "127.0.0.1",
            // The e2e/support/smtp-sink.ts of the Join tests listens here and keeps the mails; with no sink a mail fails
            // as it did when nothing listened.
            SMTP_PORT: "2526",
            SMTP_TLS: "none",
            MAIL_FROM_ADDRESS: "toki@example.com",
            FIRST_ADMIN_EMAIL: "admin@example.com",
            FIRST_ADMIN_NAME: "Test Admin",
            WORKSPACE_NAME: "Test Workspace",
            AUTH_CODE_SECRET: "e2e-code-secret-e2e-code-secret-00",
            APP_ORIGIN: `http://127.0.0.1:${WEB_PORT}`,
          },
        },
        {
          command:
            "pnpm --filter @toki/web exec vite --host 127.0.0.1 --port 5183",
          url: `http://127.0.0.1:${WEB_PORT}`,
          reuseExistingServer: false,
          stdout: "pipe",
          stderr: "pipe",
          timeout: 60_000,
          env: { SERVER_PORT: String(SERVER_PORT) },
        },
      ]
    : [],
});
