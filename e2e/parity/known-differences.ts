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

export const knownDifferences: KnownDifference[] = (
  ["calm", "focus"] as const
).flatMap((look) =>
  (["wide", "mid", "narrow"] as const).map((width) => ({
    id: `admin/${look}/${width}`,
    reason: ADMIN_REASON,
    ticket: "accepted",
  })),
);
