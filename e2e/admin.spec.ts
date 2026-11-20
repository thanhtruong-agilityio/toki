import { expect, test, type Page, type Route } from "@playwright/test";

// TOKI-025: the Admin page in a real browser, with the server's answers stubbed (the real-server
// variant of this flow needs a Postgres and a mail layer: see the pull request). Fake addresses only.
const ME = "00000000-0000-4000-8000-0000000000a1";

type Row = {
  kind: "account" | "invitation";
  userId: string | null;
  email: string;
  displayName: string | null;
  role: "member" | "admin";
  status: "active" | "deactivated" | "invited" | "expired";
  lastActiveAt: string | null;
  invitation: unknown;
};

const person = (
  id: string,
  name: string,
  role: "member" | "admin" = "member",
): Row => ({
  kind: "account",
  userId: id,
  email: `${name.toLowerCase()}@example.com`,
  displayName: name,
  role,
  status: "active",
  lastActiveAt: "2026-01-03T10:00:00.000Z",
  invitation: null,
});

const invitationOf = (id: string, mailStatus: "sent" | "failed") => ({
  id,
  role: "member",
  state: "pending",
  mailStatus,
  invitedBy: { id: ME, displayName: "Lan" },
  createdAt: "2026-01-02T03:04:05.000Z",
  sentAt: "2026-01-02T03:04:06.000Z",
  expiresAt: "2026-01-09T03:04:05.000Z",
});

const invite = (
  email: string,
  id: string,
  mailStatus: "sent" | "failed",
): Row => ({
  kind: "invitation",
  userId: null,
  email,
  displayName: null,
  role: "member",
  status: "invited",
  lastActiveAt: null,
  invitation: invitationOf(id, mailStatus),
});

// The API of the page, answered in the browser. `requests` lists "METHOD /path" in order.
async function stubApi(page: Page, role: "admin" | "member") {
  const requests: string[] = [];
  let members: Row[] = [
    { ...person(ME, "Lan", "admin") },
    person("u-2", "Minh"),
    person("u-3", "Ann", "admin"),
  ];
  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    const method = request.method();
    requests.push(`${method} ${path}`);
    if (path === "/auth/session" && method === "GET") {
      return json(route, 200, {
        user: {
          id: ME,
          email: "lan@example.com",
          displayName: "Lan",
          role,
          language: "en",
        },
      });
    }
    if (path === "/members" && method === "GET") {
      const counts = { invited: 0, expired: 0, active: 0, deactivated: 0 };
      for (const row of members) counts[row.status] += 1;
      return json(route, 200, {
        members,
        counts,
        activeAdminCount: members.filter(
          (m) => m.status === "active" && m.role === "admin",
        ).length,
        nextCursor: null,
      });
    }
    if (path === "/channels" && method === "GET") {
      return json(route, 200, {
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
    if (path === "/invitations" && method === "POST") {
      const body = request.postDataJSON() as { emails: string[] };
      const results = body.emails.map((email, i) => {
        const failed = i === 1;
        const row = invite(
          email,
          `inv-${members.length}-${i}`,
          failed ? "failed" : "sent",
        );
        members = [...members, row];
        return {
          email,
          result: failed ? "mail_not_sent" : "invited",
          invitation: row.invitation,
        };
      });
      return json(route, 200, { results });
    }
    const resend = /^\/invitations\/([^/]+)\/resend$/.exec(path);
    if (resend && method === "POST") {
      const id = decodeURIComponent(resend[1]!);
      members = members.map((m) =>
        (m.invitation as { id?: string } | null)?.id === id
          ? { ...m, invitation: invitationOf(id, "sent") }
          : m,
      );
      return json(route, 200, {
        result: "invited",
        invitation: invitationOf(id, "sent"),
      });
    }
    const revoke = /^\/invitations\/([^/]+)\/revoke$/.exec(path);
    if (revoke && method === "POST") {
      const id = decodeURIComponent(revoke[1]!);
      members = members.filter(
        (m) => (m.invitation as { id?: string } | null)?.id !== id,
      );
      return json(route, 200, {
        invitation: { ...invitationOf(id, "sent"), state: "revoked" },
      });
    }
    const change = /^\/members\/([^/]+)\/(deactivate|reactivate|role)$/.exec(
      path,
    );
    if (change && method === "POST") {
      const id = decodeURIComponent(change[1]!);
      members = members.map((m) =>
        m.userId === id && change[2] !== "role"
          ? {
              ...m,
              status: change[2] === "deactivate" ? "deactivated" : "active",
            }
          : m,
      );
      const row = members.find((m) => m.userId === id)!;
      return json(route, 200, {
        member: {
          id,
          email: row.email,
          displayName: row.displayName,
          role: row.role,
          status: row.status,
        },
      });
    }
    return json(route, 404, { error: { code: "not_found", message: "none" } });
  });
  return { requests };
}

test("a Member who types the address sees only the no-access title and the browser asks for no member", async ({
  page,
}) => {
  const { requests } = await stubApi(page, "member");
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "You do not have access to this page",
    }),
  ).toBeVisible();
  await expect(page.locator(".main")).toHaveText(
    "You do not have access to this page",
  );
  await expect(page.locator('a.ni[data-id="admin"]')).toHaveCount(0);
  expect(requests.filter((r) => r.includes("/members"))).toEqual([]);
});

