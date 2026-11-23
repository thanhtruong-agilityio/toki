import type { Page } from "@playwright/test";
import { generalOnly, type Workspace } from "./fixtures";

// The signed-in app calls `GET /api/v1/bootstrap` when its layout mounts (TOKI-033 R32). Without a
// stub it reaches the real server, gets a 401, and the session-ended modal covers the page. So
// `stubSignedIn` and `stubAuth` install this one themselves; a test that wants another workspace
// calls it again (the last route registered answers first). `body` may be a function, to answer a
// refresh differently.
export async function stubBootstrap(
  page: Page,
  body: Workspace | (() => Workspace) = generalOnly,
): Promise<void> {
  const current = (): Workspace => (typeof body === "function" ? body() : body);
  await page.route("**/api/v1/bootstrap", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(current()),
    });
  });
  // The open conversation's header reads `GET /api/v1/channels/{id}` (TOKI-035 R7); without a stub
  // it reaches the real server and the 401 ends the session. The answer is the detail of the
  // channel the workspace holds under that id (404 for any other id).
  await page.route(/\/api\/v1\/channels\/[^/?]+$/, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const id = decodeURIComponent(
      new URL(route.request().url()).pathname.split("/").pop() ?? "",
    );
    const workspace = current();
    const entry = workspace.conversations.find(
      (c) => c.kind === "channel" && c.id === id,
    );
    if (entry === undefined) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "not_found", message: "Not found" },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        channel: {
          id: entry.id,
          name: entry.name ?? "",
          topic: entry.topic,
          isPrivate: entry.isPrivate,
          isGeneral: entry.isGeneral,
          archived: false,
          memberCount: workspace.members.length,
          isMember: true,
          description: null,
          createdBy: workspace.user.id,
          createdAt: "2025-01-08T09:00:00.000Z",
        },
      }),
    });
  });
}
