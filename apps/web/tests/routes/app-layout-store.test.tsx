// @vitest-environment jsdom
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@toki/i18n/react";
import {
  markSignedIn,
  markSignedOut,
  reportUnauthenticated,
} from "@toki/client-core";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { SectionRow } from "../../src/layout/sections";
import { useShellPanel } from "../../src/shell/shell-slots";
import { AppShellRoute } from "../../src/routes/app-layout";
import { useSessionSets, type SessionSets } from "../../src/shell/session-sets";
import {
  channel,
  ME,
  person,
  useFakeStore,
  workspaceBody,
  type StoreHarness,
} from "../support/conversation-store";
import { user } from "../support/auth-harness";
import { fakeDevice } from "../support/pane-harness";

vi.mock("../../src/client", async () =>
  (await import("../support/conversation-store")).clientModule(),
);

const rows: SectionRow[] = [
  {
    id: "home",
    icon: "home",
    labelKey: "nav.home",
    to: "/",
    match: (p) => p === "/" || p.startsWith("/c/"),
    tab: true,
  },
  {
    id: "activity",
    icon: "home",
    labelKey: "nav.home",
    to: "/activity",
    match: (p) => p === "/activity",
    tab: true,
  },
];

const body = () =>
  workspaceBody(
    [
      channel("gen", "general", { isGeneral: true }),
      channel("a", "alpha"),
      channel("b", "beta"),
    ],
    [person("p2", "Alex"), person("p3", "Dee", "deactivated")],
  );

let h: StoreHarness;
let sets!: SessionSets;
let width = 1100;
const listeners = new Set<() => void>();
const signedIn = (id: string = ME) => markSignedIn({ ...user, id });

function Grab() {
  sets = useSessionSets();
  return null;
}
function PanelPage() {
  useShellPanel({
    label: "Details",
    content: <p data-testid="side-body">x</p>,
  });
  return null;
}

async function mount(
  path = "/",
  options: { strict?: boolean; panel?: boolean } = {},
) {
  const root = createRootRoute({
    component: () => (
      <I18nProvider language="en">
        <AppShellRoute rows={rows} />
      </I18nProvider>
    ),
  });
  const page = () => (
    <>
      <Grab />
      {options.panel ? <PanelPage /> : null}
    </>
  );
  const routeTree = root.addChildren([
    createRoute({ getParentRoute: () => root, path: "/", component: page }),
    createRoute({
      getParentRoute: () => root,
      path: "/activity",
      component: page,
    }),
    createRoute({
      getParentRoute: () => root,
      path: "/c/$conversationId",
      component: page,
    }),
  ]);
  const history = createMemoryHistory({ initialEntries: [path] });
  const router = createRouter({ routeTree, history });
  const tree = <RouterProvider router={router} />;
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(options.strict ? <StrictMode>{tree}</StrictMode> : tree);
  });
  return { router, history, view };
}

beforeEach(() => {
  width = 1100;
  listeners.clear();
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return query === "(max-width: 719px)" ? width < 720 : false;
    },
    media: query,
    addEventListener(_t: string, fn: () => void) {
      listeners.add(fn);
    },
    removeEventListener(_t: string, fn: () => void) {
      listeners.delete(fn);
    },
  }));
  fakeDevice();
  h = useFakeStore(body());
  signedIn();
});
afterEach(() => vi.unstubAllGlobals());

const clist = () => document.querySelector("div.clist")!;
const names = () =>
  [...document.querySelectorAll(".cr .nm")].map((n) => n.textContent);

