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
  // The order of the prototype's list is people, admin, preferences (TOKI-025 R2), so the row does
  // not depend on which ticket merges first: People (TOKI-079) goes before it and Preferences
  // (TOKI-099) after it.
  {
    id: "admin",
    icon: "shield",
    labelKey: "nav.admin",
    to: "/admin",
    match: (pathname) =>
      pathname === "/admin" || pathname.startsWith("/admin/"),
    roles: ["admin"],
    more: true,
  },
  // Preferences (TOKI-099 R21). Calm hides it and reaches it through the account menu; the Focus
  // rail and the More sheet show it. Rows that come later (people, admin) are inserted above this
  // one: the prototype's order is home, people, admin, preferences (line 1199).
  {
    id: "preferences",
    icon: "settings",
    labelKey: "nav.preferences",
    to: "/prefs",
    match: (pathname) => pathname.startsWith("/prefs"),
    calmHidden: true,
    more: true,
  },
];

// The rows a person sees. With no known role only the rows with no `roles` are
// drawn, so an Admin item is never drawn by default (R36).
// `rows` is the list to filter; the shell fixture (R32) passes its own.
export function visibleSections(
  role?: Role,
  rows: ReadonlyArray<SectionRow> = sections,
): SectionRow[] {
  return rows.filter(
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
