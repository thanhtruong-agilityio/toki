import { act, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import {
  createFakeCalls,
  createFakeEmergency,
  createFakeInvitation,
  createFakeTimers,
} from "./auth-harness";

// The session state of client-core is one value for the page and cannot go back to `unknown`, so every
// test loads the app anew: the modules of the workspace (the store, the router, the memory of the
// page) are made again, React and the router library stay.
export async function loadApp(
  options: {
    path?: string;
    language?: "en" | "vi";
    calls?: Parameters<typeof createFakeCalls>[0];
    emergency?: Parameters<typeof createFakeEmergency>[0];
    invitation?: Parameters<typeof createFakeInvitation>[0];
    /** The fragment of the address, as the browser had it when the Join page was opened. The page
     * takes it once when it loads (TOKI-097 R26); none means the address has no fragment. */
    token?: string;
    /** Extra routes under the root, for a test of the flag `public`. */
    extraRoutes?: boolean;
  } = {},
) {
  vi.resetModules();
  sessionStorage.clear();
  localStorage.clear();
  const [
    router,
    rootMod,
    client,
    shared,
    services,
    platform,
    platformWeb,
    i18n,
    rr,
    memory,
    openRead,
  ] = await Promise.all([
    import("../../src/router"),
    import("../../src/routes/__root"),
    import("@toki/client-core"),
    import("@toki/shared"),
    import("../../src/auth/services"),
    import("@toki/platform"),
    import("@toki/platform/web"),
    import("@toki/i18n/react"),
    import("@tanstack/react-router"),
    import("../../src/auth/session-memory"),
    import("../../src/auth/open-read"),
  ]);
  platform.setPlatform(platformWeb.createWebPlatform());
  memory.sessionMemory.reset();
  openRead.resetSessionOnOpen();

  const clock = shared.createTestClock();
  const timers = createFakeTimers(clock);
  const calls = createFakeCalls(options.calls);
  const emergency = createFakeEmergency(options.emergency);
  const invitation = createFakeInvitation(options.invitation);
  const order: string[] = [];
  const resetConversations = vi.fn(() => {
    order.push("reset");
  });
  services.setAuthServices({
    calls,
    emergency,
    invitation,
    resetConversations,
    clock,
    timers,
  });
  // The browser opened the Join link: the address holds the fragment until the page takes it (R26).
  // Other tests set their own address before they load the app.
  if (options.token !== undefined || options.path === "/join") {
    window.history.replaceState(
      null,
      "",
      `${options.path ?? "/"}${options.token ? `#${options.token}` : ""}`,
    );
    const joinToken = await import("../../src/join/join-token");
    joinToken.captureJoinToken(window);
  }

  let tree = router.routeTree;
  if (options.extraRoutes) {
    const join = rr.createRoute({
      getParentRoute: () => rootMod.rootRoute,
      path: "/public-probe",
      staticData: { public: true },
      component: () => <p data-testid="join-page">Probe</p>,
    });
    const children = router.routeTree.children as unknown as readonly unknown[];
    tree = rootMod.rootRoute.addChildren([...children, join] as never) as never;
  }
  const app = rr.createRouter({
    routeTree: tree,
    history: rr.createMemoryHistory({
      initialEntries: [options.path ?? "/"],
    }),
  });

  async function mount() {
    await act(async () => {
      render(
        <i18n.I18nProvider language={options.language ?? "en"}>
          <rr.RouterProvider router={app} />
        </i18n.I18nProvider>,
      );
    });
  }
  const settle = () => act(async () => {});

  return {
    router: app,
    calls,
    emergency,
    invitation,
    resetConversations,
    order,
    clock,
    timers,
    mount,
    settle,
    session: client,
    platform: platform.getPlatform(),
    screen,
    act,
    user: (await import("./auth-harness")).user,
  };
}