test("an Admin sees the entry, the table and the channels", async ({
  page,
}) => {
  await stubApi(page, "admin");
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { level: 1, name: "Admin" }),
  ).toBeVisible();
  await expect(page.locator('a.ni[data-id="admin"]').first()).toBeAttached();
  const table = page.getByRole("table", { name: "Members" });
  await expect(table.getByRole("row")).toHaveCount(4);
  await expect(page.getByRole("table", { name: "Channels" })).toContainText(
    "general",
  );
  await expect(page.getByRole("button", { name: "All 3" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("an Admin invites two addresses, resends the one whose mail failed and revokes it", async ({
  page,
}) => {
  await stubApi(page, "admin");
  await page.goto("/admin");
  await page.getByRole("button", { name: "Invite members" }).click();
  const dialog = page.getByRole("dialog", { name: "Invite members" });
  await dialog
    .getByRole("textbox", { name: "Email addresses" })
    .fill("sam@example.com, kim@example.com");
  await dialog.getByRole("button", { name: "Send invitations" }).click();
  const results = dialog.getByRole("list", { name: "Results" });
  await expect(results.getByRole("listitem")).toHaveCount(2);
  await expect(results).toContainText("sam@example.com");
  await expect(results).toContainText("Mail not sent");
  await dialog.getByRole("button", { name: "Done" }).click();

  const table = page.getByRole("table", { name: "Members" });
  const kim = table.getByRole("row", { name: /kim@example\.com/ });
  await expect(kim).toContainText("Mail not sent");
  await kim.getByRole("button", { name: "Resend" }).click();
  await expect(kim).toContainText("Invited");

  await kim.getByRole("button", { name: "Revoke" }).click();
  const confirm = page.getByRole("dialog", { name: "Revoke this invitation?" });
  await expect(confirm).toContainText("kim@example.com");
  await confirm.getByRole("button", { name: "Revoke" }).click();
  await expect(
    table.getByRole("row", { name: /kim@example\.com/ }),
  ).toHaveCount(0);
});

test("an Admin deactivates a person after confirming, and cannot deactivate themselves", async ({
  page,
}) => {
  await stubApi(page, "admin");
  await page.goto("/admin");
  await page.getByRole("button", { name: "Actions for Minh" }).click();
  await page.getByRole("menuitem", { name: "Deactivate" }).click();
  const confirm = page.getByRole("dialog", { name: "Deactivate this person?" });
  await expect(confirm).toContainText("Minh");
  await confirm.getByRole("button", { name: "Deactivate" }).click();
  await expect(page.getByRole("row", { name: /Minh/ })).toContainText(
    "Deactivated",
  );

  await page.getByRole("button", { name: "Actions for Lan" }).click();
  const own = page.getByRole("menuitem", { name: /Deactivate/ });
  await expect(own).toHaveAttribute("aria-disabled", "true");
  await expect(own).toContainText("You cannot deactivate yourself");
});

test("at 360 px the page has no horizontal scroll and its controls are at least 40 px tall", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await stubApi(page, "admin");
  await page.goto("/admin");
  await expect(page.getByRole("table", { name: "Members" })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  const controls = [
    page.getByRole("button", { name: "Invite members" }),
    page.getByRole("button", { name: "Actions for Minh" }),
    page.getByRole("button", { name: "All 3" }),
  ];
  for (const control of controls) {
    const box = await control.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
  }

  // A row is a card: the cells are blocks, each with its column name before it.
  const row = page.getByRole("row", { name: /Minh/ });
  const cell = row.getByRole("cell").nth(2);
  await expect(row).toHaveCSS("display", "block");
  await expect(cell).toHaveCSS("display", "block");
  await expect(cell).toHaveAttribute("data-label", "Status");
  const label = await cell.evaluate(
    (el) => getComputedStyle(el, "::before").content,
  );
  expect(label).toBe('"Status"');
});

test("on a wide screen the rows are table rows and the header is shown", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await stubApi(page, "admin");
  await page.goto("/admin");
  await expect(page.getByRole("row", { name: /Minh/ })).toHaveCSS(
    "display",
    "table-row",
  );
  await expect(
    page.getByRole("columnheader", { name: "Last active" }),
  ).toBeVisible();
});
