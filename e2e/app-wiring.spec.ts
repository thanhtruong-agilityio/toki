import { expect, test } from "@playwright/test";

// TOKI-015 R30: `/` shows the shell, and the index page of TOKI-006 (the
// element `app-root`) is drawn inside it. Until TOKI-023 adds the guard the page
// is open without a session; the sample test (e2e/sample.spec.ts) keeps its own
// check of the page's text. When TOKI-033 replaces the index page this check
// keeps its assertion on `shell` and loses `app-root` (concern 21).
test("the root path shows the shell with the app root inside it", async ({
  page,
}) => {
  await page.goto("/");

  const shell = page.getByTestId("shell");
  await expect(shell).toBeVisible();
  await expect(shell.getByTestId("app-root")).toHaveText("Toki");
  // The page is the content of the main area, and the navigation names Home.
  await expect(page.locator(".main").getByTestId("app-root")).toBeVisible();
  await expect(shell.getByRole("navigation", { name: "Main" })).toBeAttached();
  await expect(
    shell.locator('.ni[aria-current="page"]', { hasText: "Home" }),
  ).toBeVisible();
});
