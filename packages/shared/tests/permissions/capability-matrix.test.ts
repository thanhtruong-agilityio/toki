import { describe, expect, it } from "vitest";
import * as permissions from "../../src/permissions/index.js";
import type { Actor } from "../../src/index.js";
import { permissionFunctions } from "./cases.js";
import { admin, conv, member, person } from "./fixtures.js";

const functions = permissionFunctions(permissions);

type Result =
  | { allowed: true; as?: "author" | "admin" }
  | { allowed: false; reason: string };
const yes: Result = { allowed: true };
const no = (reason: string): Result => ({ allowed: false, reason });

// One call of a function and what a Member and an Admin get from it.
type Check = {
  fn: string;
  args: (actor: Actor) => unknown[];
  member: Result;
  admin: Result;
};
type Entry = { n: number; row: string; checks: Check[] };

const other = { authorId: "user-someone-else" };
const outside = { isMember: false };

// Rows 1 to 17 are the phase 1 rows of the capability table, in its words
// (spec, Table A). Entries 18 and 19 are the two rules that are in no row.
// A ticket that adds a permission function adds its row here.
const matrix: Entry[] = [
  { n: 1, row: "Sign in with an emailed code", checks: [] },
  {
    n: 2,
    row: "Read and post in public channels",
    checks: [
      {
        fn: "canReadConversation",
        args: (a) => [a, conv()],
        member: yes,
        admin: yes,
      },
      {
        fn: "canPostInConversation",
        args: (a) => [a, conv()],
        member: yes,
        admin: yes,
      },
    ],
  },
  {
    n: 3,
    row: "Read and post in private channels",
    checks: [
      {
        fn: "canReadConversation",
        args: (a) => [a, conv({ kind: "private_channel" })],
        member: yes,
        admin: yes,
      },
      {
        fn: "canPostInConversation",
        args: (a) => [a, conv({ kind: "private_channel" })],
        member: yes,
        admin: yes,
      },
      {
        fn: "canReadConversation",
        args: (a) => [a, conv({ kind: "private_channel", ...outside })],
        member: no("not_a_member"),
        admin: no("not_a_member"),
      },
      {
        fn: "canPostInConversation",
        args: (a) => [a, conv({ kind: "private_channel", ...outside })],
        member: no("not_a_member"),
        admin: no("not_a_member"),
      },
    ],
  },
  {
    n: 4,
    row: "Create public and private channels",
    checks: [
      {
        fn: "canCreateChannel",
        args: (a) => [a],
        member: no("role_not_allowed"),
        admin: yes,
      },
    ],
  },
  {
    n: 5,
    row: "Join public channels; add people to a channel you are in",
    checks: [
      {
        fn: "canJoinChannel",
        args: (a) => [a, conv(outside)],
        member: yes,
        admin: yes,
      },
      {
        fn: "canJoinChannel",
        args: (a) => [a, conv({ kind: "private_channel", ...outside })],
        member: no("private_channel"),
        admin: no("private_channel"),
      },
      {
        fn: "canAddPeopleToChannel",
        args: (a) => [a, conv()],
        member: yes,
        admin: yes,
      },
      {
        fn: "canAddPeopleToChannel",
        args: (a) => [a, conv(outside)],
        member: no("not_a_member"),
        admin: no("not_a_member"),
      },
    ],
  },
  {
    n: 6,
    row: "Create DMs and group DMs",
    checks: [
      {
        fn: "canCreateDirectConversation",
        args: (a) => [a],
        member: yes,
        admin: yes,
      },
    ],
  },
  {
    n: 7,
    row: "Threads, reactions, sending files",
    checks: [
      {
        fn: "canPostInConversation",
        args: (a) => [a, conv({ kind: "group_dm" })],
        member: yes,
        admin: yes,
      },
      {
        fn: "canPostInConversation",
        args: (a) => [a, conv({ archived: true })],
        member: no("channel_archived"),
        admin: no("channel_archived"),
      },
    ],
  },
  {
    n: 8,
    row: "Pin messages, use @channel",
    checks: [
      {
        fn: "canPinMessage",
        args: (a) => [a, conv()],
        member: yes,
        admin: yes,
      },
      {
        fn: "canUseAtChannel",
        args: (a) => [a, conv()],
        member: yes,
        admin: yes,
      },
      {
        fn: "canUseAtChannel",
        args: (a) => [a, conv({ kind: "dm" })],
        member: no("not_a_channel"),
        admin: no("not_a_channel"),
      },
    ],
  },
  {
    n: 9,
    row: "Edit and delete your own messages",
    checks: [
      {
        fn: "canEditMessage",
        args: (a) => [a, conv(), { authorId: a.id }],
        member: yes,
        admin: yes,
      },
      {
        fn: "canEditMessage",
        args: (a) => [a, conv(), other],
        member: no("not_author"),
        admin: no("not_author"),
      },
      {
        fn: "canDeleteMessage",
        args: (a) => [a, conv(), { authorId: a.id }],
        member: { allowed: true, as: "author" },
        admin: { allowed: true, as: "author" },
      },
    ],
  },
  {
    n: 10,
    row: "Delete other people's messages",
    checks: [
      {
        fn: "canDeleteMessage",
        args: (a) => [a, conv(), other],
        member: no("not_author"),
        admin: { allowed: true, as: "admin" },
      },
      {
        fn: "canDeleteMessage",
        args: (a) => [a, conv({ kind: "private_channel", ...outside }), other],
        member: no("not_a_member"),
        admin: no("not_a_member"),
      },
    ],
  },
  {
    n: 11,
    row: "Activity, Later, Files, People, Ctrl+K",
    checks: [
      { fn: "canUseWorkspaceViews", args: (a) => [a], member: yes, admin: yes },
    ],
  },
  {
    n: 12,
    row: "Remove people from a channel",
    checks: [
      {
        fn: "canRemovePeopleFromChannel",
        args: (a) => [a, conv()],
        member: no("role_not_allowed"),
        admin: yes,
      },
      {
        fn: "canRemovePeopleFromChannel",
        args: (a) => [a, conv(outside)],
        member: no("role_not_allowed"),
        admin: no("not_a_member"),
      },
      {
        fn: "canRemovePeopleFromChannel",
        args: (a) => [a, conv({ isGeneral: true })],
        member: no("role_not_allowed"),
        admin: no("channel_is_general"),
      },
    ],
  },
  {
    n: 13,
    row: "Archive and restore channels",
    checks: [
      {
        fn: "canArchiveChannel",
        args: (a) => [a, conv()],
        member: no("role_not_allowed"),
        admin: yes,
      },
      // Two broken rules at once (R13): the role comes before membership.
      {
        fn: "canArchiveChannel",
        args: (a) => [a, conv({ ...outside, archived: true })],
        member: no("role_not_allowed"),
        admin: no("not_a_member"),
      },
      {
        fn: "canRestoreChannel",
        args: (a) => [a, conv({ archived: true })],
        member: no("role_not_allowed"),
        admin: yes,
      },
      // Any Admin restores, a member or not (spec, concern 1).
      {
        fn: "canRestoreChannel",
        args: (a) => [a, conv({ ...outside, archived: true })],
        member: no("role_not_allowed"),
        admin: yes,
      },
    ],
  },
  {
    n: 14,
    row: "Open the Admin page",
    checks: [
      {
        fn: "canOpenAdminPage",
        args: (a) => [a],
        member: no("role_not_allowed"),
        admin: yes,
      },
    ],
  },
  {
    n: 15,
    row: "Invite members",
    checks: [
      {
        fn: "canInviteMember",
        args: (a) => [a, { role: "member" }],
        member: no("role_not_allowed"),
        admin: yes,
      },
      {
        fn: "canInviteMember",
        args: (a) => [a, { role: "admin" }],
        member: no("role_not_allowed"),
        admin: yes,
      },
      {
        fn: "canManageInvitations",
        args: (a) => [a],
        member: no("role_not_allowed"),
        admin: yes,
      },
    ],
  },
  {
    n: 16,
    row: "Deactivate and reactivate",
    checks: [
      {
        fn: "canDeactivateAccount",
        args: (a) => [a, person(), 1],
        member: no("role_not_allowed"),
        admin: yes,
      },
      {
        fn: "canDeactivateAccount",
        args: (a) => [a, person({ id: a.id, role: a.role }), 2],
        member: no("role_not_allowed"),
        admin: no("self_target"),
      },
      {
        fn: "canDeactivateAccount",
        args: (a) => [a, person({ id: "user-hoa", role: "admin" }), 1],
        member: no("role_not_allowed"),
        admin: no("last_admin"),
      },
      {
        fn: "canReactivateAccount",
        args: (a) => [a],
        member: no("role_not_allowed"),
        admin: yes,
      },
    ],
  },
  {
    n: 17,
    row: "Change roles",
    checks: [
      {
        fn: "canChangeRole",
        args: (a) => [a, person(), "admin", 1],
        member: no("role_not_allowed"),
        admin: yes,
      },
      {
        fn: "canChangeRole",
        args: (a) => [
          a,
          person({ id: "user-hoa", role: "admin" }),
          "member",
          1,
        ],
        member: no("role_not_allowed"),
        admin: no("last_admin"),
      },
    ],
  },
  {
    n: 18,
    row: "Leave a channel",
    checks: [
      {
        fn: "canLeaveChannel",
        args: (a) => [a, conv()],
        member: yes,
        admin: yes,
      },
      {
        fn: "canLeaveChannel",
        args: (a) => [a, conv({ isGeneral: true })],
        member: no("channel_is_general"),
        admin: no("channel_is_general"),
      },
    ],
  },
  {
    n: 19,
    row: "Edit a channel's topic and description",
    checks: [
      {
        fn: "canEditChannelDetails",
        args: (a) => [a, conv()],
        member: yes,
        admin: yes,
      },
      {
        fn: "canEditChannelDetails",
        args: (a) => [a, conv({ archived: true })],
        member: no("channel_archived"),
        admin: no("channel_archived"),
      },
    ],
  },
];

