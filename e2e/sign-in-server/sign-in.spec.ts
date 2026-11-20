import { request as playwrightRequest, type Page } from "@playwright/test";
import { openE2eDb, type E2eDb } from "../../apps/server/tests/e2e-sign-in-db";
import {
  ADMIN_EMAIL,
  DATABASE_NAME,
  DATABASE_URL,
  DEACTIVATED_EMAIL,
  WEB_PORT,
  WORKSPACE_NAME,
  codeFromMail,
  expect,
  mailCount,
  newAddress,
  signInByApi,
  test,
  wrongCode,
} from "../support/real-server";
import { TEXT, field } from "../support/sign-in";

// TOKI-023, the end-to-end cases of the spec's Testing, against the real server, a seeded database and
// Mailpit (playwright.sign-in.config.ts). No clock is moved: every case that depends on time is a
// component test. Each test makes its own member and its own network address, so no limit of the server
// (per address, per network address) reaches another test. Fake addresses only; every code is read from
// the mail.
const t = TEXT.en;
const SKIP = process.env.E2E_SIGN_IN_SKIP ?? "";
test.skip(SKIP !== "", SKIP);

let db: E2eDb;
test.beforeAll(() => {
  const url = new URL(DATABASE_URL);
  url.pathname = `/${DATABASE_NAME}`;
  db = openE2eDb(url.toString());
});
test.afterAll(async () => {
  await db?.close();
});

const DEEP = "/c/9001?view=thread";

async function member(label: string): Promise<string> {
  const address = newAddress(label);
  await db.addMember(address);
  return address;
}

// The email step to the code step, the way a person does it.
async function requestCode(page: Page, address: string): Promise<void> {
  await field(page, "email").fill(address);
  await page.getByRole("button", { name: t.sendCode }).click();
  await expect(page.getByRole("heading", { name: t.codeTitle })).toBeVisible();
  await expect(field(page, "code")).toBeFocused();
}

// A request the app makes while a screen shows: the call of the session read, through the same module
// and the same 401 hook the app uses (apps/web/src/auth/services.ts).
async function triggerRequest(page: Page): Promise<void> {
  await page.evaluate(async (url) => {
    const services = (await import(/* @vite-ignore */ url)) as {
      getAuthServices(): { calls: { readSession(): Promise<unknown> } };
    };
    await services.getAuthServices().calls.readSession();
  }, "/src/auth/services.ts");
}

async function cookieValue(page: Page): Promise<string> {
  const cookie = (await page.context().cookies()).find(
    (c) => c.name === "toki_session",
  );
  expect(cookie, "the browser holds the session cookie").toBeDefined();
  return cookie!.value;
}

async function expectApp(page: Page): Promise<void> {
  await expect(page.getByTestId("shell")).toBeVisible();
  await expect(field(page, "email")).toHaveCount(0);
}

test("an active member signs in with the code from the mail and the app opens (TS-001)", async ({
  page,
}) => {
  const address = await member("sign-in");
  await page.goto("/");
  // R1: no session, so the sign-in page, with the workspace name and no app content.
  await expect(page).toHaveURL(/\/login\?next=%2F$/);
  await expect(page.getByText(WORKSPACE_NAME)).toBeVisible();
  await expect(page.getByTestId("shell")).toHaveCount(0);
  // R4: one email field and 'Send code'; no password field.
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: t.sendCode })).toBeDisabled();

  await requestCode(page, address);
  await expect(page.getByText(address)).toBeVisible();
  const code = await codeFromMail(address);
  await field(page, "code").fill(code);
  // R10, R11: the sixth digit sends the code and the app opens at `/`, with no step between.
  await expectApp(page);
  await expect(page).toHaveURL(/\/$/);
  const me = await page.request.get("/api/v1/auth/session");
  expect(me.status()).toBe(200);
  expect(((await me.json()) as { user: { email: string } }).user.email).toBe(
    address,
  );
  // The cookie is the server's, HttpOnly; the code is in no address.
  const cookie = (await page.context().cookies()).find(
    (c) => c.name === "toki_session",
  );
  expect(cookie?.httpOnly).toBe(true);
  expect(page.url()).not.toContain(code);
});

test("an address that is not a member reaches the same step and gets no mail", async ({
  page,
}) => {
  const stranger = newAddress("stranger");
  const control = await member("control");
  await page.goto("/login");
  await requestCode(page, stranger);
  // The same step as a member sees (R7): the heading, the address, the field, 'Resend code'.
  await expect(page.getByText(stranger)).toBeVisible();
  await expect(page.getByText("The code works for 10 minutes")).toBeVisible();
  await expect(page.getByRole("button", { name: t.resend })).toBeVisible();
  // The mail is sent after the answer: a mail to a member, asked for next, is in Mailpit before any
  // mail to the stranger could be, and the stranger has none.
  await page.getByRole("button", { name: t.changeEmail }).click();
  await requestCode(page, control);
  await codeFromMail(control);
  expect(await mailCount(stranger)).toBe(0);
});

