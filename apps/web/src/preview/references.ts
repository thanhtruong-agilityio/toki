// The lines of the prototype (docs/blueprint/prototype/index.html of the Toki
// Blueprint) that each section is compared with: Table D of the spec. A key is
// a section's name; a component the prototype does not draw has the value
// "none" (PersonChip, added by TOKI-034). The preview
// page reads this object and keeps no list of components of its own (R17).
export const references: Record<string, string> = {
  Button: "82-93, 309, 714",
  IconButton: "94-97",
  Chip: "98-101, 185",
  Switch: "338-341",
  Field: "186-189, 345-348, 715, 716",
  Select: "344, 701",
  Tag: "121",
  Badge: "102-104, 586",
  Avatar: "115-120, 529, 599-600",
  PresenceDot: "115-120, 599-600",
  EmptyState: "363-366",
  Toast: "419-423",
  Menu: "410-416, 538, 2103-2112, 2129",
  Modal: "404-409, 560-561, 2134, 2142, 2152, 2196",
  Sheet: "2155 (no CSS rule in the prototype: TOKI-014 Table B, decided)",
  PersonChip: "none",
  ConfirmDialog:
    "none: the prototype draws an inline row (lines 1369 and 1452), no dialog",
  tokens:
    "6-56, without the six Meet variables --stage, --stage-bar, --stage-ink, --stage-line, --stage-muted and --tile that TOKI-009 R18 leaves out",
  icons: "the ICONS table at about line 835",
  fonts:
    "the font link of the prototype's head; the families in TOKI-010 Table A",
};

export const MISSING_REFERENCE = "No prototype reference recorded";

// A section with no key says so, and the browser test fails on it.
export function referenceFor(
  section: string,
  table: Record<string, string> = references,
): string {
  return Object.hasOwn(table, section) ? table[section]! : MISSING_REFERENCE;
}
