import { randomUUID } from "node:crypto";
import {
  expect,
  request,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { codeOf, joinLinkOf, startSmtpSink } from "../support/smtp-sink";

// TOKI-097: the Join link against the real server, a real database and a real browser. The mails are read
// by a small mail server of the test (e2e/support/smtp-sink.ts), so the link and the code are the ones the
// server made. Fake addresses only. The cases that need 60 seconds or 10 minutes to pass, and the 7 days of
// an expired invitation, are in the integration and component tests, where the clock is a parameter: the
// harness cannot move the clock of a server that Playwright starts (TOKI-008 R19).
const WEB = "http://127.0.0.1:5183";
const SMTP_PORT = 2526;
const ADMIN = "admin@example.com"; // the first admin of the first set-up (playwright.real-server.config.ts)

test.skip(
  !process.env.TEST_DATABASE_URL?.trim(),
  "needs TEST_DATABASE_URL (a loopback Postgres)",
);
// One server, one admin: the cases share it and run in order.
test.describe.configure({ mode: "serial" });

let sink: Awaited<ReturnType<typeof startSmtpSink>>;
let admin: APIRequestContext;
let adminCookies: Awaited<ReturnType<BrowserContext["storageState"]>>;

test.beforeAll(async () => {
  sink = await startSmtpSink(SMTP_PORT);
  admin = await request.newContext({ baseURL: WEB });
  // The first set-up runs just after the server starts: ask for a code only once the workspace exists.
  for (let i = 0; i < 60; i += 1) {
    const res = await admin.get("/api/v1/auth/workspace");
    if (res.ok()) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const before = sink.mails.length;
  const asked = await admin.post("/api/v1/auth/codes", {
    data: { email: ADMIN },
  });
  expect(asked.ok()).toBe(true);
  const { requestId } = (await asked.json()) as { requestId: string };
  const mail = await sink.nextMail(ADMIN, before);
  const signed = await admin.post("/api/v1/auth/sessions", {
    data: { requestId, code: codeOf(mail) },
  });
  expect(signed.ok()).toBe(true);
  adminCookies = await admin.storageState();
});
test.afterAll(async () => {
  await admin?.dispose();
  await sink?.close();
});

// An invitation made as the Admin; resolves to what the mail holds.
async function invite(email: string, role: "member" | "admin" = "member") {
  const before = sink.mails.length;
  const res = await admin.post("/api/v1/invitations", {
    data: { emails: [email], role },
    headers: { "idempotency-key": randomUUID() },
  });
  expect(res.ok(), await res.text()).toBe(true);
  const body = (await res.json()) as {
    results: { invitation: { id: string } }[];
  };
  const mail = await sink.nextMail(email, before);
  return {
    id: body.results[0]!.invitation.id,
    link: joinLinkOf(mail),
    code: codeOf(mail),
  };
}

const codeField = (page: Page) =>
  page.locator('input[autocomplete="one-time-code"]');

async function newPerson(browser: Browser) {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

const posts = (page: Page) => {
  const seen: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST")
      seen.push(`${new URL(request.url()).pathname}`);
  });
  return seen;
};

test("press Join in the mail, enter the code from the mail, land at the address of #general as a member", async ({
  browser,
}) => {
  const alice = await invite("alice@example.com");
  const { context, page } = await newPerson(browser);
  const sent = posts(page);
  const consoleLines: string[] = [];
  page.on("console", (message) => consoleLines.push(message.text()));

  await page.goto(alice.link);
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();
  await expect(page.getByText("alice@example.com")).toBeVisible();
  // On opening: the fragment is gone from the address bar and the history entry, and the wait is on (R26, R29, R43)
  expect(new URL(page.url()).hash).toBe("");
  expect(page.url()).not.toContain(alice.link.split("#")[1]!);
  expect(
    await page.evaluate(() => JSON.stringify(history.state)),
  ).not.toContain(alice.link.split("#")[1]!);
  await expect(
    page.getByRole("button", { name: /^Resend code/ }),
  ).toBeDisabled();
  // Opening sent the lookup and nothing else (R28)
  expect(sent).toEqual(["/api/v1/invitations/lookup"]);

  await codeField(page).fill(alice.code);
  await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);
  const id = new URL(page.url()).pathname.split("/").pop()!;

  // The person is signed in and a member of #general, which is where the address leads (R32, TS-015)
  const me = await page.request.get("/api/v1/auth/session");
  expect(((await me.json()) as { user: { email: string } }).user.email).toBe(
    "alice@example.com",
  );
  const boot = await page.request.get("/api/v1/bootstrap");
  const conversations = (
    (await boot.json()) as { conversations: { id: string }[] }
  ).conversations;
  expect(conversations.map((c) => c.id)).toContain(id);

  // The address and the code are in no storage and not in the address bar after each step (R43)
  const token = alice.link.split("#")[1]!;
  const stored = await page.evaluate(() =>
    JSON.stringify([
      Object.entries(localStorage),
      Object.entries(sessionStorage),
      history.state,
    ]),
  );
  // after the steps the token is in no storage, no history state, no address and no console line (R43)
  expect(stored).not.toContain(token);
  expect(page.url()).not.toContain(token);
  expect(consoleLines.join("\n")).not.toContain(token);
  for (const secret of ["alice@example.com", alice.code]) {
    expect(stored).not.toContain(secret);
    expect(page.url()).not.toContain(secret);
  }
  await context.close();
});