test("five wrong codes lock the code and the right one is refused as locked (TS-006)", async ({
  page,
}) => {
  const address = await member("locked");
  await page.goto("/login");
  await requestCode(page, address);
  const code = await codeFromMail(address);
  const wrong = wrongCode(code);
  const message = (left: number) =>
    `That code is not right. ${left} ${left === 1 ? "try" : "tries"} left.`;
  for (const left of [4, 3, 2, 1]) {
    await field(page, "code").fill(wrong);
    await expect(page.getByText(message(left))).toBeVisible();
    // R16: the field is emptied and keeps the focus.
    await expect(field(page, "code")).toHaveValue("");
    await expect(field(page, "code")).toBeFocused();
  }
  await field(page, "code").fill(wrong);
  await expect(page.getByText(t.locked)).toBeVisible();
  // R17: the field stays enabled; the right code is refused with the same message.
  await expect(field(page, "code")).toBeEnabled();
  await field(page, "code").fill(code);
  await expect(page.getByText(t.locked)).toBeVisible();
  await expect(page.getByTestId("shell")).toHaveCount(0);
  const me = await page.request.get("/api/v1/auth/session");
  expect(me.status()).toBe(401);
});

test("a deactivated member from the seed is told so after the right code and the app does not open (R20)", async ({
  page,
}) => {
  // The seeded address is the same in every run and Mailpit keeps the mail of the runs before: wait
  // for one more than it holds now.
  const before = await mailCount(DEACTIVATED_EMAIL);
  await page.goto("/login");
  await requestCode(page, DEACTIVATED_EMAIL);
  const code = await codeFromMail(DEACTIVATED_EMAIL, before + 1);
  await field(page, "code").fill(code);
  await expect(
    page.getByText("This account has been deactivated. Contact an admin."),
  ).toBeVisible();
  await expect(page.getByTestId("shell")).toHaveCount(0);
  await expect(field(page, "code")).toBeEnabled();
  expect((await page.request.get("/api/v1/auth/session")).status()).toBe(401);
});

test("with the network switched off 'Send code' says so, keeps the address, and works again online (R21)", async ({
  page,
  context,
}) => {
  const address = await member("offline");
  await page.goto("/login");
  await field(page, "email").fill(address);
  await context.setOffline(true);
  await page.getByRole("button", { name: t.sendCode }).click();
  await expect(page.getByText(t.network)).toBeVisible();
  await expect(field(page, "email")).toHaveValue(address);
  await expect(page.getByRole("button", { name: t.sendCode })).toBeEnabled();
  await context.setOffline(false);
  await page.getByRole("button", { name: t.sendCode }).click();
  await expect(page.getByRole("heading", { name: t.codeTitle })).toBeVisible();
});

test("a deep address opened without a session leads to sign-in and lands on it after (R1, R3, TS-011)", async ({
  page,
}) => {
  const address = await member("deep");
  await page.goto(DEEP);
  await expect(page).toHaveURL(
    `http://127.0.0.1:${WEB_PORT}/login?next=${encodeURIComponent(DEEP)}`,
  );
  await requestCode(page, address);
  await field(page, "code").fill(await codeFromMail(address));
  await expect(page).toHaveURL(`http://127.0.0.1:${WEB_PORT}${DEEP}`);
  await expect(field(page, "code")).toHaveCount(0);
  // The address of the app holds no email and no code.
  expect(page.url()).not.toContain("example.com");
});

test("with a session, /login and a deep address show the app and not the sign-in page (R2)", async ({
  page,
  ip,
}) => {
  await signInByApi(page, ip, await member("session"));
  await page.goto("/login");
  await expectApp(page);
  await expect(page).toHaveURL(/\/$/);
  // A deep address stays where it is; the sign-in page is not shown. (No screen has the route yet: the
  // app answers with its own not-found view.)
  await page.goto(DEEP);
  await expect(field(page, "email")).toHaveCount(0);
  await expect(page).toHaveURL(`http://127.0.0.1:${WEB_PORT}${DEEP}`);
  await expect(page.getByText("Page not found")).toBeVisible();
  // `/login?next=` with a session goes to `next` (R3).
  await page.goto(`/login?next=${encodeURIComponent("/")}`);
  await expectApp(page);
});

test("reloading on the code step shows it again, and the code from the mail signs in (R15, R35)", async ({
  page,
}) => {
  const address = await member("reload");
  await page.goto("/login");
  await requestCode(page, address);
  const code = await codeFromMail(address);
  await page.reload();
  await expect(page.getByRole("heading", { name: t.codeTitle })).toBeVisible();
  await expect(page.getByText(address)).toBeVisible();
  // The remaining wait of 'Resend code' shows, not a fresh one of the full length.
  await expect(page.getByRole("button", { name: t.resend })).toBeDisabled();
  await field(page, "code").fill(code);
  await expectApp(page);
  // The record of the tab is gone after sign-in.
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
});

