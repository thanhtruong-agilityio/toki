import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// TOKI-099 R21: the account menu, Sign out and "Signed-in devices" in the browser. The calls of
// `/api/v1/auth/*` are stubbed with `page.route`; nothing else is needed, the shell sends no other call.

const USER = {
  id: "00000000-0000-4000-8000-0000000000aa",
  email: "sam@example.com",
  displayName: "Sam Lê",
  role: "member",
  language: "en",
};
const DEVICES = [
  {
    id: "d-laptop",
    current: true,
    deviceKind: "desktop",
    browser: "chrome",
    lastUsedAt: "2026-11-16T15:00:00Z",
  },
  {
    id: "d-phone",
    current: false,
    deviceKind: "phone",
    browser: "safari",
    lastUsedAt: "2026-11-16T09:00:00Z",
  },
  {
    id: "d-tablet",
    current: false,
    deviceKind: "tablet",
    browser: "firefox",
    lastUsedAt: "2026-11-15T18:30:00Z",
  },
];

type Stub = { requests: string[]; signedIn: () => boolean };

// One stub for a whole browser context: the session is shared by its pages, as the cookie is.
async function stub(context: BrowserContext): Promise<Stub> {
  let signedIn = true;
  const requests: string[] = [];
  await context.route("**/api/v1/auth/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    requests.push(`${request.method()} ${path}`);
    const json = (status: number, body?: unknown) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: body === undefined ? "" : JSON.stringify(body),
      });
    if (!signedIn) {
      return json(401, { error: { code: "unauthenticated", message: "no" } });
    }
    if (path === "/auth/session" && request.method() === "GET") {
      return json(200, { user: USER });
    }
    if (path === "/auth/session" && request.method() === "DELETE") {
      signedIn = false;
      return route.fulfill({ status: 204 });
    }
    if (path === "/auth/sessions" && request.method() === "GET") {
      return json(200, { sessions: DEVICES });
    }
    if (path.startsWith("/auth/sessions") && request.method() === "DELETE") {
      return route.fulfill({ status: 204 });
    }
    return route.fallback();
  });
  // The shell sends no bootstrap call yet (the list of conversations is a later ticket); a call to it
  // would show in `requests` and fail the test of the second tab.
  await context.route("**/api/v1/bootstrap", async (route) => {
    requests.push("GET /bootstrap");
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: "{}",
    });
  });
  return { requests, signedIn: () => signedIn };
}

const LOOKS = ["calm", "focus"] as const;
const WIDTHS = [
  { width: 360, height: 560 },
  { width: 719, height: 800 },
  { width: 720, height: 800 },
  { width: 1099, height: 800 },
  { width: 1100, height: 800 },
];

async function look(page: Page, name: (typeof LOOKS)[number]) {
  await page.emulateMedia({ colorScheme: name === "focus" ? "dark" : "light" });
}

