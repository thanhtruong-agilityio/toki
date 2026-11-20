import {
  createRoute,
  Outlet,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useTranslation } from "@toki/i18n/react";
import { AppShell, type NavSection } from "@toki/ui-web";
import {
  currentSectionId,
  visibleSections,
  type Role,
  type SectionRow,
} from "../layout/sections";
import { useSession } from "../useSession";
import { rootRoute } from "./__root";

// The one component that wires the shell to the app: translations, the section
// list, the router's navigation and the current path. The tickets that own the
// workspace, the account, the list and the panel extend it here (R30).
// `role` and `rows` are for tests: the route renders with none and reads the role from the
// session, and a test gives the role and the list it wants (R36).
export function AppShellRoute({
  role,
  rows: list,
}: { role?: Role; rows?: ReadonlyArray<SectionRow> } = {}) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // The role is the session's (TOKI-025 R2): with no session no role is known, so a role-only
  // row such as Admin is not drawn. The server repeats every check, so this only shapes the screen.
  const session = useSession();
  const sessionRole =
    session.status === "signedIn" ? session.user.role : undefined;
  const rows = visibleSections(role ?? sessionRole, list);
  const navSections: NavSection[] = rows.map((row) => ({
    id: row.id,
    icon: row.icon,
    label: t(row.labelKey),
    href: row.to,
    tab: row.tab,
    more: row.more,
    calmHidden: row.calmHidden,
  }));
  return (
    <AppShell
      sections={navSections}
      currentSection={currentSectionId(rows, pathname) ?? ""}
      onNavigate={(section) => {
        void router.navigate({ to: section.href });
      }}
      labels={{
        mainNavigation: t("nav.mainLabel"),
        conversations: t("nav.conversations"),
      }}
    >
      <Outlet />
    </AppShell>
  );
}

// A layout route: no path, the id `_app`. Every screen of the signed-in app is
// a child of it; `/login` and the not-found view stay outside (R30).
export const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "_app",
  component: AppShellRoute,
});
