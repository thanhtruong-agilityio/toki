import {
  createRoute,
  Outlet,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { getSessionState, subscribeSession } from "@toki/client-core";
import { useTranslation } from "@toki/i18n/react";
import { getPlatform } from "@toki/platform";
import {
  AppShell,
  useMenuTrigger,
  useNarrow,
  type NavSection,
  type UserCardAccount,
} from "@toki/ui-web";
import { useEffect, useMemo } from "react";
import { AccountHost } from "../account/AccountHost";
import { accountDetail } from "../account/account-detail";
import { AccountEntriesProvider } from "../account/account-entries";
import { useSigningOut } from "../account/sign-out";
import { conversations } from "../client";
import { ConversationListPane } from "../conversation-list/ConversationListPane";
import { viewFallback } from "../conversation-list/last-viewed";
import { ListActionsProvider } from "../conversation-list/list-actions";
import { useConversationSelector } from "../conversation-list/use-conversations";
import { personHue } from "../people/person-hue";
import { useSession } from "../useSession";
import {
  currentSectionId,
  visibleSections,
  type Role,
  type SectionRow,
} from "../layout/sections";
import {
  PanelOutlet,
  ShellSlotsProvider,
  useShellPanelState,
} from "../shell/shell-slots";
import { SessionSetsProvider, useSessionSets } from "../shell/session-sets";
import { rootRoute } from "./__root";

// The store's life (R32). Three parts, and the stored person decides, not the moment: (a) on mount,
// (b) while mounted, from the session state and not from a render, (c) on unmount, from the state at
// that moment. `reset()` is safe on an empty store and twice; `load()` never rejects, so it has no
// `catch`. `seen` and `memberChecked` are emptied at every reset and `seen` is filled at every change
// of a ready store (R21 (c)).
function useStoreLife(): void {
  const sets = useSessionSets();
  useEffect(() => {
    const reset = () => {
      conversations.reset();
      sets.clear();
    };
    const personOf = (): string | null => {
      const state = getSessionState();
      return state.status === "signedIn" ? state.user.id : null;
    };
    const held = (): string | undefined => conversations.getUser()?.id;

    // (a)
    const first = personOf();
    if (first !== null) {
      const mine = held();
      if (mine !== undefined && mine !== first) {
        reset();
        void conversations.load();
      } else {
        const { status } = conversations.getState();
        if (status === "idle" || status === "failed") {
          void conversations.load();
        }
      }
    }

    // (b)
    let last = first;
    const unsubscribe = subscribeSession(() => {
      const now = personOf();
      if (now === last) return;
      const before = last;
      last = now;
      if (before !== null) reset();
      if (now === null) return;
      if (before !== null) {
        void conversations.load();
        return;
      }
      const mine = held();
      if (mine !== undefined && mine !== now) reset();
      const { status } = conversations.getState();
      if (status === "idle" || status === "failed") void conversations.load();
    });

    // R21 (c): every id the store held while ready.
    // A store notification that leaves the conversations object as it was adds nothing to walk.
    let filled: object | null = null;
    const fill = () => {
      const state = conversations.getState();
      if (state.status !== "ready" || state.conversations === filled) return;
      filled = state.conversations;
      for (const id of Object.keys(state.conversations)) sets.seen.add(id);
    };
    fill();
    const unwatch = conversations.subscribe(fill);

    // (c)
    return () => {
      unwatch();
      unsubscribe();
      const state = getSessionState();
      const mine = held();
      if (
        state.status !== "signedIn" ||
        (mine !== undefined && mine !== state.user.id)
      ) {
        reset();
      }
    };
  }, [sets]);
}

// The one component that wires the shell to the app: translations, the section list, the router's
// navigation, the conversation list, the workspace, the side panel and the store's life (TOKI-015
// R30, TOKI-033 R24). `role` and `rows` are for tests: the route renders with none (no session
// state yet), and a test gives the role and the list it wants (R36).
function ShellBody({
  role,
  rows: list,
}: {
  role?: Role;
  rows?: ReadonlyArray<SectionRow>;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const narrow = useNarrow();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useStoreLife();
  const session = useSession();
  const user = session.status === "signedIn" ? session.user : null;
  const signingOut = useSigningOut();
  const trigger = useMenuTrigger<HTMLButtonElement>();

  const status = useConversationSelector((s) => s.getState().status);
  const workspace = useConversationSelector((s) => s.getWorkspace());
  const people = useConversationSelector((s) => s.getPeople());
  const activePeople = useMemo(
    () => people.filter((p) => p.status === "active").length,
    [people],
  );
  const shellWorkspace =
    !workspace || status === "idle" || status === "loading"
      ? undefined
      : {
          name: workspace.name,
          detail: t("conversationList.workspace.people", {
            count: activePeople,
          }),
        };

  const panel = useShellPanelState();
  const panelProps =
    panel === null ? {} : { panel: <PanelOutlet />, panelLabel: panel.label };

  const visible = visibleSections(
    role ?? (user?.role as Role | undefined),
    list,
  );
  const navSections: NavSection[] = visible.map((row) => ({
    id: row.id,
    icon: row.icon,
    label: t(row.labelKey),
    href: row.to,
    tab: row.tab,
    more: row.more,
    calmHidden: row.calmHidden,
  }));

  // The card of the signed-in person (TOKI-099 R1); with none, the shell draws no card.
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
        currentSection={currentSectionId(visible, pathname) ?? ""}
        list={<ConversationListPane />}
        chatOpen={pathname.startsWith("/c/")}
        workspace={shellWorkspace}
        {...panelProps}
        onNavigate={(section) => {
          // R23: Home on a window of 720 px or more opens the conversation to show, with one push, and
          // does nothing when it is already shown; a narrow window shows the list at `/`.
          if (section.id === "home" && !narrow) {
            const userId = conversations.getUser()?.id;
            const to =
              userId === undefined
                ? conversations.getGeneralId()
                : viewFallback(
                    getPlatform().storage.device,
                    userId,
                    conversations,
                  );
            if (to !== null) {
              if (pathname === `/c/${encodeURIComponent(to)}`) return;
              void router.navigate({
                to: "/c/$conversationId",
                params: { conversationId: to },
              });
              return;
            }
          }
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

export function AppShellRoute(
  props: {
    role?: Role;
    rows?: ReadonlyArray<SectionRow>;
  } = {},
) {
  return (
    <SessionSetsProvider>
      <ShellSlotsProvider>
        <ListActionsProvider>
          <ShellBody {...props} />
        </ListActionsProvider>
      </ShellSlotsProvider>
    </SessionSetsProvider>
  );
}

// A layout route: no path, the id `_app`. Every screen of the signed-in app is
// a child of it; `/login` and the not-found view stay outside (R30).
export const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "_app",
  component: AppShellRoute,
});
