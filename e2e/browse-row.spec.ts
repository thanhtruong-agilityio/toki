import { expect, test, type Page } from "@playwright/test";
import { LAUNCH, stubWorld } from "./support/prototype-world";

// TOKI-140 R1: a row of Browse channels shows its member count however long the topic is: only the
// topic is cut, with an ellipsis, and the line stays one line. The app is shown on the prototype's
// sample workspace (e2e/support/prototype-world.ts); fake data only.
const TOPIC =
  "Everything for the 1.0 launch: checklist, builds, announcement. ".repeat(4); // 252 characters

// The list of Browse channels, answered with one channel whose topic is long. The route is
// registered after `stubWorld`, so it answers first; the detail of a channel is another address.
async function longTopic(page: Page): Promise<void> {
  await page.route(/\/api\/v1\/channels(\?.*)?$/, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        channels: [
          {
            id: LAUNCH,
            name: "project-launch",
            topic: TOPIC,
            isPrivate: false,
            isGeneral: false,
            archived: false,
            memberCount: 8,
            isMember: true,
          },
        ],
        nextCursor: null,
      }),
    });
  });
}

// The end of the last text of the line is inside the box of the line, so nothing of it is cut, and
// the line is one line high.
async function check(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Browse channels" });
  const line = dialog.locator(".prow .sub").first();
  await expect(line).toBeVisible();
  return line.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let last: Node | null = null;
    while (walker.nextNode()) last = walker.currentNode;
    if (last === null) throw new Error("the line has no text");
    const range = document.createRange();
    range.selectNodeContents(last);
    const text = range.getBoundingClientRect();
    return {
      text: last.textContent,
      textRight: text.right,
      boxRight: box.right,
      height: box.height,
    };
  });
}

for (const [name, width, height] of [
  ["1280", 1280, 800],
  ["360", 360, 800],
] as const) {
  test(`at ${name} px the member count of a row with a long topic is not cut`, async ({
    page,
  }) => {
    await stubWorld(page);
    await longTopic(page);
    await page.setViewportSize({ width, height });
    // A wide window opens a conversation; a narrow one shows the list at Home.
    await page.goto(width >= 720 ? `/c/${LAUNCH}` : "/");
    await page.getByRole("button", { name: "Browse channels" }).first().click();
    const line = await check(page);
    expect(line.text).toContain("8 members");
    expect(line.textRight).toBeLessThanOrEqual(line.boxRight + 0.5);
    expect(line.height).toBeLessThan(24);
  });
}
