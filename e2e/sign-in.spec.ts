import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  ADDRESS,
  CODE,
  REQUEST_ID,
  TEXT,
  codeAccepted,
  endSession,
  field,
  ok,
  openAppSignedIn,
  refused,
  setDeviceLanguage,
  setLook,
  stubAuth,
  toCodeStep,
  type Language,
  type Look,
  type Script,
} from "./support/sign-in";

// TOKI-023 R29 to R34 in the browser. The calls of `/api/v1/auth/*` are stubbed (support/sign-in.ts):
// the real-server cases wait for TOKI-022 (plan, step 8).

const WIDTHS = [
  { width: 360, height: 560 },
  { width: 719, height: 800 },
  { width: 720, height: 800 },
  { width: 1099, height: 800 },
  { width: 1100, height: 800 },
];
const LOOKS: Look[] = ["calm", "focus"];
const LANGUAGES: Language[] = ["en", "vi"];

// R29: nothing clipped, no sideways scrolling, every control reachable, and under 720 px every control
// at least 40 px tall.
async function expectFits(
  page: Page,
  label: string,
  scope = "#root",
): Promise<void> {
  const width = page.viewportSize()!.width;
  const report = await page.evaluate((scope) => {
    const doc = document.scrollingElement!;
    const vw = document.documentElement.clientWidth;
    const clipped: string[] = [];
    const controls: { name: string; height: number; covered: boolean }[] = [];
    const root = document.querySelector(scope) ?? document.body;
    for (const el of root.querySelectorAll<HTMLElement>("*")) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const tag = `${el.tagName.toLowerCase()}.${el.className}`;
      if (rect.left < -0.5 || rect.right > vw + 0.5) clipped.push(`${tag} off`);
      if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
        const overflow = getComputedStyle(el).overflowX;
        if (overflow !== "visible" || el.tagName !== "BUTTON")
          clipped.push(`${tag} text ${el.scrollWidth}>${el.clientWidth}`);
      }
      if (el.matches("button, input, a[href]")) {
        el.scrollIntoView({ block: "nearest" });
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(
          r.left + r.width / 2,
          r.top + r.height / 2,
        );
        controls.push({
          name: `${tag} "${el.textContent || el.getAttribute("aria-label") || ""}"`,
          height: r.height,
          covered: !(hit === el || el.contains(hit)),
        });
      }
    }
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      clipped,
      controls,
    };
  }, scope);
  expect(report.scrollWidth, `${label}: sideways scroll`).toBeLessThanOrEqual(
    report.clientWidth,
  );
  expect(report.clipped, `${label}: clipped`).toEqual([]);
  expect(report.controls.length, `${label}: controls`).toBeGreaterThan(0);
  for (const c of report.controls) {
    expect(c.covered, `${label}: ${c.name} is reachable`).toBe(false);
    if (width < 720)
      expect(c.height, `${label}: ${c.name} height`).toBeGreaterThanOrEqual(40);
  }
}

// The card of a step with no message must fit the height of 360 × 560 without scrolling (Design:
// Layout at the three widths).
async function expectNoVerticalScroll(page: Page, label: string) {
  const [scroll, client] = await page.evaluate(() => [
    document.scrollingElement!.scrollHeight,
    document.scrollingElement!.clientHeight,
  ]);
  expect(scroll, `${label}: fits the height`).toBeLessThanOrEqual(client);
}

async function open(
  page: Page,
  language: Language,
  look: Look,
  size: { width: number; height: number },
) {
  await page.setViewportSize(size);
  await setLook(page, look);
  await setDeviceLanguage(page, language);
}

async function cleanTab(page: Page) {
  await page.evaluate(() => sessionStorage.clear());
}

// The code step reached the usual way, from the email step.
async function codeStep(page: Page, language: Language) {
  await cleanTab(page);
  await page.goto("/login");
  await toCodeStep(page, language);
}

