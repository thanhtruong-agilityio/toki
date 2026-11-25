import type { KnownDifference } from "../support/parity-reporter";

// Differences that the reviewer has accepted (TOKI-109 R4). One entry for each: the row name that
// the report shows (a property with its combination, or a screen with look and width), the
// reason, and the ticket that will fix it or the word `accepted`. An entry that no longer matches
// a real difference is listed in the report as "no longer a difference: remove the entry".
export const knownDifferences: KnownDifference[] = [];
