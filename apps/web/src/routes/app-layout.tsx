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
import { rootRoute } from "./__root";

// The one component that wires the shell to the app: translations, the section
// list, the router's navigation and the current path. The tickets that own the
// workspace, the account, the list and the panel extend it here (R30).
// `role` and `rows` are for tests: the route renders with none (no session
// state yet), and a test gives the role and the list it wants (R36).
export function AppShellRoute({
  role,
  rows: list,
}: { role?: Role; rows?: ReadonlyArray<SectionRow> } = {}) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // No session state exists yet (TOKI-023 adds it), so no role is known.
  const rows = visibleSections(role, list);
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