for (const look of LOOKS) {
  for (const language of LANGUAGES) {
    for (const size of WIDTHS) {
      test.describe(`layout ${size.width}px ${look} ${language}`, () => {
        test("steps, messages and the modal fit", async ({ page }) => {
          const t = TEXT[language];
          const stub = await stubAuth(page);
          await open(page, language, look, size);
          await page.goto("/login");
          const small = size.width < 720;

          // Email step.
          await expect(field(page, "email")).toBeFocused();
          await expectFits(page, "email step");
          if (small) await expectNoVerticalScroll(page, "email step");

          // Email step messages: malformed address, network, general, too many, too soon.
          await field(page, "email").fill("not-an-address");
          await field(page, "email").blur();
          await expect(page.getByText(t.invalid)).toBeVisible();
          await expectFits(page, "email invalid");
          await field(page, "email").fill(ADDRESS);
          const emailCases: [() => ReturnType<Script["codes"]>, string][] = [
            [() => "abort", t.network],
            [() => refused(500, "internal_error"), t.general],
            [
              () =>
                refused(429, "code_request_limit", { retryAfterSeconds: 600 }),
              t.tooMany,
            ],
            [
              () =>
                refused(429, "code_resend_too_soon", { retryAfterSeconds: 30 }),
              t.tooSoon,
            ],
          ];
          for (const [reply, text] of emailCases) {
            stub.script.codes = reply;
            await field(page, "email").fill("");
            await field(page, "email").fill(ADDRESS);
            await page.getByRole("button", { name: t.sendCode }).click();
            await expect(page.getByText(text)).toBeVisible();
            await expectFits(page, `email message ${text}`);
          }

          // Code step.
          stub.script.codes = () => codeAccepted(0);
          await codeStep(page, language);
          await expect(field(page, "code")).toBeFocused();
          await expectFits(page, "code step");
          if (small) await expectNoVerticalScroll(page, "code step");

          const codeCases: [Script["sessions"], string][] = [
            [() => refused(400, "code_incorrect", { triesLeft: 4 }), t.wrong],
            [() => refused(400, "code_locked"), t.locked],
            [() => "abort", t.network],
            [() => refused(500, "internal_error"), t.general],
            [() => refused(400, "code_expired"), t.expired],
          ];
          for (const [reply, text] of codeCases) {
            await codeStep(page, language);
            stub.script.sessions = reply;
            await field(page, "code").fill(CODE);
            await expect(page.getByText(text)).toBeVisible();
            await expectFits(page, `code message ${text}`);
          }
          // The expired state shows 'Send a new code'.
          await expect(
            page.getByRole("button", { name: t.sendNew }),
          ).toBeVisible();

          // Resend answered too many and too soon.
          const resendCases: [Script["codes"], string][] = [
            [
              () =>
                refused(429, "code_request_limit", { retryAfterSeconds: 600 }),
              t.tooMany,
            ],
            [
              () =>
                refused(429, "code_resend_too_soon", { retryAfterSeconds: 30 }),
              t.tooSoon,
            ],
          ];
          for (const [reply, text] of resendCases) {
            stub.script.codes = () => codeAccepted(0);
            await codeStep(page, language);
            stub.script.codes = reply;
            await page.getByRole("button", { name: t.resend }).click();
            await expect(page.getByText(text)).toBeVisible();
            await expectFits(page, `resend message ${text}`);
          }
        });

        test("the session-ended modal fits", async ({ page }) => {
          const t = TEXT[language];
          const stub = await stubAuth(page);
          await open(page, language, look, size);
          await openAppSignedIn(page, stub);
          await endSession(page, stub);
          await expect(page.getByRole("dialog")).toBeVisible();
          await expect(page.getByText(t.ended)).toBeVisible();
          await expectFits(page, "modal", '[role="dialog"]');
        });
      });
    }
  }
}

// R30: the whole flow with the keyboard alone.
test("the whole flow works with the keyboard alone", async ({ page }) => {
  const t = TEXT.en;
  const stub = await stubAuth(page);
  stub.script.sessions = (n) =>
    n === 1
      ? refused(400, "code_incorrect", { triesLeft: 4 })
      : n === 2
        ? "abort"
        : ok({ user: { ...stubUser(), email: ADDRESS } });
  await page.goto("/login");
  const emailField = field(page, "email");
  const codeField = field(page, "code");

  // Email step: focus starts in the field; Tab goes to 'Send code' (disabled until the address is
  // well-formed, so it is skipped); Enter sends.
  await expect(emailField).toBeFocused();
  await page.keyboard.type("not-an-address");
  await page.keyboard.press("Enter");
  expect(stub.count("POST /auth/codes")).toBe(0);
  await emailField.fill(ADDRESS);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: t.sendCode })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(emailField).toBeFocused();
  await page.keyboard.press("Enter");

  // Code step: focus in the code field; Tab order with 5 digits: Resend code, Use a different email
  // ('Sign in' is disabled and skipped).
  await expect(codeField).toBeFocused();
  await page.keyboard.type("12345");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: t.resend })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: t.changeEmail })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(codeField).toBeFocused();

  // The 6th digit sends once; a wrong code keeps the focus in the emptied field.
  // Tab into a text field selects what is in it; End puts the caret after the 5 digits.
  await page.keyboard.press("End");
  await page.keyboard.type("6");
  await expect(page.getByText(t.wrong)).toBeVisible();
  expect(stub.count("POST /auth/sessions")).toBe(1);
  await expect(codeField).toHaveValue("");
  await expect(codeField).toBeFocused();

  // A resend returns the focus to the field.
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: t.resend })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(codeField).toBeFocused();
  expect(stub.count("POST /auth/codes")).toBe(2);

  // A failed connection keeps the 6 digits; Enter sends them again, and the person is in.
  await page.keyboard.type(CODE);
  await expect(page.getByText(t.network)).toBeVisible();
  await expect(codeField).toHaveValue(CODE);
  expect(stub.count("POST /auth/sessions")).toBe(2);
  await codeField.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("shell")).toBeVisible();
  expect(stub.count("POST /auth/sessions")).toBe(3);
});

