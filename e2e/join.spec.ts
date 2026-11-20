import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { expectFits, expectNoVerticalScroll } from "./support/layout";
import {
  USER,
  ok,
  refused,
  setDeviceLanguage,
  setLook,
  stubAuth,
  type Language,
  type Look,
} from "./support/sign-in";

// TOKI-097 R40, R41, R42: the Join page at the five widths, in Calm and Focus, in English and Vietnamese, with
// the keyboard alone and an accessibility check. The calls of `/api/v1/auth/*` and `/api/v1/invitations/*` are
// stubbed here: the flows against the real server are in e2e/real-server/join.spec.ts. Fake data only.
const TOKEN = "Pq4-_".repeat(8) + "abc"; // 43 base64url characters
const WIDTHS = [
  { width: 360, height: 560 },
  { width: 719, height: 800 },
  { width: 720, height: 800 },
  { width: 1099, height: 800 },
  { width: 1100, height: 800 },
];
const LOOKS: Look[] = ["calm", "focus"];
const LANGUAGES: Language[] = ["en", "vi"];

const PENDING = {
  state: "pending",
  email: "sam@example.com",
  workspaceName: "Acme Studio",
  codeExpiresInSeconds: 600,
  resendAfterSeconds: 60,
};

// The texts the tests look for, from packages/i18n (join, signIn).
const TEXT = {
  en: {
    codeTitle: "Check your email",
    expired: "This invitation has expired",
    revoked: "This invitation is no longer valid",
    notFound: "This link is not valid",
    question:
      "You are signed in as ada@example.com. Sign out to continue as sam@example.com?",
    signOut: "Sign out and continue",
    stay: "Stay signed in",
    changeEmail: "Use a different email",
  },
  vi: {
    codeTitle: "Kiểm tra email của bạn",
    expired: "Lời mời này đã hết hạn",
    revoked: "Lời mời này không còn hiệu lực",
    notFound: "Liên kết này không hợp lệ",
    question:
      "Bạn đang đăng nhập với ada@example.com. Đăng xuất để tiếp tục với sam@example.com?",
    signOut: "Đăng xuất và tiếp tục",
    stay: "Giữ đăng nhập",
    changeEmail: "Dùng email khác",
  },
} as const;

async function openJoin(
  page: Page,
  options: {
    language: Language;
    look: Look;
    size: { width: number; height: number };
    lookup: unknown;
    signedIn?: boolean;
  },
) {
  await page.setViewportSize(options.size);
  await setLook(page, options.look);
  await setDeviceLanguage(page, options.language);
  await stubAuth(page, {
    session: () =>
      options.signedIn ? ok({ user: USER }) : refused(401, "unauthenticated"),
  });
  await page.route("**/api/v1/invitations/lookup", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(options.lookup),
    }),
  );
  await page.goto(`/join#${TOKEN}`);
}

// The same rules as the sign-in page checks: the WCAG levels, not the best-practice landmarks.
async function expectAccessible(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
    ),
    `${label}: accessibility`,
  ).toEqual([]);
}

for (const look of LOOKS) {
  for (const language of LANGUAGES) {
    for (const size of WIDTHS) {
      test.describe(`join layout ${size.width}px ${look} ${language}`, () => {
        const base = { language, look, size };
        const t = TEXT[language];
        const small = size.width < 720;

        test("the code step fits, starts in the field and has no fragment left", async ({
          page,
        }) => {
          await openJoin(page, { ...base, lookup: PENDING });
          await expect(
            page.getByRole("heading", { name: t.codeTitle }),
          ).toBeVisible();
          await expect(
            page.locator('input[autocomplete="one-time-code"]'),
          ).toBeFocused();
          expect(new URL(page.url()).hash).toBe("");
          await expectFits(page, "code step");
          if (small) await expectNoVerticalScroll(page, "code step");
          await expectAccessible(page, "code step");
        });

        for (const [name, lookup, title] of [
          [
            "expired",
            { state: "expired", workspaceName: "Acme Studio" },
            t.expired,
          ],
          [
            "revoked",
            { state: "revoked", workspaceName: "Acme Studio" },
            t.revoked,
          ],
          ["not recognised", { state: "unknown" }, t.notFound],
        ] as const) {
          test(`the ${name} page fits, has the focus on its heading and nothing to press`, async ({
            page,
          }) => {
            await openJoin(page, { ...base, lookup });
            const heading = page.getByRole("heading", { name: title });
            await expect(heading).toBeVisible();
            await expect(heading).toBeFocused();
            await expectFits(page, `${name} page`, "#root", {
              noControls: true,
            });
            if (small) await expectNoVerticalScroll(page, `${name} page`);
            await expect(page.getByRole("button")).toHaveCount(0);
            await expect(page.locator("input")).toHaveCount(0);
            await expectAccessible(page, `${name} page`);
          });
        }

        test("the question fits, and the keyboard alone reaches both buttons in order", async ({
          page,
        }) => {
          await openJoin(page, { ...base, lookup: PENDING, signedIn: true });
          const heading = page.getByRole("heading", { name: t.question });
          await expect(heading).toBeVisible();
          await expect(heading).toBeFocused();
          await expectFits(page, "question");
          if (small) await expectNoVerticalScroll(page, "question");
          await page.keyboard.press("Tab");
          await expect(
            page.getByRole("button", { name: t.signOut }),
          ).toBeFocused();
          await page.keyboard.press("Tab");
          await expect(
            page.getByRole("button", { name: t.stay }),
          ).toBeFocused();
          await expectAccessible(page, "question");
        });
      });
    }
  }
}

test.describe("the keyboard alone (R41)", () => {
  const base = {
    language: "en" as Language,
    look: "calm" as Look,
    size: WIDTHS[3]!,
  };

  test("'Stay signed in' by Enter leaves for the app and sends no code request", async ({
    page,
  }) => {
    await openJoin(page, { ...base, lookup: PENDING, signedIn: true });
    // the focus starts on the heading: wait for it before the first Tab
    await expect(
      page.getByRole("heading", { name: TEXT.en.question }),
    ).toBeFocused();
    const posts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST")
        posts.push(new URL(request.url()).pathname);
    });
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: TEXT.en.stay }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/$/);
    expect(posts).toEqual([]);
  });

  test("a disabled 'Resend code' is skipped by Tab", async ({ page }) => {
    await openJoin(page, { ...base, lookup: PENDING });
    await expect(
      page.getByRole("button", { name: /^Resend code/ }),
    ).toBeDisabled();
    await expect(
      page.locator('input[autocomplete="one-time-code"]'),
    ).toBeFocused();
    const stops: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      await page.keyboard.press("Tab");
      stops.push(
        await page.evaluate(() => {
          const el = document.activeElement;
          if (!el) return "none";
          return el.matches("button, input")
            ? `${el.tagName}:${(el.textContent ?? "").trim()}`
            : el.tagName;
        }),
      );
    }
    // from the field: 'Sign in' is disabled too, so the next stop is the link; 'Resend code' is never one
    expect(stops).not.toContain("BUTTON:Resend code");
    expect(stops[0]).toBe("BUTTON:Use a different email");
  });
});