describe("what the layout draws (R24)", () => {
  test("(a) before the load: header, search, chips and a busy div.clist with no row and no empty state", async () => {
    const release = h.holdNext();
    await mount();
    const list = within(screen.getByRole("complementary", { name: /./ }));
    expect(list.getByRole("heading", { name: "Conversations" })).toBeTruthy();
    expect(list.getByRole("searchbox")).toBeTruthy();
    expect(
      document.querySelectorAll(".cfilter button, .cfilter [role]").length,
    ).toBeGreaterThan(0);
    expect(clist()).toHaveAttribute("aria-busy", "true");
    expect(document.querySelector(".cr:not(.browse)")).toBeNull();
    expect(screen.queryByText("No conversations match")).toBeNull();
    // (c) no workspace while the store holds nothing
    expect(document.querySelector(".ws")).toBeNull();
    await act(async () => {
      release();
    });
  });

  test("a failed load draws the same and no empty state", async () => {
    h.answer(undefined as never);
    await mount();
    expect(h.store.getState().status).toBe("failed");
    expect(clist()).toHaveAttribute("aria-busy", "true");
    expect(document.querySelector(".cr:not(.browse)")).toBeNull();
    expect(screen.queryByText("No conversations match")).toBeNull();
  });

  test("after the load: the rows, the workspace and the head count of active people", async () => {
    await mount();
    expect(clist()).not.toHaveAttribute("aria-busy");
    expect(names()).toEqual(
      expect.arrayContaining(["general", "alpha", "beta"]),
    );
    expect(document.querySelector(".wsn")).toHaveTextContent("Acme");
    // Me and Alex are active; Dee is deactivated and is not counted.
    expect(document.querySelector(".wss")).toHaveTextContent("2 people");
  });

  test("a refresh keeps the rows and draws no aria-busy", async () => {
    await mount();
    const release = h.holdNext();
    let refreshing!: Promise<void>;
    await act(async () => {
      refreshing = h.store.refresh();
    });
    expect(names()).toContain("alpha");
    expect(clist()).not.toHaveAttribute("aria-busy");
    await act(async () => {
      release();
      await refreshing;
    });
    expect(names()).toContain("alpha");
  });

  test("(b) chatOpen at `/c/x` and not at `/`", async () => {
    const first = await mount("/c/a");
    expect(screen.getByTestId("shell")).toHaveAttribute("data-chat-open");
    first.view.unmount();
    await mount("/");
    expect(screen.getByTestId("shell")).not.toHaveAttribute("data-chat-open");
  });

  test("(d) no panel while no page owns it; a page that does opens it with its label", async () => {
    const first = await mount("/");
    expect(document.querySelector("aside.side")).toBeNull();
    first.view.unmount();
    await mount("/", { panel: true });
    const side = document.querySelector("aside.side")!;
    expect(side).toHaveAttribute("aria-label", "Details");
    expect(within(side as HTMLElement).getByTestId("side-body")).toBeTruthy();
  });
});

describe("the Home item (R23, R24 f)", () => {
  const home = () =>
    screen.getByRole("navigation").querySelector<HTMLElement>("a.ni")!;

  test("wide: Home at another section goes to #general with one push", async () => {
    const { router, history } = await mount("/activity");
    await userEvent.click(home());
    expect(router.state.location.pathname).toBe("/c/gen");
    expect(history.length).toBe(2);
  });

  test("wide: Home at the conversation it would open does nothing", async () => {
    const { router, history } = await mount("/c/gen");
    await userEvent.click(home());
    expect(router.state.location.pathname).toBe("/c/gen");
    expect(history.length).toBe(1);
  });

  test("wide: the last viewed conversation is the one Home opens", async () => {
    fakeDevice({
      "conversationList.lastViewed": JSON.stringify({ userId: ME, value: "b" }),
    });
    const { router } = await mount("/activity");
    await userEvent.click(home());
    expect(router.state.location.pathname).toBe("/c/b");
  });

  test("narrow: Home goes to `/` through the router", async () => {
    width = 360;
    const { router } = await mount("/activity");
    await userEvent.click(home());
    expect(router.state.location.pathname).toBe("/");
  });
});