test("'Use a different email' puts the focus in the email field, and the expired step is in tab order", async ({
  page,
}) => {
  const t = TEXT.en;
  const stub = await stubAuth(page);
  stub.script.sessions = () => refused(400, "code_expired");
  await page.goto("/login");
  await toCodeStep(page, "en");
  await page.keyboard.type(CODE);
  await expect(page.getByText(t.expired)).toBeVisible();
  // Expired: field, 'Send a new code', 'Use a different email' ('Sign in' is disabled, 'Resend code'
  // is not shown).
  await expect(field(page, "code")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: t.sendNew })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: t.changeEmail })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(field(page, "email")).toBeFocused();
  await expect(field(page, "email")).toHaveValue(ADDRESS);
  // The earlier address is selected: typing replaces it.
  await page.keyboard.type("b@example.com");
  await expect(field(page, "email")).toHaveValue("b@example.com");
});

test("the session-ended modal traps Tab, ignores Esc and focuses 'Sign in again'", async ({
  page,
}) => {
  const t = TEXT.en;
  const stub = await stubAuth(page);
  await openAppSignedIn(page, stub);
  await endSession(page, stub);
  const dialog = page.getByRole("dialog");
  const again = page.getByRole("button", { name: t.signInAgain });
  await expect(dialog).toBeVisible();
  await expect(again).toBeFocused();
  for (const key of ["Tab", "Tab", "Shift+Tab", "Shift+Tab", "Tab"]) {
    await page.keyboard.press(key);
    expect(
      await page.evaluate(
        () => document.activeElement?.closest('[role="dialog"]') !== null,
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  // One modal, however many requests are refused (R27).
  await endSession(page, stub);
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await again.focus();
  await page.keyboard.press("Enter");
  // 'Sign in again': the sign-in page, with the person's address filled in and not in the address bar.
  await expect(page).toHaveURL(/\/login\?next=%2F$/);
  await expect(field(page, "email")).toHaveValue(ADDRESS);
  await expect(field(page, "email")).toBeFocused();
  expect(page.url()).not.toContain("example.com");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

// R32: nothing secret in the address bar; the tab record in tab storage and never the code.
test("the address bar and browser storage hold no code, and no address or requestId in the address", async ({
  page,
}) => {
  const t = TEXT.en;
  const stub = await stubAuth(page);
  stub.script.sessions = (n) =>
    n === 1
      ? refused(400, "code_incorrect", { triesLeft: 4 })
      : ok({ user: stubUser() });
  const logs: string[] = [];
  page.on("console", (m) => logs.push(m.text()));
  page.on("pageerror", (e) => logs.push(e.message));

  const check = async (label: string, record: boolean) => {
    const url = page.url();
    for (const secret of [ADDRESS, "example.com", REQUEST_ID, CODE])
      expect(url, `${label}: address bar`).not.toContain(secret);
    const stored = await page.evaluate(() => {
      const all: Record<string, string> = {};
      for (const [name, store] of [
        ["local", localStorage],
        ["session", sessionStorage],
      ] as const)
        for (let i = 0; i < store.length; i++) {
          const key = store.key(i)!;
          all[`${name}:${key}`] = store.getItem(key) ?? "";
        }
      return all;
    });
    const dump = JSON.stringify(stored);
    expect(dump, `${label}: storage`).not.toContain(CODE);
    expect(
      Object.keys(stored).some((k) => k === "session:toki:signIn.code"),
      `${label}: tab record`,
    ).toBe(record);
    if (record) {
      expect(dump).toContain(REQUEST_ID);
      expect(Object.keys(stored).every((k) => k.startsWith("session:"))).toBe(
        true,
      );
    }
    const logged = logs.join("\n");
    for (const secret of [CODE, REQUEST_ID])
      expect(logged, `${label}: console`).not.toContain(secret);
  };

  await page.goto("/login?next=%2F");
  await check("email step", false);
  await field(page, "email").fill(ADDRESS);
  await check("email typed", false);
  await page.getByRole("button", { name: t.sendCode }).click();
  await field(page, "code").waitFor();
  await check("code step", true);
  await field(page, "code").fill(CODE);
  await expect(page.getByText(t.wrong)).toBeVisible();
  await check("wrong code", true);
  await field(page, "code").fill(CODE);
  await expect(page.getByTestId("shell")).toBeVisible();
  await check("signed in", false);
  expect(new URL(page.url()).pathname).toBe("/");
  // The record is gone from storage on sign-in, and the reload with the code step restored is checked
  // by login.test.tsx.
});

// R33: with reduced motion the code field does not shake and the message still shows.
for (const reduced of [true, false]) {
  test(`a wrong code ${reduced ? "does not shake" : "shakes"} the code field with reduced motion ${reduced ? "on" : "off"}`, async ({
    page,
  }) => {
    await page.emulateMedia({
      reducedMotion: reduced ? "reduce" : "no-preference",
    });
    const stub = await stubAuth(page);
    stub.script.sessions = () =>
      refused(400, "code_incorrect", { triesLeft: 4 });
    await page.goto("/login");
    await toCodeStep(page, "en");
    await field(page, "code").fill(CODE);
    await expect(page.getByText(TEXT.en.wrong)).toBeVisible();
    const code = field(page, "code");
    if (reduced) {
      await expect(code).not.toHaveClass(/shake/);
      await expect(code).toHaveCSS("animation-name", "none");
    } else {
      await expect(code).toHaveClass(/shake/);
    }
  });
}

// R31: the facts a screen reader relies on.
test("each message is tied to its field, announced and marks the field invalid", async ({
  page,
}) => {
  const t = TEXT.en;
  const stub = await stubAuth(page);
  stub.script.sessions = () => refused(400, "code_incorrect", { triesLeft: 4 });
  await page.goto("/login");
  const email = field(page, "email");
  await expect(email).toHaveAttribute("autocomplete", "email");
  await expect(email).not.toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel(t.email)).toHaveCount(1);
  await email.fill("not-an-address");
  await email.blur();
  const invalid = page.getByText(t.invalid);
  await expect(invalid).toHaveAttribute("role", "alert");
  await expectTied(email, invalid);

  await email.fill(ADDRESS);
  await page.getByRole("button", { name: t.sendCode }).click();
  const code = field(page, "code");
  await expect(code).toHaveAttribute("inputmode", "numeric");
  await expect(code).toHaveAttribute("autocomplete", "one-time-code");
  await expect(code).toHaveAttribute("maxlength", "6");
  await expect(page.getByLabel(t.code, { exact: true })).toHaveCount(1);
  await expect(code).not.toHaveAttribute("aria-invalid", "true");
  await code.fill(CODE);
  const wrong = page.getByText(t.wrong);
  await expect(wrong).toHaveAttribute("role", "alert");
  await expectTied(code, wrong);
  // A disabled button is announced as unavailable.
  await expect(page.getByRole("button", { name: t.signIn })).toBeDisabled();
});

async function expectTied(control: Locator, message: Locator) {
  const id = await message.getAttribute("id");
  expect(id).toBeTruthy();
  const described = (await control.getAttribute("aria-describedby")) ?? "";
  expect(described.split(" ")).toContain(id);
  await expect(control).toHaveAttribute("aria-invalid", "true");
}

test("the modal is a labelled dialog", async ({ page }) => {
  const stub = await stubAuth(page);
  await openAppSignedIn(page, stub);
  await endSession(page, stub);
  const dialog = page.getByRole("dialog", { name: TEXT.en.ended });
  await expect(dialog).toBeVisible();
});

// R31 automated check, in both looks.
for (const look of LOOKS) {
  test(`no accessibility violations on both steps and the modal in ${look}`, async ({
    page,
  }) => {
    await setLook(page, look);
    const stub = await stubAuth(page);
    stub.script.sessions = () =>
      refused(400, "code_incorrect", { triesLeft: 4 });
    const scan = async (label: string) => {
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        results.violations.map(
          (v) =>
            `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
        ),
        label,
      ).toEqual([]);
    };
    await page.goto("/login");
    await expect(field(page, "email")).toBeFocused();
    await scan("email step");
    await toCodeStep(page, "en");
    await scan("code step");
    await field(page, "code").fill(CODE);
    await expect(page.getByText(TEXT.en.wrong)).toBeVisible();
    await scan("code step with a message");
    await cleanTab(page);
    await page.goto("about:blank");
    await openAppSignedIn(page, stub);
    await endSession(page, stub);
    await expect(page.getByRole("dialog")).toBeVisible();
    await scan("modal");
  });
}

function stubUser() {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    email: ADDRESS,
    displayName: "Ada",
    role: "member",
    language: "en",
  };
}
