import type { Page } from "@playwright/test";
import { stubBootstrap } from "./bootstrap";

// R42 (TOKI-023): the app opens at `/` only with a session, so a test that opens it and expects the
// app answers `GET /api/v1/auth/session` with a signed-in person. A fake address on example.com.
// Until the server of TOKI-022 can be seeded (TOKI-008), the answer is stubbed in the browser.
export async function stubSignedIn(page: Page): Promise<void> {
  // The layout route loads the workspace (TOKI-033 R32): #general only, unless a test sets its own.
  await stubBootstrap(page);
  await page.route("**/api/v1/auth/session", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "00000000-0000-4000-8000-000000000001",
          email: "ada@example.com",
          displayName: "Ada",
          role: "member",
          language: "en",
        },
      }),
    });
  });
}
