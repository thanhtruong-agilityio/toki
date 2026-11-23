import { expect, test, type Page } from "@playwright/test";
import { stubBootstrap } from "./support/bootstrap";
import { twelve, uuid, type Workspace } from "./support/fixtures";
import { stubSignedIn } from "./support/session";
import { setLook, type Look } from "./support/sign-in";

// TOKI-101 R21: the archived channel page and the Restore button in a real browser, with the
// network answers stubbed with `page.route`. An archived channel the person belongs to is not in the
// workspace's list; `GET /api/v1/channels/{id}` answers its detail.

const OLD = uuid(190);

const archivedDetail = (over: Record<string, unknown> = {}) => ({
  id: OLD,
  name: "old-project",
  topic: "Closed in Q3",
  isPrivate: false,
  isGeneral: false,
  archived: true,
  memberCount: 4,
  isMember: true,
  description: null,
  createdBy: uuid(1),
  createdAt: "2025-01-08T09:00:00.000Z",
  ...over,
});

async function open(
  page: Page,
  options: {
    width: number;
    height: number;
    look?: Look;
    role?: "admin" | "member";
    path?: string;
  },
) {
  const workspace: Workspace = twelve();
  workspace.user = { ...workspace.user, role: options.role ?? "member" };
  await stubSignedIn(page);
  await stubBootstrap(page, workspace);
  // Registered after the bootstrap stub, so it answers first for the archived id.
  await page.route(/\/api\/v1\/channels\/[^/?]+$/, async (route) => {
    const id = decodeURIComponent(
      new URL(route.request().url()).pathname.split("/").pop() ?? "",
    );
    if (route.request().method() !== "GET" || id !== OLD)
      return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ channel: archivedDetail() }),
    });
  });
  await setLook(page, options.look ?? "calm");
  await page.setViewportSize({ width: options.width, height: options.height });
  await page.goto(options.path ?? `/c/${OLD}`);
}

test("at 360 px the page shows the name, the label and the notice inside the viewport", async ({
  page,
}) => {
  await open(page, { width: 360, height: 560 });
  const archived = page.getByTestId("archived-channel-page");
  await expect(archived.getByRole("heading", { level: 1 })).toContainText(
    "old-project",
  );
  await expect(archived.locator(".tag")).toHaveText(/archived/i);
  const notice = archived.getByRole("status");
  await expect(notice).toHaveText("This channel has been archived");
  const box = (await notice.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(360);
  expect(box.y + box.height).toBeLessThanOrEqual(560);
  await expect(
    archived.locator("textarea, form, [contenteditable]"),
  ).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe(`/c/${OLD}`);
});

test("in the Focus look at 1100 px the notice's left edge is 16 px from the page's edge", async ({
  page,
}) => {
  await open(page, { width: 1100, height: 800, look: "focus" });
  const archived = page.getByTestId("archived-channel-page");
  const notice = archived.getByRole("status");
  await expect(notice).toBeVisible();
  const [pageBox, noticeBox] = await Promise.all([
    archived.boundingBox(),
    notice.boundingBox(),
  ]);
  expect(noticeBox!.x - pageBox!.x).toBeCloseTo(16, 0);
});

test("at 360 px a Restore button in Browse channels is at least 40 px tall", async ({
  page,
}) => {
  await open(page, { width: 360, height: 560, role: "admin", path: "/" });
  await page.route(/\/api\/v1\/channels(\?.*)?$/, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        channels: [
          {
            id: OLD,
            name: "old-project",
            topic: null,
            isPrivate: false,
            isGeneral: false,
            archived: true,
            memberCount: 4,
            isMember: false,
          },
        ],
        nextCursor: null,
      }),
    });
  });
  await page.getByTestId("shell").waitFor();
  await page.getByRole("button", { name: "Browse channels" }).first().click();
  const restore = page.getByRole("button", { name: "Restore #old-project" });
  await expect(restore).toBeVisible();
  const box = (await restore.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(40);
});
