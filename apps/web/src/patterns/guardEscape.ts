// What Esc does on a form that has content (R21, concern 1). The log does not
// decide it, so this is a proposal kept in one place: "ask" opens the discard
// question as the close button does, "ignore" does nothing. Changing it is this
// line and one test.
export type GuardEscape = "ask" | "ignore";

export const GUARD_ESCAPE: GuardEscape = "ask";
