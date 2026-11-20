import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { expect, test, type Page } from "@playwright/test";

// TOKI-026: the emergency link against the real server and a real database. A link is printed by the real
// command, opened in a real browser and used. Fake addresses only.
const run = promisify(execFile);
const serverDir = path.resolve(import.meta.dirname, "../../apps/server");
const WEB_PORT = 5183;
const MEMBER = "admin@example.com"; // the first admin of the first set-up (playwright.real-server.config.ts)

test.skip(
  !process.env.TEST_DATABASE_URL?.trim(),
  "needs TEST_DATABASE_URL (a loopback Postgres)",
);
// One member, one open link at a time: each test prints its own, which cancels the one before.
test.describe.configure({ mode: "serial" });

function databaseUrl(): string {
  const url = new URL(process.env.TEST_DATABASE_URL!);
  url.pathname = "/toki_e2e_real";
  return url.toString();
}

// The command as the documented form runs it, for the first admin. The first set-up runs just after the
// server starts, so a refusal for a missing account is tried again for a while.
async function printLink(): Promise<string> {
  const env = {
    PATH: process.env.PATH ?? "",
    HOME: process.env.HOME ?? "",
    NODE_ENV: "development",
    DATABASE_URL: databaseUrl(),
    APP_ORIGIN: `http://127.0.0.1:${WEB_PORT}`,
  };
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const { stdout } = await run(
        process.execPath,
        ["--import", "tsx", "src/cli/emergency-link.ts", MEMBER],
        { cwd: serverDir, env },
      );
      const link = stdout.trim();
      expect(link).toMatch(
        new RegExp(
          `^http://127\\.0\\.0\\.1:${WEB_PORT}/emergency#[A-Za-z0-9_-]{43}$`,
        ),
      );
      return link;
    } catch (error) {
      if ((error as { code?: number }).code !== 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error("the command printed no link for the first admin");
}

const posts = (page: Page) => {
  const seen: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().includes("/auth/emergency-sessions")
    ) {
      seen.push(request.url());
    }
  });
  return seen;
};

test("a printed link opened and used signs the member in and lands on Home", async ({
  page,
}) => {
  const link = await printLink();
  await page.goto(link);
  await expect(page).toHaveURL(`http://127.0.0.1:${WEB_PORT}/emergency`);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(`http://127.0.0.1:${WEB_PORT}/`);
  const me = await page.request.get("/api/v1/auth/session");
  expect(me.status()).toBe(200);
  expect((await me.json()).user.email).toBe(MEMBER);
});

test("opening a link without pressing sends no request, and the link still works afterwards", async ({
  page,
  browser,
}) => {
  const link = await printLink();
  const sent = posts(page);
  await page.goto(link);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await page.waitForTimeout(1000);
  expect(sent).toEqual([]);

  const other = await browser.newContext();
  const second = await other.newPage();
  await second.goto(link);
  await second.getByRole("button", { name: "Sign in" }).click();
  await expect(second).toHaveURL(`http://127.0.0.1:${WEB_PORT}/`);
  await other.close();
});

test("the same link opened in a second tab after it was used shows it as not valid", async ({
  context,
}) => {
  const link = await printLink();
  const first = await context.newPage();
  await first.goto(link);
  await first.getByRole("button", { name: "Sign in" }).click();
  await expect(first).toHaveURL(`http://127.0.0.1:${WEB_PORT}/`);

  const second = await context.newPage();
  await second.goto(link);
  // The browser has a session now, so the page asks first.
  await second.getByRole("button", { name: "Sign out and continue" }).click();
  await expect(second.getByText(/This link is not valid/)).toBeVisible();
});
