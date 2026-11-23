// Table A of the TOKI-093 spec: every phase 1 action that is destructive or
// irreversible, with the pattern it gets (D-069), the decision that says so and
// the ticket that builds its call site. A ticket that adds an action adds its row
// here and in actions.test.ts in the same change (R10).

type Pattern = "undo" | "confirm" | "none";

type Row = {
  pattern: Pattern;
  source: string;
  owner: `TOKI-${number}`;
};

const table = <T extends Record<string, Row>>(rows: T): T => rows;

export const actionPatterns = table({
  leavePublicChannel: {
    pattern: "undo",
    source: "D-061, D-069, AC-054",
    owner: "TOKI-035",
  },
  pinMessage: { pattern: "undo", source: "AC-098, TS-153", owner: "TOKI-048" },
  unpinMessage: {
    pattern: "undo",
    source: "D-061, AC-098, TS-152",
    owner: "TOKI-048",
  },
  markActivityDone: {
    pattern: "undo",
    source: "D-061, D-069, AC-112",
    owner: "TOKI-066",
  },
  removeFromLater: { pattern: "undo", source: "D-061", owner: "TOKI-067" },
  deleteOwnMessage: {
    pattern: "confirm",
    source: "AC-031, D-043, F16",
    owner: "TOKI-047",
  },
  deleteMemberMessage: {
    pattern: "confirm",
    source: "F42, D-049",
    owner: "TOKI-047",
  },
  leavePrivateChannel: {
    pattern: "confirm",
    source: "D-051, D-156, AC-055",
    owner: "TOKI-035",
  },
  // The last member of a public channel confirms like a private leave and has no Undo (TOKI-035
  // concern 2, R24).
  leavePublicChannelLastMember: {
    pattern: "confirm",
    source: "D-051, D-069, AC-056; concern 2 of the TOKI-035 spec",
    owner: "TOKI-035",
  },
  archiveChannel: {
    pattern: "confirm",
    source: "D-061, F26",
    owner: "TOKI-101",
  },
  // Restore returns the channel to every member's list, so it asks as reactivateMember does and
  // has no Undo: an Undo would run archiveChannel with no question (TOKI-101 concern 2).
  restoreChannel: {
    pattern: "confirm",
    source:
      "Concern 2 of the TOKI-101 spec (Thanh Truong, 2026-11-20); reading of D-069",
    owner: "TOKI-101",
  },
  removeFromChannel: {
    pattern: "confirm",
    source:
      "Plan line of TOKI-100 (names the person); reading of D-069. D-085 says who may remove, not the pattern",
    owner: "TOKI-100",
  },
  deactivateMember: {
    pattern: "confirm",
    source: "D-061, F41, AC-069",
    owner: "TOKI-025",
  },
  reactivateMember: {
    pattern: "confirm",
    source: "Reading of D-069 (affects another person); plan line of TOKI-025",
    owner: "TOKI-025",
  },
  changeRole: {
    pattern: "confirm",
    source: "F40, D-069",
    owner: "TOKI-025",
  },
  revokeInvitation: {
    pattern: "confirm",
    source:
      "Plan line of TOKI-025 (Revoke asks for confirmation); reading of D-069",
    owner: "TOKI-025",
  },
  signOutDevice: {
    pattern: "confirm",
    source: "D-158, AC-134",
    owner: "TOKI-099",
  },
  signOutOtherDevices: {
    pattern: "confirm",
    source: 'D-158, AC-135; "names how many" is this spec\'s reading of AC-078',
    owner: "TOKI-099",
  },
  notifyChannel: {
    pattern: "confirm",
    source: "D-041, AC-044",
    owner: "TOKI-050",
  },
  deleteUnsentMessage: { pattern: "none", source: "D-087", owner: "TOKI-042" },
} as const satisfies Record<string, Row>);

export type ActionId = keyof typeof actionPatterns;
export type ActionPattern = Pattern;

type IdsWith<P extends Pattern> = {
  [K in ActionId]: (typeof actionPatterns)[K]["pattern"] extends P ? K : never;
}[ActionId];

export type UndoActionId = IdsWith<"undo">;
export type ConfirmActionId = IdsWith<"confirm">;
