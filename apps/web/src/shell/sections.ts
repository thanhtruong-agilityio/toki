import type { IconName } from "@toki/ui-web";
import type { MessageKey } from "@toki/i18n";

// The values of the session user's `role` (TOKI-004 R32).
export type Role = "member" | "admin";

// One row for each section that has a route. A ticket that builds a section adds
// its row here, in the order of the prototype's list, and its route under
// `appLayoutRoute` (R10, R30).
export type SectionRow = {
  id: string;
  icon: IconName;
  labelKey: MessageKey;
  to: string;
  match: (pathname: string) => boolean;
  // A row with no `roles` is for every role.
  roles?: Role[];
  tab?: boolean;
  more?: boolean;
  calmHidden?: boolean;
};

export const sections: SectionRow[] = [
  {
    id: "home",
    icon: "home",
    labelKey: "nav.home",
    to: "/",
    // `/c/:id` and `/c/:id/t/:messageId` are Home (technical design, Frontend).
    match: (pathname) => pathname === "/" || pathname.startsWith("/c/"),
    tab: true,
  },
];

// The rows a person sees. With no known role only the rows with no `roles` are
// drawn, so an Admin item is never drawn by default (R36).
export function visibleSections(role?: Role): SectionRow[] {
  return sections.filter(
    (row) => !row.roles || (role !== undefined && row.roles.includes(role)),
  );
}

// The id of the first row whose `match` is true for the path (R30).
export function currentSectionId(
  rows: ReadonlyArray<Pick<SectionRow, "id" | "match">>,
  pathname: string,
): string | undefined {
  return rows.find((row) => row.match(pathname))?.id;
}