const namesIn = (entries: Entry[]) =>
  [
    ...new Set(entries.flatMap((entry) => entry.checks.map((c) => c.fn))),
  ].sort();

describe("capability matrix (R13, R14)", () => {
  it("has the 17 rows of the table and the entries 18 and 19", () => {
    expect(matrix.map((entry) => entry.n)).toEqual(
      Array.from({ length: 19 }, (_, i) => i + 1),
    );
  });

  it("names every exported function, and only functions that exist", () => {
    expect(namesIn(matrix)).toEqual(Object.keys(functions).sort());
  });

  it("counts 22 functions: 20 in a row, one in entry 18 and one in entry 19", () => {
    expect(Object.keys(functions)).toHaveLength(22);
    expect(namesIn(matrix.filter((entry) => entry.n <= 17))).toHaveLength(20);
    expect(namesIn(matrix.filter((entry) => entry.n === 18))).toEqual([
      "canLeaveChannel",
    ]);
    expect(namesIn(matrix.filter((entry) => entry.n === 19))).toEqual([
      "canEditChannelDetails",
    ]);
  });

  const rows = matrix.flatMap((entry) =>
    entry.checks.map((check, i) => ({
      ...check,
      label: `${entry.n}. ${entry.row} (${check.fn} ${i + 1})`,
    })),
  );
  it.each(rows)("$label", (check) => {
    expect(functions[check.fn]!(...check.args(member))).toEqual(check.member);
    expect(functions[check.fn]!(...check.args(admin))).toEqual(check.admin);
  });
});
