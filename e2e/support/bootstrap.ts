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
  await page.route("**/api/v1/bootstrap", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(typeof body === "function" ? body() : body),
    });
  });
}