test.describe("session ended", () => {
  // The cookie value the browser holds, used from outside the browser: a sign-out request that ends
  // the session on the server.
  async function signOutFromOutside(page: Page, value: string) {
    const outside = await playwrightRequest.newContext({
      baseURL: `http://127.0.0.1:${WEB_PORT}`,
    });
    try {
      const response = await outside.delete("/api/v1/auth/session", {
        headers: { cookie: `toki_session=${value}` },
      });
      expect(response.status()).toBe(204);
    } finally {
      await outside.dispose();
    }
    expect(page.url()).toContain(DEEP.split("?")[0]!);
  }

  async function expectCover(page: Page, text: string) {
    const dialog = page.getByRole("dialog", { name: text });
    await expect(dialog).toBeVisible();
    // R24: nothing behind it can be reached; Tab stays in the dialog, Esc closes nothing.
    for (const key of ["Tab", "Shift+Tab", "Tab"]) {
      await page.keyboard.press(key);
      expect(
        await page.evaluate(
          () => document.activeElement?.closest('[role="dialog"]') !== null,
        ),
      ).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    return dialog;
  }

  test("the session ended by a sign-out from outside shows the modal; 'Sign in again' lands on the same address (R24, R25, R27)", async ({
    page,
    ip,
  }) => {
    const address = await member("ended");
    await signInByApi(page, ip, address);
    await page.goto(DEEP);
    await expect(page.getByText("Page not found")).toBeVisible();
    await signOutFromOutside(page, await cookieValue(page));

    await triggerRequest(page);
    await expectCover(page, t.ended);
    await expect(
      page.getByRole("button", { name: t.signInAgain }),
    ).toBeFocused();
    // R27: another refused request changes nothing, one modal.
    await triggerRequest(page);
    await expect(page.getByRole("dialog")).toHaveCount(1);

    await page.getByRole("button", { name: t.signInAgain }).click();
    await expect(page).toHaveURL(
      `http://127.0.0.1:${WEB_PORT}/login?next=${encodeURIComponent(DEEP)}`,
    );
    // R25: the person's address is filled in, and is not in the address bar.
    await expect(field(page, "email")).toHaveValue(address);
    expect(page.url()).not.toContain("example.com");
    await db.skipResendWait(address);
    await page.getByRole("button", { name: t.sendCode }).click();
    await expect(field(page, "code")).toBeFocused();
    await field(page, "code").fill(await codeFromMail(address, 2));
    await expect(page).toHaveURL(`http://127.0.0.1:${WEB_PORT}${DEEP}`);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("with the cookie removed the server answers unauthenticated and the modal shows (R24)", async ({
    page,
    ip,
  }) => {
    const address = await member("nocookie");
    await signInByApi(page, ip, address);
    await page.goto(DEEP);
    await expect(page.getByText("Page not found")).toBeVisible();
    await page.context().clearCookies();
    await triggerRequest(page);
    await expectCover(page, t.ended);
    await page.getByRole("button", { name: t.signInAgain }).click();
    await expect(page).toHaveURL(
      `http://127.0.0.1:${WEB_PORT}/login?next=${encodeURIComponent(DEEP)}`,
    );
    await expect(field(page, "email")).toHaveValue(address);
  });

  test("an account set to Deactivated while the app is open shows the deactivated modal with no button (R26)", async ({
    page,
    ip,
  }) => {
    const address = await member("gone-open");
    await signInByApi(page, ip, address);
    await page.goto(DEEP);
    await expect(page.getByText("Page not found")).toBeVisible();
    await db.deactivate(address);
    await triggerRequest(page);
    await expectCover(page, "This account has been deactivated");
    await expect(page.getByRole("dialog").getByRole("button")).toHaveCount(0);
    await expect(page.getByRole("dialog").getByRole("link")).toHaveCount(0);
    await expect(
      page.getByRole("dialog").getByText("Use a different email"),
    ).toHaveCount(0);
  });

  test("opening Toki with the cookie of a Deactivated account shows the modal with one link to /login (R26)", async ({
    page,
    ip,
  }) => {
    const address = await member("gone-opened");
    await signInByApi(page, ip, address);
    await db.deactivate(address);
    await page.goto(DEEP);
    const dialog = await expectCover(page, "This account has been deactivated");
    // The one control is 'Use a different email' (a Button of the variant link): no 'Sign in again'.
    await expect(dialog.getByRole("button")).toHaveCount(1);
    await expect(
      dialog.getByRole("button", { name: t.signInAgain }),
    ).toHaveCount(0);
    await dialog.getByRole("button", { name: t.changeEmail }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(field(page, "email")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test("the first Admin of the seed can sign in", async ({ page }) => {
  const before = await mailCount(ADMIN_EMAIL);
  await page.goto("/login");
  await requestCode(page, ADMIN_EMAIL);
  await field(page, "code").fill(await codeFromMail(ADMIN_EMAIL, before + 1));
  await expectApp(page);
});
