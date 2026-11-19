import { describe, expect, it } from "vitest";
import {
  actionPatterns,
  type ActionId,
  type ConfirmActionId,
  type UndoActionId,
} from "../../src/patterns/actions";

// A copy of Table A of the TOKI-093 spec: id, pattern, source, owner.
const tableA: Array<[string, "undo" | "confirm" | "none", string, string]> = [
  ["leavePublicChannel", "undo", "D-061, D-069, AC-054", "TOKI-035"],
  ["pinMessage", "undo", "AC-098, TS-153", "TOKI-048"],
  ["unpinMessage", "undo", "D-061, AC-098, TS-152", "TOKI-048"],
  ["markActivityDone", "undo", "D-061, D-069, AC-112", "TOKI-066"],
  ["removeFromLater", "undo", "D-061", "TOKI-067"],
  ["deleteOwnMessage", "confirm", "AC-031, D-043, F16", "TOKI-047"],
  ["deleteMemberMessage", "confirm", "F42, D-049", "TOKI-047"],
  ["leavePrivateChannel", "confirm", "D-051, D-156, AC-055", "TOKI-035"],
  ["archiveChannel", "confirm", "D-061, F26", "TOKI-101"],
  [
    "removeFromChannel",
    "confirm",
    "Plan line of TOKI-100 (names the person); reading of D-069. D-085 says who may remove, not the pattern",
    "TOKI-100",
  ],
  ["deactivateMember", "confirm", "D-061, F41, AC-069", "TOKI-025"],
  [
    "reactivateMember",
    "confirm",
    "Reading of D-069 (affects another person); plan line of TOKI-025",
    "TOKI-025",
  ],
  ["changeRole", "confirm", "F40, D-069", "TOKI-025"],
  [
    "revokeInvitation",
    "confirm",
    "Plan line of TOKI-025 (Revoke asks for confirmation); reading of D-069",
    "TOKI-025",
  ],
  ["signOutDevice", "confirm", "D-158, AC-134", "TOKI-099"],
  [
    "signOutOtherDevices",
    "confirm",
    'D-158, AC-135; "names how many" is this spec\'s reading of AC-078',
    "TOKI-099",
  ],
  ["notifyChannel", "confirm", "D-041, AC-044", "TOKI-050"],
  ["deleteUnsentMessage", "none", "D-087", "TOKI-042"],
];

describe("actionPatterns (R10)", () => {
  it("holds exactly the 18 rows of Table A", () => {
    expect(Object.keys(actionPatterns).sort()).toEqual(
      tableA.map(([id]) => id).sort(),
    );
    expect(Object.keys(actionPatterns)).toHaveLength(18);
  });

  it.each(tableA)("%s: %s, %s, %s", (id, pattern, source, owner) => {
    expect(actionPatterns[id as ActionId]).toEqual({ pattern, source, owner });
  });

  it("gives every owner the shape of a ticket key", () => {
    for (const row of Object.values(actionPatterns)) {
      expect(row.owner).toMatch(/^TOKI-\d{3}$/);
    }
  });

  it("never gives an action two patterns (R11 a)", () => {
    const ids = Object.keys(actionPatterns) as ActionId[];
    const undo = ids.filter((id) => actionPatterns[id].pattern === "undo");
    const confirm = ids.filter(
      (id) => actionPatterns[id].pattern === "confirm",
    );
    const none = ids.filter((id) => actionPatterns[id].pattern === "none");
    const union = new Set([...undo, ...confirm, ...none]);
    expect(union.size).toBe(undo.length + confirm.length + none.length);
    expect([...union].sort()).toEqual([...ids].sort());
  });

  it("derives the two id types from the table", () => {
    const undoId: UndoActionId = "pinMessage";
    const confirmId: ConfirmActionId = "archiveChannel";
    // @ts-expect-error a confirm id is not an undo id
    const wrongUndo: UndoActionId = "archiveChannel";
    // @ts-expect-error an undo id is not a confirm id
    const wrongConfirm: ConfirmActionId = "pinMessage";
    // @ts-expect-error an action with no pattern is neither
    const wrongNone: UndoActionId = "deleteUnsentMessage";
    expect([
      undoId,
      confirmId,
      wrongUndo,
      wrongConfirm,
      wrongNone,
    ]).toHaveLength(5);
  });
});
