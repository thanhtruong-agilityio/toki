import {
  createRoute,
  Outlet,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useTranslation } from "@toki/i18n/react";
import {
  AppShell,
  useMenuTrigger,
  type NavSection,
  type UserCardAccount,
} from "@toki/ui-web";
import { AccountHost } from "../account/AccountHost";
import { accountDetail } from "../account/account-detail";
import { AccountEntriesProvider } from "../account/account-entries";
import { useSigningOut } from "../account/sign-out";
import { personHue } from "../people/person-hue";
import { useSession } from "../useSession";
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
// `role` and `rows` are for tests: the route reads the role of the signed-in
// person, and a test gives the role and the list it wants (R36).
export function AppShellRoute({
  role,
  rows: list,
}: { role?: Role; rows?: ReadonlyArray<SectionRow> } = {}) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const session = useSession();
  const user = session.status === "signedIn" ? session.user : null;
  const signingOut = useSigningOut();
  const trigger = useMenuTrigger<HTMLButtonElement>();
  const rows = visibleSections(role ?? (user?.role as Role | undefined), list);
  const navSections: NavSection[] = rows.map((row) => ({
    id: row.id,
    icon: row.icon,
    label: t(row.labelKey),
    href: row.to,
    tab: row.tab,
    more: row.more,
    calmHidden: row.calmHidden,
  }));
  // The card of the signed-in person (R1); with none, the shell draws no card.
  const account: UserCardAccount | undefined = user
    ? {
        label: t("account.menu.label"),
        name: user.displayName,
        hue: personHue(user.id),
        detail: signingOut ? t("account.signingOut") : accountDetail(user, t),
        triggerProps: {
          ...trigger.triggerProps,
          "aria-busy": signingOut ? true : undefined,
        },
      }
    : undefined;
  return (
    <AccountEntriesProvider>
      <AppShell
        account={account}
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
        {user ? <AccountHost menuProps={trigger.menuProps} /> : null}
      </AppShell>
    </AccountEntriesProvider>
  );
}

// A layout route: no path, the id `_app`. Every screen of the signed-in app is
// a child of it; `/login` and the not-found view stay outside (R30).
export const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "_app",
  component: AppShellRoute,
});