describe("the life of the store (R32)", () => {
  let load: ReturnType<typeof vi.spyOn>;
  let reset: ReturnType<typeof vi.spyOn>;
  const calls: string[] = [];
  beforeEach(() => {
    calls.length = 0;
    load = vi.spyOn(h.store, "load").mockImplementation(() => {
      calls.push("load");
      return Promise.resolve();
    });
    reset = vi.spyOn(h.store, "reset").mockImplementation(() => {
      calls.push("reset");
    });
  });
  const real = async () => {
    load.mockRestore();
    reset.mockRestore();
  };

  test("first mount signed in calls load once", async () => {
    await mount();
    expect(calls).toEqual(["load"]);
  });

  test("a StrictMode remount does not call load twice", async () => {
    // The real store: the first `load()` makes it `loading`, which the second mount finds.
    await real();
    const loadSpy = vi.spyOn(h.store, "load");
    const resetSpy = vi.spyOn(h.store, "reset");
    await mount("/", { strict: true });
    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(resetSpy).not.toHaveBeenCalled();
  });

  test("a store that is ready for the same person is left alone", async () => {
    await real();
    await h.loadNow();
    const loadSpy = vi.spyOn(h.store, "load");
    const resetSpy = vi.spyOn(h.store, "reset");
    await mount();
    expect(loadSpy).not.toHaveBeenCalled();
    expect(resetSpy).not.toHaveBeenCalled();
  });

  test("a failed store is loaded again on mount", async () => {
    await real();
    h.answer(undefined as never);
    await h.loadNow();
    h.answer(body());
    const loadSpy = vi.spyOn(h.store, "load");
    await mount();
    expect(loadSpy).toHaveBeenCalledTimes(1);
  });

  test("a store of person A and a session of person B: reset, then load", async () => {
    await real();
    await h.loadNow();
    const order: string[] = [];
    vi.spyOn(h.store, "reset").mockImplementation(() => {
      order.push("reset");
    });
    vi.spyOn(h.store, "load").mockImplementation(() => {
      order.push("load");
      return Promise.resolve();
    });
    signedIn("someone-else");
    await mount();
    expect(order).toEqual(["reset", "load"]);
  });

  test("no load for a state other than signedIn", async () => {
    markSignedOut();
    await mount();
    expect(load).not.toHaveBeenCalled();
  });

  test("sign-out while mounted calls reset and no load", async () => {
    await mount();
    calls.length = 0;
    await act(async () => markSignedOut());
    expect(calls).toEqual(["reset"]);
  });

  test("a change from A to B while mounted calls reset, then load", async () => {
    await mount();
    calls.length = 0;
    await act(async () => signedIn("other"));
    expect(calls).toEqual(["reset", "load"]);
  });

  test("an ended session calls reset", async () => {
    await mount();
    calls.length = 0;
    await act(async () => reportUnauthenticated("session_ended"));
    expect(calls).toEqual(["reset"]);
  });

  test("unmounted while still signed in as the same person leaves the store as it is", async () => {
    await real();
    const { view } = await mount();
    await act(async () => {});
    const resetSpy = vi.spyOn(h.store, "reset");
    view.unmount();
    expect(resetSpy).not.toHaveBeenCalled();
    expect(h.store.getState().status).toBe("ready");
  });

  test("unmounted after the session left signedIn leaves a reset store", async () => {
    await real();
    const { view } = await mount();
    await act(async () => {});
    expect(h.store.getState().status).toBe("ready");
    markSignedOut();
    view.unmount();
    expect(h.store.getState().status).toBe("idle");
  });

  test("`seen` holds the ids while ready and is empty after a reset", async () => {
    await real();
    await mount();
    await act(async () => {});
    expect([...sets.seen].sort()).toEqual(["a", "b", "gen"]);
    sets.memberChecked.add("zzz");
    await act(async () => markSignedOut());
    expect(sets.seen.size).toBe(0);
    expect(sets.memberChecked.size).toBe(0);
  });
});