test("a used link opens /login with the address filled in, and the address is not in the address bar", async ({
  browser,
}) => {
  // alice's invitation was used by the case above; its link is in no variable here, so a new person is made
  const bob = await invite("bob@example.com");
  const first = await newPerson(browser);
  await first.page.goto(bob.link);
  await codeField(first.page).fill(bob.code);
  await expect(first.page).toHaveURL(/\/c\//);
  await first.context.close();

  const second = await newPerson(browser);
  await second.page.goto(bob.link);
  await expect(second.page).toHaveURL(/\/login$/);
  await expect(second.page.locator('input[type="email"]')).toHaveValue(
    "bob@example.com",
  );
  expect(second.page.url()).not.toContain("bob");
  await second.context.close();
});

test("a link opened and abandoned leaves nobody signed in, and the code is not sent by opening", async ({
  browser,
}) => {
  const carol = await invite("carol@example.com");
  const { context, page } = await newPerson(browser);
  const sent = posts(page);
  await page.goto(carol.link);
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();
  expect(sent).not.toContain("/api/v1/invitations/sessions");
  // Toki opened again in the same browser: nobody is signed in
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  const me = await page.request.get("/api/v1/auth/session");
  expect(me.status()).toBe(401);
  // and the invitation is still valid
  const lookup = await page.request.post("/api/v1/invitations/lookup", {
    data: { token: carol.link.split("#")[1] },
  });
  expect(((await lookup.json()) as { state: string }).state).toBe("pending");
  await context.close();
});

test("an invitation to another address while signed in asks the question, and 'Stay signed in' keeps the person signed in and the invitation valid", async ({
  browser,
}) => {
  const dave = await invite("dave@example.com");
  const context = await browser.newContext({ storageState: adminCookies });
  const page = await context.newPage();
  const sent = posts(page);
  await page.goto(dave.link);
  await expect(
    page.getByRole("heading", {
      name: `You are signed in as ${ADMIN}. Sign out to continue as dave@example.com?`,
    }),
  ).toBeVisible();
  expect(sent).toEqual(["/api/v1/invitations/lookup"]);
  await page.getByRole("button", { name: "Stay signed in" }).click();
  await expect(page).toHaveURL(/\/$/);
  const me = await page.request.get("/api/v1/auth/session");
  expect(((await me.json()) as { user: { email: string } }).user.email).toBe(
    ADMIN,
  );
  const lookup = await page.request.post("/api/v1/invitations/lookup", {
    data: { token: dave.link.split("#")[1] },
  });
  expect(((await lookup.json()) as { state: string }).state).toBe("pending");
  await context.close();
});

test("an invitation for a deactivated person gives the same account back, in a browser that still holds the old cookie", async ({
  browser,
}) => {
  const first = await invite("erin@example.com");
  const { context, page } = await newPerson(browser);
  await page.goto(first.link);
  await codeField(page).fill(first.code);
  await expect(page).toHaveURL(/\/c\//);
  const before = (await (
    await page.request.get("/api/v1/auth/session")
  ).json()) as {
    user: { id: string; role: string };
  };

  // The Admin deactivates the person, then invites them again as an Admin
  const off = await admin.post(`/api/v1/members/${before.user.id}/deactivate`);
  expect(off.ok(), await off.text()).toBe(true);
  const again = await invite("erin@example.com", "admin");

  // The same browser, with the cookie of the old account: the code step shows, no modal
  await page.goto(again.link);
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(/deactivated/i)).toHaveCount(0);
  await codeField(page).fill(again.code);
  await expect(page).toHaveURL(/\/c\//);
  const after = (await (
    await page.request.get("/api/v1/auth/session")
  ).json()) as {
    user: { id: string; role: string };
  };
  expect(after.user.id).toBe(before.user.id);
  expect(after.user.role).toBe("admin");
  await context.close();
});

test("a revoked link, a garbled link and an address with no fragment show their pages", async ({
  browser,
}) => {
  const frank = await invite("frank@example.com");
  const off = await admin.post(`/api/v1/invitations/${frank.id}/revoke`);
  expect(off.ok(), await off.text()).toBe(true);
  const { context, page } = await newPerson(browser);
  await page.goto(frank.link);
  await expect(
    page.getByRole("heading", { name: "This invitation is no longer valid" }),
  ).toBeVisible();
  await expect(page.getByText("Ask an admin.")).toBeVisible();
  await expect(page.getByRole("button")).toHaveCount(0);

  // Each link is opened as a new document: a fragment-only change of the same page does not load it again,
  // and the token is read when the document loads (R26).
  await page.goto("about:blank");
  await page.goto(`/join#${"x".repeat(43)}`);
  await expect(
    page.getByRole("heading", { name: "This link is not valid" }),
  ).toBeVisible();
  expect(await page.textContent("body")).not.toContain("Test Workspace");

  await page.goto("about:blank");
  await page.goto("/join");
  await expect(
    page.getByRole("heading", { name: "This link is not valid" }),
  ).toBeVisible();
  await context.close();
});
