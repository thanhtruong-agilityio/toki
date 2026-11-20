import { test as base, expect, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";

// Shared by playwright.sign-in.config.ts and e2e/sign-in-server (TOKI-023, plan step 8): the values of
// the real-server run and the helpers of its specs. Fake data only: every address is on example.com and
// every code is read from the mail the real server sent to Mailpit; none is written in a file.
//
// Local defaults point at throwaway containers (see the comment of the config); CI sets the variables.
export const WEB_PORT = 5174;
export const SERVER_PORT = 3100;
export const DATABASE_URL =
  process.env.E2E_DATABASE_URL?.trim() ||
  "postgres://postgres:e2e@127.0.0.1:55440/postgres";
export const DATABASE_NAME = "toki_e2e_sign_in_test";
export const SMTP_HOST = process.env.E2E_SMTP_HOST?.trim() || "127.0.0.1";
export const SMTP_PORT = Number(process.env.E2E_SMTP_PORT?.trim() || "1025");
export const MAILPIT_URL = (
  process.env.E2E_MAILPIT_URL?.trim() || "http://127.0.0.1:8025"
).replace(/\/$/, "");

// The seed of apps/server/tests/e2e-sign-in-launch.ts.
export const WORKSPACE_NAME = "Acme Studio";
export const ADMIN_EMAIL = "admin@example.com";
export const DEACTIVATED_EMAIL = "gone@example.com";

// Each run makes its own addresses, so the mail of an earlier run that is still in Mailpit never matches.
const RUN = randomBytes(4).toString("hex");
let counter = 0;
export function newAddress(label: string): string {
  counter += 1;
  return `${label}-${RUN}-${counter}@example.com`;
}

// A message of Mailpit: the summary of a search, then the full message for its text.
type Summary = { ID: string };
async function messagesTo(address: string): Promise<Summary[]> {
  const response = await fetch(
    `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`,
  );
  if (!response.ok) throw new Error(`Mailpit answered ${response.status}`);
  const body = (await response.json()) as { messages: Summary[] | null };
  return body.messages ?? [];
}

// The code of the newest mail to `address`, once there are `count` mails for it (the second mail after a
// resend, say). Mailpit lists the newest first.
export async function codeFromMail(
  address: string,
  count = 1,
): Promise<string> {
  const deadline = Date.now() + 15_000;
  for (;;) {
    const found = await messagesTo(address);
    if (found.length >= count) {
      const response = await fetch(
        `${MAILPIT_URL}/api/v1/message/${found[0]!.ID}`,
      );
      const { Text } = (await response.json()) as { Text: string };
      const match = /\b(\d{6})\b/.exec(Text);
      if (!match) throw new Error("the mail holds no 6-digit code");
      return match[1]!;
    }
    if (Date.now() > deadline) {
      throw new Error(`no mail for ${count} request(s) arrived for ${address}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

export async function mailCount(address: string): Promise<number> {
  return (await messagesTo(address)).length;
}

// A 6-digit string that is not `code`.
export function wrongCode(code: string): string {
  return code === "000000" ? "111111" : "000000";
}

// One network address per test for the per-address counts of the server (20 requests in 15 minutes for
// each of the code and session routes): the server runs with TRUSTED_PROXY, so the header below is the
// address it counts. The browser sends it on every request, the proxy of the dev server passes it on.
let ipCounter = 0;
export function nextIp(workerIndex: number): string {
  ipCounter += 1;
  return `10.${workerIndex % 250}.${Math.floor(ipCounter / 250) % 250}.${(ipCounter % 250) + 1}`;
}

export const test = base.extend<{ ip: string }>({
  // Playwright reads the fixtures a function needs from its first parameter, which must be a pattern.
  // eslint-disable-next-line no-empty-pattern
  ip: async ({}, use, testInfo) => {
    await use(nextIp(testInfo.workerIndex));
  },
  context: async ({ context, ip }, use) => {
    await context.setExtraHTTPHeaders({ "x-forwarded-for": ip });
    await use(context);
  },
});
export { expect };

// Signs a person in without the screens, in the browser context of `page` (the cookie is kept there):
// the setup of a case that is not about signing in. The same calls the screens make.
export async function signInByApi(
  page: Page,
  ip: string,
  address: string,
): Promise<void> {
  const headers = { "x-forwarded-for": ip };
  const codes = await page.request.post("/api/v1/auth/codes", {
    headers,
    data: { email: address },
  });
  expect(codes.status()).toBe(200);
  const { requestId } = (await codes.json()) as { requestId: string };
  const code = await codeFromMail(address);
  const sessions = await page.request.post("/api/v1/auth/sessions", {
    headers,
    data: { requestId, code },
  });
  expect(sessions.status()).toBe(200);
}
