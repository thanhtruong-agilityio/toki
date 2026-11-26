import type { KnownDifference } from "../support/parity-reporter";

// Differences that the reviewer has accepted (TOKI-109 R4). One entry for each: the row name that
// the report shows (a property with its combination, or a screen with look and width), the
// reason, and the ticket that will fix it or the word `accepted`. An entry that no longer matches
// a real difference is listed in the report as "no longer a difference: remove the entry".

// The smoke screen /admin (deviation 3 of the plan; decided by Thanh Truong on 2026-11-24: no new
// ticket). When phase 5 builds the Analytics and Automations tabs and the seeded workspace
// (TOKI-081) is used, the report lists these rows as no longer a difference and the entries go.
const ADMIN_REASON =
  "The app's Admin shows Members and Channels; the prototype's admin shows Analytics and " +
  "Automations, which the Admin page spec leaves to phase 5 " +
  "(docs/specs/2026-11-17-admin-page-design.md:27). The sidebar differs too: the stub workspace " +
  "of this check is not the prototype's sample workspace (TOKI-081).";

const adminKnownDifferences: KnownDifference[] = (
  ["calm", "focus"] as const
).flatMap((look) =>
  (["wide", "mid", "narrow"] as const).map((width) => ({
    id: `admin/${look}/${width}`,
    reason: ADMIN_REASON,
    ticket: "accepted",
  })),
);

// The sign-in page (TOKI-137). The app's card differs from the prototype's guest sign-in card in
// ways that the sign-in spec decided (wording, extra buttons, the card near the top of a narrow
// screen, the focused field) and in ways that the ticket named here fixes (shadow, workspace name,
// heading, placeholder, link). The picture of the prototype is also of `#app`, so it holds the
// rounded frame, the link 'Back to the normal view' and, in the code step, the purple note
// 'Prototype: no email is sent', which the app has not. When that ticket is done the report lists
// these rows as "no longer a difference" and the entries go.
const SIGN_IN_REASON =
  "The sign-in card of the app is fixed by TOKI-136, apart from what the sign-in spec decided " +
  "(docs/specs/2026-11-16-sign-in-screens-design.md: R4, R8, R36, the layout at the three " +
  "widths, the focused field). The prototype's picture is of #app, so it also holds the rounded " +
  "frame, the link 'Back to the normal view' and, in the code step, the note 'Prototype: no " +
  "email is sent', which the app has not.";

const signInKnownDifferences: KnownDifference[] = (
  ["signin-email", "signin-code"] as const
).flatMap((screen) =>
  (["calm", "focus"] as const).flatMap((look) =>
    (["wide", "mid", "narrow"] as const).map((width) => ({
      id: `${screen}/${look}/${width}`,
      reason: SIGN_IN_REASON,
      ticket: "TOKI-136",
    })),
  ),
);

export const knownDifferences: KnownDifference[] = [
  ...adminKnownDifferences,
  ...signInKnownDifferences,
];
