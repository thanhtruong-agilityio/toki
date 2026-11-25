import type { Page, Route } from "@playwright/test";
import { stubBootstrap } from "../../support/bootstrap";
import type { ScreenDecl } from "../../support/parity";

// The smoke screen of the UI parity check (TOKI-109, deviation 3): the app's Admin page against the
// prototype's `admin` section. The two draw different things (Members and Channels against
// Analytics and Automations), so the difference is recorded in known-differences.ts. The
// declaration runs the app side of the pipeline end to end: stubs, clock, appearance, capture.
// The shapes of the answers are those of `stubApi` in e2e/admin.spec.ts; fake addresses only.
const ME = "00000000-0000-4000-8000-0000000000a1";

const person = (
  id: string,
  name: string,
  role: "member" | "admin" = "member",
) => ({
  kind: "account",
  userId: id,
  email: `${name.toLowerCase()}@example.com`,
  displayName: name,
  role,
  status: "active",
  lastActiveAt: "2026-01-03T10:00:00.000Z",
  invitation: null,
});

const json = (route: Route, body: unknown) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

// Answers the three reads of the page and passes every other request to the stub of the
// bootstrap, which was registered before this one.
async function stubAdminApi(page: Page): Promise<void> {
  const members = [
    person(ME, "Lan", "admin"),
    person("u-2", "Minh"),
    person("u-3", "Ann", "admin"),
  ];
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    if (request.method() !== "GET") return route.fallback();
    if (path === "/auth/session") {
      return json(route, {
        user: {
          id: ME,
          email: "lan@example.com",
          displayName: "Lan",
          role: "admin",
          language: "en",
        },
      });
    }
    if (path === "/members") {
      return json(route, {
        members,
        counts: { invited: 0, expired: 0, active: 3, deactivated: 0 },
        activeAdminCount: 2,
        nextCursor: null,
      });
    }
    if (path === "/channels") {
      return json(route, {
        channels: [
          {
            id: "c-1",
            name: "general",
            topic: null,
            isPrivate: false,
            isGeneral: true,
            archived: false,
            memberCount: 3,
            isMember: true,
          },
        ],
        nextCursor: null,
      });
    }
    return route.fallback();
  });
}

export const admin: ScreenDecl = {
  id: "admin",
  section: "admin",
  appRoute: "/admin",
  setup: async (page) => {
    await stubBootstrap(page);
    await stubAdminApi(page);
  },
};
