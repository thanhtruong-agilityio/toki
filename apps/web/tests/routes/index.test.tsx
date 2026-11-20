// @vitest-environment jsdom
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { IndexRedirect } from "../../src/routes/index";
import {
  channel,
  ME,
  useFakeStore,
  workspaceBody,
  type StoreHarness,
} from "../support/conversation-store";
import { fakeDevice } from "../support/pane-harness";

vi.mock("../../src/client", async () =>
  (await import("../support/conversation-store")).clientModule(),
);

// A window of a given width: `matchMedia("(max-width: 719px)")` answers for it, and `setWidth` fires
// the change event the way a resize does.
function stubWidth(initial: number) {
  let width = initial;
  const listeners = new Set<() => void>();
  const media = (query: string) => ({
    get matches() {
      return query === "(max-width: 719px)" ? width < 720 : false;
    },
    media: query,
    addEventListener(_type: string, fn: () => void) {
      listeners.add(fn);
    },
    removeEventListener(_type: string, fn: () => void) {
      listeners.delete(fn);
    },
  });
  vi.stubGlobal("matchMedia", media);
  return async (next: number) => {
    width = next;
    await act(async () => {
      for (const fn of [...listeners]) fn();
    });
  };
}

const body = () =>
  workspaceBody([
    channel("gen", "general", { isGeneral: true }),
    channel("a", "alpha"),
  ]);

let h: StoreHarness;

async function mount(path = "/") {
  const root = createRootRoute({ component: () => <Outlet /> });
  const routeTree = root.addChildren([
    createRoute({
      getParentRoute: () => root,
      path: "/",
      component: () => (
        <>
          <p data-testid="index-body">index</p>
          <IndexRedirect />
        </>
      ),
    }),
    createRoute({
      getParentRoute: () => root,
      path: "/c/$conversationId",
      component: () => <p data-testid="page" />,
    }),
  ]);
  const history = createMemoryHistory({ initialEntries: [path] });
  const router = createRouter({ routeTree, history });
  await act(async () => {
    render(<RouterProvider router={router} />);
  });
  return { router, history };
}

beforeEach(() => {
  fakeDevice();
  h = useFakeStore(body());
});
afterEach(() => vi.unstubAllGlobals());

describe("the index route (R23)", () => {
  test("a wide window replaces `/` with #general once the store is ready, with state opening", async () => {
    stubWidth(1100);
    await h.loadNow();
    const { router, history } = await mount();
    expect(router.state.location.pathname).toBe("/c/gen");
    expect(router.state.location.state.opening).toBe(true);
    // a replace: no entry is left for `/`
    expect(history.length).toBe(1);
  });

  test("the last viewed conversation of the list wins over #general", async () => {
    stubWidth(1100);
    const device = fakeDevice({
      "conversationList.lastViewed": JSON.stringify({ userId: ME, value: "a" }),
    });
    expect(device.data.size).toBe(1);
    await h.loadNow();
    const { router } = await mount();
    expect(router.state.location.pathname).toBe("/c/a");
  });

  test("a wide window shows nothing and stays at `/` until the store is ready", async () => {
    stubWidth(1100);
    const hold = h.holdNext();
    const loading = h.store.load();
    const { router } = await mount();
    expect(router.state.location.pathname).toBe("/");
    hold();
    await act(async () => {
      await loading;
    });
    expect(router.state.location.pathname).toBe("/c/gen");
  });

  test("a store with no #general does not redirect", async () => {
    stubWidth(1100);
    h = useFakeStore(workspaceBody([channel("a", "alpha")]));
    await h.loadNow();
    const { router } = await mount();
    expect(router.state.location.pathname).toBe("/");
  });

  test("a narrow window does not redirect", async () => {
    stubWidth(360);
    await h.loadNow();
    const { router } = await mount();
    expect(router.state.location.pathname).toBe("/");
  });

  test("a window that goes from narrow to wide while at `/` redirects then", async () => {
    const setWidth = stubWidth(360);
    await h.loadNow();
    const { router } = await mount();
    expect(router.state.location.pathname).toBe("/");
    await setWidth(1100);
    expect(router.state.location.pathname).toBe("/c/gen");
  });
});
