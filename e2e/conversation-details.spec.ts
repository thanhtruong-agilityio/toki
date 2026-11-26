import { expect, test, type Page } from "@playwright/test";
import { LAUNCH, stubWorld } from "./support/prototype-world";

// TOKI-139 R4: the headings of the Details panel have 18 px above them (the prototype's `.sb h3`
// margin), with or without a button in the section above. The second case is made on the headings
// Notifications and Settings, where no button is above: an archived channel draws its own page and
// not the panel, so it cannot stand for a panel without the button Edit. The app is shown on the
// prototype's sample workspace (e2e/support/prototype-world.ts); fake data only.
const SPACE = 18;

async function open(page: Page, id: string): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/c/${id}?panel=details`);
  await expect(page.getByRole("heading", { name: /^Members/ })).toBeVisible();
}

// The distance, in px, from the bottom of `above` to the top of `below`.
async function gap(
  above: ReturnType<Page["locator"]>,
  below: ReturnType<Page["locator"]>,
) {
  const a = await above.boundingBox();
  const b = await below.boundingBox();
  if (a === null || b === null) throw new Error("an element has no box");
  return b.y - (a.y + a.height);
}

test("the button Edit is at least 18 px above the heading Members", async ({
  page,
}) => {
  await stubWorld(page);
  await open(page, LAUNCH);
  const edit = page.getByRole("button", { name: "Edit" });
  await expect(edit).toBeVisible();
  expect(
    await gap(edit, page.getByRole("heading", { name: /^Members/ })),
  ).toBeGreaterThanOrEqual(SPACE);
});

test("the headings Notifications and Settings, with no button above, have 18 px above them", async ({
  page,
}) => {
  await stubWorld(page);
  await open(page, LAUNCH);
  // The rows of the members end the section; Notifications and Settings start the next ones.
  for (const name of [/^Notifications/, /^Settings/]) {
    const heading = page.getByRole("heading", { name });
    await heading.scrollIntoViewIfNeeded();
    const section = heading.locator("xpath=..");
    const before = section.locator("xpath=preceding-sibling::section[1]");
    const a = await before.boundingBox();
    const b = await section.boundingBox();
    if (a === null || b === null) throw new Error("a section has no box");
    expect(b.y - (a.y + a.height)).toBeGreaterThanOrEqual(SPACE);
  }
});
