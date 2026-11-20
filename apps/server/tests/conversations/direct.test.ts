import { canCreateDirectConversation } from "@toki/shared";
import { describe, expect, it } from "vitest";
import type { AccountFacts } from "../../src/modules/conversations/deps.js";
import {
  checkPeople,
  planDirectConversation,
} from "../../src/modules/conversations/direct.js";

const id = (n: number) =>
  `01930b7e-7a53-7c2e-9f1a-${String(n).padStart(12, "0")}`;
const ids = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => id(from + i));
const ME = id(100);

describe("planDirectConversation (R5)", () => {
  it("makes a dm of one other person and a group of 2 to 7", () => {
    const dm = planDirectConversation(ME, ids(1, 1));
    expect(dm).toMatchObject({ ok: true, kind: "dm" });
    for (const n of [2, 3, 7]) {
      expect(planDirectConversation(ME, ids(1, n))).toMatchObject({
        ok: true,
        kind: "group_dm",
      });
    }
  });

  it("refuses 8 and 200 others with group_too_large", () => {
    for (const n of [8, 200]) {
      expect(planDirectConversation(ME, ids(1000, n))).toEqual({
        ok: false,
        refusal: "group_too_large",
      });
    }
  });

  it.each([
    ["alone", [ME]],
    ["first", [ME, ...ids(1, 2)]],
    ["last", [...ids(1, 2), ME]],
    ["in the middle", [id(1), ME, id(2)]],
    ["in upper case", [ME.toUpperCase()]],
  ])("refuses the caller's own id %s with direct_with_self", (_l, list) => {
    expect(planDirectConversation(ME, list)).toEqual({
      ok: false,
      refusal: "direct_with_self",
    });
  });

  it("checks the caller's own id before the size (R3 steps 4 and 5)", () => {
    expect(planDirectConversation(ME, [ME, ...ids(1, 8)])).toMatchObject({
      refusal: "direct_with_self",
    });
    expect(planDirectConversation(ME, ids(1, 8))).toMatchObject({
      refusal: "group_too_large",
    });
  });

  it("gives one key for the same people in any order and any letter case", () => {
    const base = planDirectConversation(ME, [id(3), id(1), id(2)]);
    const other = planDirectConversation(ME.toUpperCase(), [
      id(2).toUpperCase(),
      id(3),
      id(1),
    ]);
    expect(base).toMatchObject({ ok: true });
    expect(other).toMatchObject({ ok: true });
    if (base.ok && other.ok) {
      expect(other.key).toBe(base.key);
      expect(other.memberIds).toEqual(base.memberIds);
    }
  });

  it("lists the people lower case in ascending byte order, the caller included", () => {
    const plan = planDirectConversation(ME.toUpperCase(), [id(5), id(1)]);
    expect(plan).toMatchObject({ ok: true });
    if (plan.ok) {
      expect(plan.memberIds).toEqual([id(1), id(5), ME]);
      expect(plan.key).toBe([id(1), id(5), ME].join(","));
      expect(plan.others).toEqual([id(5), id(1)]);
    }
  });

  it("gives another key for a set that differs by one person", () => {
    const a = planDirectConversation(ME, ids(1, 2));
    const b = planDirectConversation(ME, ids(1, 3));
    const c = planDirectConversation(ME, ids(1, 1));
    expect(a.ok && b.ok && c.ok).toBe(true);
    if (a.ok && b.ok && c.ok) {
      expect(new Set([a.key, b.key, c.key]).size).toBe(3);
    }
  });
});

describe("checkPeople (R6, R7, R10)", () => {
  const WS = "ws-1";
  const caller: AccountFacts = {
    id: ME,
    workspaceId: WS,
    role: "member",
    status: "active",
  };
  const row = (n: number, extra: Partial<AccountFacts> = {}): AccountFacts => ({
    id: id(n),
    workspaceId: WS,
    role: "member",
    status: "active",
    ...extra,
  });
  const run = (
    rows: AccountFacts[],
    list: string[],
    canTakePart = canCreateDirectConversation,
  ) => checkPeople(caller, rows, list, canTakePart);

  it("answers ok with no deactivated person for active people", () => {
    expect(run([row(1), row(2, { role: "admin" })], [id(1), id(2)])).toEqual({
      kind: "ok",
      deactivated: [],
    });
  });

  it("answers not_found for a missing id and for another workspace, in a dm and a group", () => {
    expect(run([], [id(1)])).toEqual({ kind: "not_found" });
    expect(run([row(1, { workspaceId: "ws-2" })], [id(1)])).toEqual({
      kind: "not_found",
    });
    expect(run([row(1)], [id(1), id(2)])).toEqual({ kind: "not_found" });
    expect(
      run([row(1), row(2, { workspaceId: "ws-2" })], [id(1), id(2)]),
    ).toEqual({ kind: "not_found" });
  });

  it("answers not_found for a person the permission function refuses, as for an unknown id", () => {
    const refuse = () =>
      ({ allowed: false, reason: "role_not_allowed" }) as const;
    expect(run([row(1)], [id(1)], refuse)).toEqual({ kind: "not_found" });
  });

  it.each(["unknown_role", "fact_missing"] as const)(
    "answers a failure for %s and never a quiet refusal",
    (reason) => {
      const broken = () => ({ allowed: false, reason }) as const;
      expect(run([row(1)], [id(1)], broken)).toEqual({
        kind: "failure",
        reason,
      });
    },
  );

  it("treats a role the functions do not know as a failure with the real function", () => {
    expect(run([row(1, { role: "guest" })], [id(1)])).toEqual({
      kind: "failure",
      reason: "unknown_role",
    });
    expect(run([row(1, { role: "owner" })], [id(1)])).toMatchObject({
      kind: "failure",
    });
  });

  it("lists the deactivated people, lower case and sorted", () => {
    const result = run(
      [
        row(3, { status: "deactivated" }),
        row(1),
        row(2, { status: "deactivated" }),
      ],
      [id(3), id(1), id(2)],
    );
    expect(result).toEqual({ kind: "ok", deactivated: [id(2), id(3)] });
  });

  it("asks the permission function for each person with their own id and role", () => {
    const seen: unknown[] = [];
    const spy = (person: { id: string; role: string }) => {
      seen.push(person);
      return { allowed: true } as const;
    };
    run([row(1, { role: "admin" }), row(2)], [id(1), id(2)], spy);
    expect(seen).toEqual([
      { id: id(1), role: "admin" },
      { id: id(2), role: "member" },
    ]);
  });
});
