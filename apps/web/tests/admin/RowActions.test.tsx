// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Decision } from "@toki/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { invitation, person } from "../support/fakeAdminServer";
import { directory, renderMembers } from "../support/adminHarness";

// The permission functions are real unless a test says what one answers (R16: a result the page
// cannot explain leaves the item out).
const override = vi.hoisted(() => ({
  deactivate: null as Decision | null,
  invitations: null as Decision | null,
}));

vi.mock("@toki/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@toki/shared")>();
  return {
    ...actual,
    canDeactivateAccount: (
      ...args: Parameters<typeof actual.canDeactivateAccount>
    ) => override.deactivate ?? actual.canDeactivateAccount(...args),
    canManageInvitations: (
      ...args: Parameters<typeof actual.canManageInvitations>
    ) => override.invitations ?? actual.canManageInvitations(...args),
  };
});

afterEach(() => {
  override.deactivate = null;
  override.invitations = null;
  vi.unstubAllGlobals();
});

const rowOf = async (name: string) => {
  const cell = await screen.findByText(name, { selector: "b" });
  return cell.closest("tr") as HTMLElement;
};

async function openMenu(name: string) {
  await userEvent.click(
    await screen.findByRole("button", { name: `Actions for ${name}` }),
  );
  return screen.getByRole("menu");
}

const item = (menu: HTMLElement, name: RegExp | string) =>
  within(menu).getByRole("menuitem", { name });

describe("the menu of an account row (R15, R16, R17)", () => {
  it("has a button that is always drawn, named for the person", async () => {
    renderMembers();
    const button = await screen.findByRole("button", {
      name: "Actions for Minh",
    });
    expect(button).toHaveAttribute("aria-haspopup", "menu");
    // A deactivated person has one too.
    expect(screen.getByRole("button", { name: "Actions for Bo" })).toBeTruthy();
  });

  it("an active Member among two Admins: Change role holds Member (current) and Admin, then Deactivate", async () => {
    renderMembers();
    const menu = await openMenu("Minh");
    const group = within(menu).getByRole("group", { name: "Change role" });
    const current = within(group).getByRole("menuitem", { name: /^Member/ });
    expect(current).toHaveAttribute("aria-disabled", "true");
    expect(current).toHaveTextContent("Current role");
    expect(
      within(group).getByRole("menuitem", { name: "Admin" }),
    ).not.toHaveAttribute("aria-disabled");
    const deactivate = item(menu, "Deactivate");
    expect(deactivate).not.toHaveAttribute("aria-disabled");
    expect(deactivate).toHaveClass("dng");
  });

  it("an active Admin among two: Member is allowed and Admin is the current role", async () => {
    renderMembers();
    const menu = await openMenu("Ann");
    expect(item(menu, "Member")).not.toHaveAttribute("aria-disabled");
    expect(item(menu, /^Admin/)).toHaveAttribute("aria-disabled", "true");
    expect(item(menu, /^Admin/)).toHaveTextContent("Current role");
  });

  it("the actor's own row with two Admins: Deactivate is locked, Change role to Member is allowed", async () => {
    renderMembers();
    const menu = await openMenu("Lan");
    const deactivate = item(menu, /^Deactivate/);
    expect(deactivate).toHaveAttribute("aria-disabled", "true");
    expect(deactivate).toHaveTextContent("You cannot deactivate yourself");
    expect(item(menu, "Member")).not.toHaveAttribute("aria-disabled");
  });

  it("the only Admin: Change role to Member says to make someone else an Admin first, and Deactivate is locked", async () => {
    renderMembers({
      members: [
        person({ n: 1, displayName: "Lan", role: "admin" }),
        person({ n: 2, displayName: "Minh" }),
      ],
    });
    const menu = await openMenu("Lan");
    const member = item(menu, /^Member/);
    expect(member).toHaveAttribute("aria-disabled", "true");
    expect(member).toHaveTextContent("Make someone else an Admin first");
    expect(item(menu, /^Deactivate/)).toHaveAttribute("aria-disabled", "true");
  });

  it("a deactivated person has Reactivate and no Change role", async () => {
    renderMembers();
    const menu = await openMenu("Bo");
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(1);
    expect(item(menu, "Reactivate")).not.toHaveAttribute("aria-disabled");
    expect(within(menu).queryByRole("group")).toBeNull();
  });

  it("a locked item is reachable by the arrow keys, holds its reason and does nothing when pressed", async () => {
    const { server } = renderMembers();
    const menu = await openMenu("Lan");
    const locked = item(menu, /^Deactivate/);
    // The first enabled item has focus; the arrow keys walk through the locked one too.
    for (let i = 0; i < 4 && document.activeElement !== locked; i += 1) {
      await userEvent.keyboard("{ArrowDown}");
    }
    expect(locked).toHaveFocus();
    expect(locked.textContent).toContain("You cannot deactivate yourself");
    expect(locked).not.toHaveAttribute("title");
    const before = server.calls.length;
    await userEvent.keyboard("{Enter}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(server.calls).toHaveLength(before);
  });

  it("a result that the page cannot explain leaves the item out", async () => {
    override.deactivate = { allowed: false, reason: "fact_missing" };
    renderMembers();
    const menu = await openMenu("Minh");
    expect(
      within(menu).queryByRole("menuitem", { name: /Deactivate/ }),
    ).toBeNull();
    expect(item(menu, "Admin")).toBeTruthy();
  });

  it("never compares a role itself: the same row with a stubbed refusal shows no control it cannot explain", async () => {
    override.deactivate = { allowed: false, reason: "role_not_allowed" };
    renderMembers();
    const menu = await openMenu("Minh");
    expect(
      within(menu).queryByRole("menuitem", { name: /Deactivate/ }),
    ).toBeNull();
  });
});

describe("the buttons of an invitation row (R15)", () => {
  it("has Resend and Revoke on the row, no menu, and each is named for its row", async () => {
    renderMembers({ members: [invitation({ n: 1 })] });
    const row = await rowOf("invitee001@example.com");
    const resend = within(row).getByRole("button", { name: "Resend" });
    const revoke = within(row).getByRole("button", { name: "Revoke" });
    expect(
      within(row).queryByRole("button", { name: /Actions for/ }),
    ).toBeNull();
    for (const button of [resend, revoke]) {
      const described = button.getAttribute("aria-describedby");
      expect(described).toBeTruthy();
      expect(document.getElementById(described!)).toHaveTextContent(
        "invitee001@example.com",
      );
    }
  });

  it("an expired invitation has the same two buttons", async () => {
    renderMembers({ members: [invitation({ n: 1, status: "expired" })] });
    const row = await rowOf("invitee001@example.com");
    expect(within(row).getByRole("button", { name: "Resend" })).toBeTruthy();
    expect(within(row).getByRole("button", { name: "Revoke" })).toBeTruthy();
  });

  it("leaves the buttons out when the permission function refuses", async () => {
    override.invitations = { allowed: false, reason: "role_not_allowed" };
    renderMembers({ members: [invitation({ n: 1 })] });
    const row = await rowOf("invitee001@example.com");
    await waitFor(() => expect(row).toBeInTheDocument());
    expect(within(row).queryByRole("button")).toBeNull();
  });

  it("the page of the test has an account row and two invitation rows", async () => {
    renderMembers({ members: directory() });
    await screen.findByRole("table");
    expect(screen.getAllByRole("button", { name: "Resend" })).toHaveLength(2);
    expect(
      screen.getAllByRole("button", { name: /^Actions for/ }),
    ).toHaveLength(4);
  });
});
