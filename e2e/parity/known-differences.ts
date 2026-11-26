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

// The sign-in page (TOKI-137, TOKI-136). What the sign-in spec did not decide has been made as the
// prototype's guest sign-in card draws it (TOKI-136): the shadow, the workspace name and the line
// under it, the heading, the placeholder of the code field and the place of the link. These rows
// still differ, for what the sign-in spec decided (docs/specs/2026-11-16-sign-in-screens-design.md)
// and for what only the picture of the prototype holds. The ticket is `accepted`: it is a decision,
// not a defect to fix, so the rows stay `known`.
const SPEC = "docs/specs/2026-11-16-sign-in-screens-design.md";
const EMAIL_STEP_REASON =
  `What the sign-in spec decided (${SPEC}): the email step shows exactly the logo, the workspace ` +
  "name, one field and the button 'Send code' (R4), so it has no heading and no introduction and " +
  "the button does not say 'Email me a code' (wording signed off on 2026-11-19); the email field " +
  "is focused when the step opens.";
const CODE_STEP_REASON =
  `What the sign-in spec decided (${SPEC}): the address and the line 'The code works for 10 ` +
  "minutes' stand above the field in place of the prototype's sentence (R8, concern 5); the " +
  "button 'Sign in' is disabled until the code has 6 digits (R36); the button 'Resend code' " +
  "(R8); the code field is focused when the step opens.";
const NARROW_REASON =
  " Under 720 px the card sits in the upper part of the screen, so that the keyboard does not " +
  `cover the field (${SPEC}, "Layout at the three widths").`;
// The picture of the prototype is of #app, so it holds more than the card.
const PROTOTYPE_REASON =
  " The prototype's picture is of #app, so it also holds the rounded frame and the link 'Back " +
  "to the normal view'";
const PROTOTYPE_NOTE =
  " and, in the code step, the note 'Prototype: no email is sent'; the app has not.";

const signInKnownDifferences: KnownDifference[] = (
  ["signin-email", "signin-code"] as const
).flatMap((screen) =>
  (["calm", "focus"] as const).flatMap((look) =>
    (["wide", "mid", "narrow"] as const).map((width) => ({
      id: `${screen}/${look}/${width}`,
      reason:
        (screen === "signin-email" ? EMAIL_STEP_REASON : CODE_STEP_REASON) +
        (width === "narrow" ? NARROW_REASON : "") +
        PROTOTYPE_REASON +
        (screen === "signin-code" ? PROTOTYPE_NOTE : "."),
      ticket: "accepted",
    })),
  ),
);

export const knownDifferences: KnownDifference[] = [
  ...adminKnownDifferences,
  ...signInKnownDifferences,
];
