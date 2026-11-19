import { describe, expect, it } from "vitest";
import {
  canChangeRole,
  canDeactivateAccount,
  canInviteMember,
  canManageInvitations,
  canOpenAdminPage,
  canReactivateAccount,
  canUseWorkspaceViews,
} from "../../src/index.js";
import type { Role, TargetPerson } from "../../src/index.js";
import { admin, allow, deny, member, person } from "./fixtures.js";

// The Admin who acts, seen as the target of their own action.
const self = person({ id: admin.id, role: "admin" });
const otherAdmin = person({ id: "user-hoa", role: "admin" });

describe("workspace pages (R10)", () => {
  it("opens the workspace views for both roles", () => {
    expect(canUseWorkspaceViews(member)).toEqual(allow);
    expect(canUseWorkspaceViews(admin)).toEqual(allow);
  });

  it("opens the Admin page only for an Admin", () => {
    expect(canOpenAdminPage(admin)).toEqual(allow);
    expect(canOpenAdminPage(member)).toEqual(deny("role_not_allowed"));
  });
});

describe("invitations (R11)", () => {
  it("lets an Admin invite with either role", () => {
    expect(canInviteMember(admin, { role: "member" })).toEqual(allow);
    expect(canInviteMember(admin, { role: "admin" })).toEqual(allow);
  });

  it("refuses a Member", () => {
    expect(canInviteMember(member, { role: "member" })).toEqual(
      deny("role_not_allowed"),
    );
    expect(canManageInvitations(member)).toEqual(deny("role_not_allowed"));
  });

  it("refuses an invited role that is not one of the two", () => {
    expect(canInviteMember(admin, { role: "guest" })).toEqual(
      deny("unknown_role"),
    );
    // An unknown role comes before the role of the actor (R3).
    expect(canInviteMember(member, { role: "guest" })).toEqual(
      deny("unknown_role"),
    );
    expect(canInviteMember(admin, {} as { role: string })).toEqual(
      deny("fact_missing"),
    );
    expect(
      canInviteMember(admin, undefined as unknown as { role: string }),
    ).toEqual(deny("fact_missing"));
  });

  it("lets only an Admin resend, revoke and list invitations", () => {
    expect(canManageInvitations(admin)).toEqual(allow);
  });
});

describe("canChangeRole (R12)", () => {
  it("refuses a Member", () => {
    expect(canChangeRole(member, person(), "admin", 2)).toEqual(
      deny("role_not_allowed"),
    );
  });

  it("allows promoting, and setting the role a person already has", () => {
    expect(canChangeRole(admin, person(), "admin", 1)).toEqual(allow);
    expect(canChangeRole(admin, person(), "member", 1)).toEqual(allow);
    expect(canChangeRole(admin, self, "admin", 1)).toEqual(allow);
  });

  it("refuses demoting the last Admin, also by themselves", () => {
    expect(canChangeRole(admin, self, "member", 1)).toEqual(deny("last_admin"));
    expect(canChangeRole(admin, otherAdmin, "member", 1)).toEqual(
      deny("last_admin"),
    );
    expect(canChangeRole(admin, otherAdmin, "member", 0)).toEqual(
      deny("last_admin"),
    );
  });

  it("allows demoting any Admin, oneself included, with two active Admins", () => {
    expect(canChangeRole(admin, self, "member", 2)).toEqual(allow);
    expect(canChangeRole(admin, otherAdmin, "member", 2)).toEqual(allow);
  });

  it("allows demoting a deactivated Admin whatever the count", () => {
    const gone = person({
      id: "user-hoa",
      role: "admin",
      status: "deactivated",
    });
    expect(canChangeRole(admin, gone, "member", 1)).toEqual(allow);
    expect(canChangeRole(admin, gone, "member", 0)).toEqual(allow);
  });

  it("refuses a role it does not know and a count that is not a whole number", () => {
    expect(canChangeRole(admin, person(), "owner" as Role, 2)).toEqual(
      deny("unknown_role"),
    );
    expect(
      canChangeRole(admin, person(), undefined as unknown as Role, 2),
    ).toEqual(deny("fact_missing"));
    for (const count of [-1, 1.5, Number.NaN, "2" as unknown as number]) {
      expect(canChangeRole(admin, person(), "admin", count)).toEqual(
        deny("fact_missing"),
      );
    }
    expect(
      canChangeRole(
        admin,
        { ...person(), status: "invited" } as unknown as TargetPerson,
        "admin",
        2,
      ),
    ).toEqual(deny("fact_missing"));
  });

  it("names a missing fact before the role of the actor (R3)", () => {
    expect(canChangeRole(member, person(), "admin", -1)).toEqual(
      deny("fact_missing"),
    );
  });
});

describe("canDeactivateAccount (R12)", () => {
  it("refuses a Member", () => {
    expect(canDeactivateAccount(member, person(), 2)).toEqual(
      deny("role_not_allowed"),
    );
  });

  it("allows deactivating a Member, and an Admin who is deactivated already", () => {
    expect(canDeactivateAccount(admin, person(), 1)).toEqual(allow);
    expect(
      canDeactivateAccount(
        admin,
        person({ id: "user-hoa", role: "admin", status: "deactivated" }),
        1,
      ),
    ).toEqual(allow);
  });

  it("refuses deactivating oneself, with one Admin or with two", () => {
    expect(canDeactivateAccount(admin, self, 2)).toEqual(deny("self_target"));
    // Oneself comes before the last Admin (R3).
    expect(canDeactivateAccount(admin, self, 1)).toEqual(deny("self_target"));
  });

  it("refuses deactivating the last active Admin", () => {
    expect(canDeactivateAccount(admin, otherAdmin, 1)).toEqual(
      deny("last_admin"),
    );
    expect(canDeactivateAccount(admin, otherAdmin, 2)).toEqual(allow);
  });

  it("refuses a bad count and a bad status", () => {
    expect(canDeactivateAccount(admin, person(), 1.5)).toEqual(
      deny("fact_missing"),
    );
    expect(
      canDeactivateAccount(
        admin,
        { ...person(), status: undefined } as unknown as TargetPerson,
        2,
      ),
    ).toEqual(deny("fact_missing"));
  });
});

describe("canReactivateAccount (R12)", () => {
  it("allows only an Admin", () => {
    expect(canReactivateAccount(admin)).toEqual(allow);
    expect(canReactivateAccount(member)).toEqual(deny("role_not_allowed"));
  });
});
