import { expect, test } from "@playwright/test";

// R11: the root page shows "Toki" and logs no error to the browser console.
test("the root page shows Toki and logs no console error", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");

  await expect(page.getByTestId("app-root")).toHaveText("Toki");
  expect(errors).toEqual([]);
});
