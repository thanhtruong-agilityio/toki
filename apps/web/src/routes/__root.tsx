import {
  createRootRoute,
  Outlet,
  useMatches,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { markSignedOut } from "@toki/client-core";
import { SessionEndedModal, SignInTimeProvider } from "@toki/ui-web";
import { useEffect } from "react";
import { readSessionOnOpen } from "../auth/open-read";
import { sessionMemory } from "../auth/session-memory";
import { getAuthServices } from "../auth/services";
import { decideGuard } from "../guard";
import { useSession } from "../useSession";

declare module "@tanstack/react-router" {
  // The flag of R40: a route that carries `public` is let through by the guard for every session state
  // and gets no `next`. `/join` (TOKI-097) and `/emergency` (TOKI-026) set it; this ticket sets it on none.
  interface StaticDataRouteOption {
    public?: boolean;
  }
  // The address the sign-in page is filled in from, kept out of the address bar (R32).
  interface HistoryState {
    email?: string;
  }
}

// The guard (R1, R2, R40, R44), the cover of R24 to R27 and the time of the sign-in screens (R45).
function RootComponent() {
  const state = useSession();
  const router = useRouter();
  const location = useRouterState({ select: (s) => s.location });
  const isPublic = useMatches({
    select: (matches) => matches.some((m) => m.staticData?.public === true),
  });
  const { clock, timers } = getAuthServices();

  const decision = decideGuard({
    status: state.status,
    everSignedIn: sessionMemory.everSignedIn,
    pathname: location.pathname,
    href: location.href,
    next: (location.search as { next?: unknown }).next,
    isPublic,
    origin: window.location.origin,
  });

  // Toki is opened: ask the server once whether the browser has a session.
  useEffect(() => {
    if (state.status === "unknown") void readSessionOnOpen(isPublic);
  }, [state.status, isPublic]);

  const target =
    decision.action === "login"
      ? decision.next
      : decision.action === "leave"
        ? decision.to
        : null;
  const action = decision.action;
  useEffect(() => {
    if (action === "login" && target !== null) {
      void router.navigate({
        to: "/login",
        search: { next: target },
        replace: true,
      });
    } else if (action === "leave" && target !== null) {
      router.history.replace(target);
    }
  }, [router, action, target]);

  // 'Sign in again' (R25): `/login` with the address that was showing as `next`, and the email of the
  // person filled in. The address changes first, while the cover is still up, so the guard does not
  // send the person to `/login` a second time without the email.
  const signInAgain = async () => {
    const email = sessionMemory.lastUser?.email;
    await router.navigate({
      to: "/login",
      search: { next: router.state.location.href },
      state: email === undefined ? undefined : { email },
    });
    markSignedOut();
  };
  const useDifferentEmail = async () => {
    await router.navigate({ to: "/login", search: {} });
    markSignedOut();
  };

  return (
    <SignInTimeProvider clock={clock} timers={timers}>
      {decision.action === "allow" ? <Outlet /> : null}
      {state.status === "ended" ? (
        <SessionEndedModal
          form={state.reason === "expired" ? "ended" : "deactivated"}
          onSignInAgain={() => void signInAgain()}
          onUseDifferentEmail={
            sessionMemory.everSignedIn
              ? undefined
              : () => void useDifferentEmail()
          }
        />
      ) : null}
    </SignInTimeProvider>
  );
}

export const rootRoute = createRootRoute({
  component: RootComponent,
  notFoundComponent: () => <p>Page not found</p>,
});
