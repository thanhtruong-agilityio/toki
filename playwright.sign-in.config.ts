import { defineConfig, devices } from "@playwright/test";
import net from "node:net";
import {
  ADMIN_EMAIL,
  DATABASE_NAME,
  DATABASE_URL,
  DEACTIVATED_EMAIL,
  MAILPIT_URL,
  SERVER_PORT,
  SMTP_HOST,
  SMTP_PORT,
  WEB_PORT,
  WORKSPACE_NAME,
} from "./e2e/support/real-server";

// End-to-end tests of the sign-in screens against the real server, a seeded throwaway Postgres and
// Mailpit (TOKI-023 step 8). `webServer` belongs to a config, so these tests have a config of their own,
// as playwright.config.ts (TOKI-008 R22) asks for a flow that needs seed data; its ports are its own
// (server 3100, web 5174) and nothing of the stubbed run is shared. Run with `pnpm test:e2e:sign-in`.
//
// Services. Local: two throwaway containers (names and ports are yours to choose; these are the defaults):
//   docker run -d --name toki-e2e-pg -p 127.0.0.1:55440:5432 -e POSTGRES_PASSWORD=e2e postgres:17.12
//   docker run -d --name toki-e2e-mail -p 127.0.0.1:1025:1025 -p 127.0.0.1:8025:8025 axllent/mailpit:v1.33.1
// The values: E2E_DATABASE_URL (a loopback Postgres, default postgres://postgres:e2e@127.0.0.1:55440/postgres;
// the database toki_e2e_sign_in_test is dropped and made on it), E2E_SMTP_HOST / E2E_SMTP_PORT (default
// 127.0.0.1:1025) and E2E_MAILPIT_URL (default http://127.0.0.1:8025). CI: the `e2e` job provides both
// services and the variables.
//
// Without CI, a service that does not answer leaves the run with no server and every spec skipped, with
// the reason. In CI nothing is skipped: a missing service fails the job.
const reachable = (host: string, port: number) =>
  new Promise<boolean>((resolve) => {
    const socket = net.connect({ host, port, timeout: 1500 });
    socket.once("connect", () => (socket.destroy(), resolve(true)));
    socket.once("timeout", () => (socket.destroy(), resolve(false)));
    socket.once("error", () => resolve(false));
  });

const database = new URL(DATABASE_URL);
const mailpit = new URL(MAILPIT_URL);
const missing: string[] = [];
if (!process.env.CI) {
  if (!(await reachable(database.hostname, Number(database.port || 5432)))) {
    missing.push(`Postgres at ${database.host} (E2E_DATABASE_URL)`);
  }
  if (!(await reachable(SMTP_HOST, SMTP_PORT))) {
    missing.push(`the SMTP port of Mailpit at ${SMTP_HOST}:${SMTP_PORT}`);
  }
  if (!(await reachable(mailpit.hostname, Number(mailpit.port || 80)))) {
    missing.push(
      `the HTTP API of Mailpit at ${mailpit.host} (E2E_MAILPIT_URL)`,
    );
  }
}
const skipReason =
  missing.length > 0
    ? `not reachable, start the containers of playwright.sign-in.config.ts: ${missing.join("; ")}`
    : "";
// The workers inherit the environment of this process.
process.env.E2E_SIGN_IN_SKIP = skipReason;

export default defineConfig({
  testDir: "./e2e/sign-in-server",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer:
    skipReason === ""
      ? [
          {
            command:
              "pnpm --filter @toki/server exec tsx tests/e2e-sign-in-launch.ts",
            url: `http://127.0.0.1:${SERVER_PORT}/healthz`,
            reuseExistingServer: false,
            stdout: "pipe",
            stderr: "pipe",
            timeout: 90_000,
            env: {
              E2E_DATABASE_URL: DATABASE_URL,
              E2E_DATABASE_NAME: DATABASE_NAME,
              E2E_DEACTIVATED_EMAIL: DEACTIVATED_EMAIL,
              NODE_ENV: "development",
              SERVER_PORT: String(SERVER_PORT),
              SERVER_HOST: "127.0.0.1",
              LOG_LEVEL: "warn",
              SMTP_HOST,
              SMTP_PORT: String(SMTP_PORT),
              SMTP_TLS: "none",
              MAIL_FROM_ADDRESS: "toki@example.com",
              FIRST_ADMIN_EMAIL: ADMIN_EMAIL,
              WORKSPACE_NAME,
              AUTH_CODE_SECRET: "e2e-code-secret-e2e-code-secret-00",
              APP_ORIGIN: `http://127.0.0.1:${WEB_PORT}`,
              // The dev server connects from 127.0.0.1: the address the server counts for the
              // per-address limits is then the one a test puts in x-forwarded-for.
              TRUSTED_PROXY: "127.0.0.1",
            },
          },
          {
            command: `pnpm --filter @toki/web exec vite --host 127.0.0.1 --port ${WEB_PORT}`,
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
