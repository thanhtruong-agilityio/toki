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

// The conversation page, the Details panel, Browse channels, New message and Preferences
// (TOKI-141), on the prototype's sample data (e2e/support/prototype-world.ts). Each reason says
// what stays different and why: a feature that is not built yet (with the ticket that builds it) or
// what a spec decided (with its requirement). A row that holds a difference that a ticket fixes
// names it too. The ticket is `accepted`: these rows stay known, because each also holds
// differences that are there for good, so none becomes "no longer a difference" when one is fixed.
const LIST_SPEC = "docs/specs/2026-11-17-conversation-list-design.md";
const SHELL_SPEC = "docs/specs/2026-11-16-app-shell-design.md";
const DETAILS_SPEC =
  "docs/specs/2026-11-17-conversation-header-details-design.md";
const PICKER_SPEC =
  "docs/specs/2026-11-17-browse-channels-people-picker-design.md";

// The sidebar is drawn on the screens of the shell: the conversation page and the Details panel.
const SIDEBAR_REASON =
  "The sidebar: the app draws the sections that have a route, which are Home and Admin, and not " +
  `the sections of later phases (${SHELL_SPEC}, "Not in phase 1"); the top search is the command ` +
  "palette (TOKI-071), the list has its own name search (" +
  `${LIST_SPEC}, R9); the '+' of the Direct messages heading and no pencil icon (the same spec, ` +
  "scope, D-154, D-155); the unread badges (TOKI-054) and the presence (TOKI-055) are not built; " +
  `no Owner role (${SHELL_SPEC}, D-152).`;
const CHANNEL_REASON =
  "The conversation page: the header is built, the rest is not: the message list (TOKI-041), the " +
  "composer (TOKI-043), the reactions (TOKI-046), the Pinned tab (TOKI-048) and the " +
  `Meet in progress (phase 4, ${LIST_SPEC}, scope). ` +
  SIDEBAR_REASON;
const DETAILS_REASON =
  `The Details panel: what the panel's spec decided (${DETAILS_SPEC}): the sections About, ` +
  "Members, Notifications, Settings and Leave (R12 to R21), the button Edit (R15) and, from " +
  "docs/specs/2026-11-17-add-remove-people-design.md, the buttons Add people and Remove; the " +
  "dates are written by formatDate, day before month (docs/specs/2026-11-16-date-time-rules-design.md, " +
  "R2); the job titles and the presence in the member rows are TOKI-057 and TOKI-055; the " +
  "sections Guests, Email this channel and Automations are phases 5 and 4 (the panel's spec, scope); the space above the " +
  "headings of the sections is fixed by TOKI-139. " +
  SIDEBAR_REASON +
  " The page behind the panel is the conversation page, with the differences above.";
const BROWSE_REASON =
  `Browse channels: what the dialogs' spec decided (${PICKER_SPEC}): a row holds the name, the ` +
  "topic and the member count (R6), the buttons Join and Open, no job title; a long topic hides " +
  "the member count, which TOKI-140 fixes; which channels the list holds is the data of the stub " +
  "of the check. The page behind the dialog is the conversation page, with the differences of " +
  "that screen.";
const NEW_MESSAGE_REASON =
  `New message: what the dialogs' spec decided (${PICKER_SPEC}): the list holds people and no ` +
  "channel, and the footer has the buttons Cancel and Start (R21); the job titles and the " +
  "presence in the rows are TOKI-057 and TOKI-055; the search box shows no hint, which TOKI-140 " +
  "fixes. The page behind the dialog is the conversation page, with the differences of that screen.";
const PREFS_SPEC = "docs/specs/2026-11-26-preferences-screen-design.md";
const PREFS_REASON =
  "Preferences: the page holds the section of the signed-in devices only. TOKI-078 builds Look, " +
  "Accent, Density, Language, Notifications (three switches), Pause, Your status and Profile " +
  `(${PREFS_SPEC}, R3 to R14), and leaves out 'Claude on this computer' (D-008), the switch ` +
  "'Email me about missed mentions' (D-016, phase 5) and every '(demo)' choice of the " +
  `prototype (${PREFS_SPEC}, R26). ` +
  SIDEBAR_REASON;

const appScreenKnownDifferences: KnownDifference[] = (
  [
    ["channel", CHANNEL_REASON, ["wide", "mid"]],
    ["details", DETAILS_REASON, ["wide", "mid"]],
    ["browse", BROWSE_REASON, ["wide", "mid"]],
    ["new-message", NEW_MESSAGE_REASON, ["wide", "mid"]],
    ["prefs", PREFS_REASON, ["wide", "mid", "narrow"]],
  ] as const
).flatMap(([screen, reason, widths]) =>
  (["calm", "focus"] as const).flatMap((look) =>
    widths.map((width) => ({
      id: `${screen}/${look}/${width}`,
      reason,
      ticket: "accepted",
    })),
  ),
);

export const knownDifferences: KnownDifference[] = [
  ...adminKnownDifferences,
  ...signInKnownDifferences,
  ...appScreenKnownDifferences,
];
