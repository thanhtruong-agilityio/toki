import { expect, test } from "@playwright/test";
import { setLook, type Look, type Scheme } from "./support/sign-in";

// TOKI-143 R12: after `setLook` and a load, the root element has the look and the scheme that were
// asked for, although the app's own call sets Calm in the scheme of the device.
const cases: Array<[Look, Scheme | undefined, Look, Scheme]> = [
  ["calm", undefined, "calm", "light"],
  ["focus", undefined, "focus", "dark"],
  ["classic", undefined, "classic", "dark"],
  ["focus", "light", "focus", "light"],
  ["calm", "dark", "calm", "dark"],
];

for (const [look, scheme, wantLook, wantScheme] of cases) {
  test(`setLook(${look}, ${scheme ?? "default"}) gives ${wantLook} and ${wantScheme}`, async ({
    page,
  }) => {
    await setLook(page, look, scheme);
    await page.goto("/login");
    const root = page.locator("html");
    await expect(root).toHaveAttribute("data-look", wantLook);
    await expect(root).toHaveAttribute("data-scheme", wantScheme);
  });
}

test("setLook keeps the look when the page changes it", async ({ page }) => {
  await setLook(page, "focus");
  await page.goto("/login");
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-look", "calm");
    document.documentElement.setAttribute("data-scheme", "light");
  });
  const root = page.locator("html");
  await expect(root).toHaveAttribute("data-look", "focus");
  await expect(root).toHaveAttribute("data-scheme", "dark");
});
