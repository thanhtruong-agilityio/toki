import { describe, expect, it } from "vitest";
import {
  actorReason,
  conversationReason,
  countReason,
  first,
  messageReason,
  roleValueReason,
  targetReason,
} from "../../src/permissions/checks.js";
import { conv, person } from "./fixtures.js";

describe("first (R3)", () => {
  it("returns the reason that comes first in the order of R3, not in the list", () => {
    expect(first([null, null])).toBeNull();
    expect(first(["channel_archived", null, "not_a_member"])).toBe(
      "not_a_member",
    );
    expect(first(["unknown_role", "fact_missing"])).toBe("fact_missing");
    expect(first(["last_admin", "self_target", "not_author"])).toBe(
      "not_author",
    );
  });
});

describe("actorReason (R4)", () => {
  it("accepts a Member and an Admin", () => {
    expect(actorReason({ id: "a", role: "member" })).toBeNull();
    expect(actorReason({ id: "a", role: "admin" })).toBeNull();
  });

  it.each([
    undefined,
    null,
    "user-mai",
    7,
    {},
    { role: "admin" },
    { id: "", role: "admin" },
    { id: 7, role: "admin" },
    { id: "a" },
    { id: "a", role: null },
    { id: "a", role: 1 },
  ])("refuses %j as a missing fact", (actor) => {
    expect(actorReason(actor)).toBe("fact_missing");
  });

  it.each(["guest", "owner", "Admin", ""])(
    "refuses the role %j as unknown",
    (role) => {
      expect(actorReason({ id: "a", role })).toBe("unknown_role");
    },
  );

  it("puts a missing id before an unknown role", () => {
    expect(actorReason({ id: "", role: "guest" })).toBe("fact_missing");
  });
});

describe("conversationReason (R2, R4)", () => {
  it("accepts the four kinds", () => {
    for (const kind of [
      "public_channel",
      "private_channel",
      "dm",
      "group_dm",
    ] as const) {
      expect(conversationReason(conv({ kind }), "all")).toBeNull();
    }
    expect(conversationReason(conv({ isGeneral: true }), "all")).toBeNull();
  });

  it.each([undefined, null, "public_channel", 7])(
    "refuses %j in place of the facts",
    (value) => {
      expect(conversationReason(value, "kind_only")).toBe("fact_missing");
    },
  );

  it.each([
    { kind: "channel" },
    { kind: undefined },
    { isGeneral: undefined },
    { isGeneral: "no" },
    { archived: undefined },
    { archived: 0 },
    { isMember: undefined },
    { isMember: "yes" },
  ])("refuses the facts with %j", (over) => {
    expect(conversationReason({ ...conv(), ...over }, "all")).toBe(
      "fact_missing",
    );
  });

  it.each(["private_channel", "dm", "group_dm"] as const)(
    "refuses #general on a %s, which the mapping cannot name",
    (kind) => {
      expect(conversationReason(conv({ kind, isGeneral: true }), "all")).toBe(
        "fact_missing",
      );
      expect(
        conversationReason(conv({ kind, isGeneral: true }), "kind_only"),
      ).toBe("fact_missing");
    },
  );

  it("checks only the facts that were asked for", () => {
    const noMember = {
      kind: "public_channel",
      isGeneral: false,
      archived: false,
    };
    expect(conversationReason(noMember, "no_member")).toBeNull();
    expect(conversationReason(noMember, "all")).toBe("fact_missing");
    const kindOnly = { kind: "private_channel", isGeneral: false };
    expect(conversationReason(kindOnly, "kind_only")).toBeNull();
    expect(conversationReason(kindOnly, "no_member")).toBe("fact_missing");
  });
});

describe("messageReason, targetReason, countReason, roleValueReason (R4, R12)", () => {
  it("needs a non-empty author id", () => {
    expect(messageReason({ authorId: "a" })).toBeNull();
    for (const msg of [
      undefined,
      null,
      {},
      { authorId: "" },
      { authorId: 3 },
    ]) {
      expect(messageReason(msg)).toBe("fact_missing");
    }
  });

  it("needs the id, the role and the status of the target", () => {
    expect(targetReason(person())).toBeNull();
    expect(
      targetReason(person({ role: "admin", status: "deactivated" })),
    ).toBeNull();
    for (const target of [
      undefined,
      null,
      { ...person(), id: "" },
      { ...person(), role: undefined },
      { ...person(), status: "invited" },
      { ...person(), status: undefined },
    ]) {
      expect(targetReason(target)).toBe("fact_missing");
    }
    expect(targetReason({ ...person(), role: "guest" })).toBe("unknown_role");
    expect(targetReason({ ...person(), role: "guest", status: "gone" })).toBe(
      "fact_missing",
    );
  });

  it("needs a whole count of 0 or more", () => {
    for (const n of [0, 1, 2, 50]) expect(countReason(n)).toBeNull();
    for (const n of [-1, 1.5, Number.NaN, Infinity, "2", null, undefined]) {
      expect(countReason(n)).toBe("fact_missing");
    }
  });

  it("reads a role that is passed as a value", () => {
    expect(roleValueReason("member")).toBeNull();
    expect(roleValueReason("admin")).toBeNull();
    expect(roleValueReason("guest")).toBe("unknown_role");
    expect(roleValueReason(undefined)).toBe("fact_missing");
    expect(roleValueReason(1)).toBe("fact_missing");
  });
});