for (const name of LOOKS) {
  test.describe(`the account menu, ${name}`, () => {
    test("Sign out ends on /login with no next and no workspace, and Back shows none", async ({
      page,
      context,
    }) => {
      await stub(context);
      await look(page, name);
      await page.setViewportSize({ width: 1100, height: 800 });
      await page.goto("/");
      await page.getByTestId("shell").waitFor();
      await page.getByRole("button", { name: "Your account menu" }).click();
      const items = page.getByRole("menuitem");
      await expect(items).toHaveText(["Preferences", "Sign out"]);
      // A second history entry, so that Back has an address of the workspace to go to.
      await items.nth(0).click();
      await expect(page).toHaveURL(/\/prefs$/);
      await page.getByRole("button", { name: "Your account menu" }).click();
      await page.getByRole("menuitem", { name: "Sign out" }).click();
      await expect(page).toHaveURL(/\/login$/);
      expect(new URL(page.url()).search).toBe("");
      await expect(page.getByTestId("app-root")).toHaveCount(0);
      await expect(page.getByText("Signed-in devices")).toHaveCount(0);
      await page.goBack();
      // The guard sends the address that Back restored to the sign-in page.
      await expect(page).toHaveURL(/\/login(\?next=[^&]*)?$/);
      await expect(page.getByTestId("app-root")).toHaveCount(0);
    });

    test("a second tab of the browser goes to /login at once, with no request", async ({
      context,
    }) => {
      const state = await stub(context);
      const first = await context.newPage();
      const second = await context.newPage();
      for (const page of [first, second]) {
        await look(page, name);
        await page.setViewportSize({ width: 1100, height: 800 });
        await page.goto("/");
        await page.getByTestId("shell").waitFor();
      }
      const before = state.requests.length;
      await first.getByRole("button", { name: "Your account menu" }).click();
      await first.getByRole("menuitem", { name: "Sign out" }).click();
      await expect(first).toHaveURL(/\/login$/);
      await expect(second).toHaveURL(/\/login$/, { timeout: 2000 });
      // Only the call of the first tab: the second one sent nothing.
      // (The sign-in page asks for the workspace name by itself; that is not a sign-out.)
      expect(
        state.requests.slice(before).filter((r) => r !== "GET /auth/workspace"),
      ).toEqual(["DELETE /auth/session"]);
    });

    for (const width of [720, 1100]) {
      test(`the menu opens at ${width}px with Preferences and Sign out`, async ({
        page,
        context,
      }) => {
        await stub(context);
        await look(page, name);
        await page.setViewportSize({ width, height: 800 });
        await page.goto("/");
        await page.getByTestId("shell").waitFor();
        await page.getByRole("button", { name: "Your account menu" }).click();
        await expect(page.getByRole("menuitem")).toHaveText([
          "Preferences",
          "Sign out",
        ]);
        await page.keyboard.press("Escape");
        await expect(page.getByRole("menu")).toHaveCount(0);
      });
    }

    test("there is no card under 720 px", async ({ page, context }) => {
      await stub(context);
      await look(page, name);
      await page.setViewportSize({ width: 719, height: 800 });
      await page.goto("/");
      await page.getByTestId("shell").waitFor();
      await expect(
        page.getByRole("button", { name: "Your account menu" }),
      ).toBeHidden();
    });

    for (const size of WIDTHS) {
      test(`Signed-in devices at ${size.width}px`, async ({
        page,
        context,
      }) => {
        await stub(context);
        await look(page, name);
        await page.setViewportSize(size);
        await page.goto("/prefs");
        await expect(
          page.getByRole("heading", { level: 2, name: "Signed-in devices" }),
        ).toBeVisible();
        await expect(page.locator(".devrow")).toHaveCount(3);
        await expect(page.getByText("This device")).toHaveCount(1);
        const phone = page.getByRole("button", { name: /^Sign out Safari/ });
        await expect(phone).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Sign out all other devices" }),
        ).toBeVisible();
        // Nothing clipped, no sideways scroll.
        const overflow = await page.evaluate(() => {
          const doc = document.scrollingElement!;
          const vw = document.documentElement.clientWidth;
          const off = [...document.querySelectorAll<HTMLElement>(".devrow *")]
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && (r.left < -0.5 || r.right > vw + 0.5);
            })
            .map((el) => el.className);
          return { wide: doc.scrollWidth > doc.clientWidth, off };
        });
        expect(overflow).toEqual({ wide: false, off: [] });
        if (size.width < 720) {
          for (const button of await page
            .locator(".devrow button, .devfoot button")
            .all()) {
            const box = (await button.boundingBox())!;
            expect(box.height).toBeGreaterThanOrEqual(40);
          }
        }
        // The confirmation for the phone names it.
        await phone.click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toContainText("Sign out this device?");
        await expect(dialog).toContainText("Safari · Phone");
        await dialog.getByRole("button", { name: "Cancel" }).click();
        await expect(dialog).toHaveCount(0);
        // The confirmation for the others counts them.
        await page
          .getByRole("button", { name: "Sign out all other devices" })
          .click();
        await expect(page.getByRole("dialog")).toContainText("2 other devices");
      });
    }
  });
}
