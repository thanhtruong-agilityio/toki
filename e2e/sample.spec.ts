import { expect, test } from "@playwright/test";
import { stubBootstrap } from "./support/bootstrap";
import { generalOnly } from "./support/fixtures";
import { stubSignedIn } from "./support/session";

// R11 (TOKI-008), as TOKI-033 R30 changes it: `/` opens the conversation #general, whose page shows
// its name in an `h1`, and no error reaches the browser console. The workspace holds only #general.
test("the root path opens #general and logs no console error", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await stubSignedIn(page);
  await stubBootstrap(page, generalOnly());
  await page.goto("/");

  await expect(
    page.getByTestId("conversation-page").getByRole("heading", { level: 1 }),
  ).toHaveText("general");
  expect(errors).toEqual([]);
});
