import { expect, test } from "@playwright/test";
import { stubBootstrap } from "./support/bootstrap";
import { generalOnly } from "./support/fixtures";
import { stubSignedIn } from "./support/session";

// TOKI-015 R30: `/` shows the shell, and the page is drawn inside its main area. TOKI-033 replaces the
// index page of TOKI-006 (`app-root`) by the conversation #general (R23, R30); this check keeps its
// assertions on the shell. The guard of TOKI-023 shows the app only with a session, so the page opens
// with the signed-in stub (R42) and a bootstrap stub with #general.
test("the root path shows the shell with the conversation page inside it", async ({
  page,
}) => {
  await stubSignedIn(page);
  await stubBootstrap(page, generalOnly());
  await page.goto("/");

  const shell = page.getByTestId("shell");
  await expect(shell).toBeVisible();
  // The page is the content of the main area, and the navigation names Home.
  await expect(
    page.locator(".main").getByTestId("conversation-page"),
  ).toBeVisible();
  await expect(shell.getByRole("navigation", { name: "Main" })).toBeAttached();
  await expect(
    shell.locator('.ni[aria-current="page"]', { hasText: "Home" }),
  ).toBeVisible();
});
