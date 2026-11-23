// @vitest-environment jsdom
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@toki/i18n/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ConversationRouteView } from "../../src/routes/conversation";
import {
  SessionSetsProvider,
  useSessionSets,
  type SessionSets,
} from "../../src/shell/session-sets";
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

// Stand-ins that show which branch drew, and give the test the three callbacks and `onBack`.
vi.mock("../../src/conversation/UnjoinedView", () => ({
  UnjoinedView: (props: {
    channelId: string;
    onJoined: (id: string) => void;
    onMember: (detail: unknown) => void;
    onNotFound: () => void;
  }) => (
    <div data-testid="unjoined">
      {props.channelId}
      <button onClick={() => props.onJoined(props.channelId)}>joined</button>
      <button onClick={() => props.onMember({})}>member</button>
      <button onClick={() => props.onNotFound()}>notfound</button>
    </div>
  ),
}));
vi.mock("../../src/conversation/ConversationPage", () => ({
  ConversationPage: (props: { conversationId: string; onBack: () => void }) => (
    <div data-testid="conversation-page">
      {props.conversationId}
      <button onClick={props.onBack}>back</button>
    </div>
  ),
}));

const body = (ids: string[] = ["a", "b"]) =>
  workspaceBody([
    channel("gen", "general", { isGeneral: true }),
    ...ids.map((id) => channel(id, id)),
  ]);

let h: StoreHarness;
let sets!: SessionSets;
let device: ReturnType<typeof fakeDevice>;

function Grab() {
  sets = useSessionSets();
  return null;
}

async function mount(path: string) {
  const root = createRootRoute({
    component: () => (
      <I18nProvider>
        <SessionSetsProvider>
          <Grab />
          <Outlet />
        </SessionSetsProvider>
      </I18nProvider>
    ),
  });
  const routeTree = root.addChildren([
    createRoute({
      getParentRoute: () => root,
      path: "/",
      component: () => <p data-testid="list">list</p>,
    }),
    createRoute({
      getParentRoute: () => root,
      path: "/c/$conversationId",
      component: ConversationRouteView,
    }),
  ]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  await act(async () => {
    render(<RouterProvider router={router} />);
  });
  return router;
}

beforeEach(async () => {
  device = fakeDevice();
  h = useFakeStore(body());
  await h.loadNow();
});

describe("the route /c/$conversationId (R21)", () => {
  test("(a) an id of the list draws the page and is written as last viewed", async () => {
    await mount("/c/a");
    expect(screen.getByTestId("conversation-page")).toHaveTextContent("a");
    expect(JSON.parse(device.data.get("conversationList.lastViewed")!)).toEqual(
      { userId: ME, value: "a" },
    );
    expect(screen.queryByTestId("unjoined")).toBeNull();
  });

  test("a store that has not loaded draws nothing and does not redirect", async () => {
    h = useFakeStore(body());
    const router = await mount("/c/zzz");
    expect(screen.queryByTestId("unjoined")).toBeNull();
    expect(screen.queryByTestId("conversation-page")).toBeNull();
    expect(router.state.location.pathname).toBe("/c/zzz");
  });

  test("a failed store draws nothing", async () => {
    const failing = useFakeStore(body());
    failing.answer(undefined as never);
    await failing.loadNow();
    expect(failing.store.getState().status).toBe("failed");
    const router = await mount("/c/a");
    expect(screen.queryByTestId("conversation-page")).toBeNull();
    expect(screen.queryByTestId("unjoined")).toBeNull();
    expect(router.state.location.pathname).toBe("/c/a");
  });

  test("a refresh in progress keeps the page", async () => {
    await mount("/c/a");
    const release = h.holdNext();
    let refreshing!: Promise<void>;
    act(() => {
      refreshing = h.store.refresh();
    });
    expect(h.store.getState().isRefreshing).toBe(true);
    expect(screen.getByTestId("conversation-page")).toBeTruthy();
    release();
    await act(async () => void (await refreshing));
    expect(screen.getByTestId("conversation-page")).toBeTruthy();
  });

  describe("(b) an id that was never in the list", () => {
    test("draws UnjoinedView with the id and requests no message", async () => {
      await mount("/c/nope");
      expect(screen.getByTestId("unjoined")).toHaveTextContent("nope");
      expect(h.bootstrapCalls()).toBe(1);
    });

    test("onJoined needs nothing: when the store holds the conversation the page draws", async () => {
      await mount("/c/new");
      h.answer(body(["a", "b", "new"]));
      await act(async () => void (await h.store.refresh()));
      expect(screen.getByTestId("conversation-page")).toHaveTextContent("new");
      expect(screen.queryByTestId("unjoined")).toBeNull();
    });

    test("onMember adds the id to memberChecked and refreshes once; when the store then holds it the page draws", async () => {
      await mount("/c/new");
      h.answer(body(["a", "b", "new"]));
      await userEvent.click(screen.getByText("member"));
      expect(sets.memberChecked.has("new")).toBe(true);
      expect(h.bootstrapCalls()).toBe(2);
      expect(screen.getByTestId("conversation-page")).toHaveTextContent("new");
    });

    test("onMember for an id the refresh does not add ends in the not-found view after one refresh, with no second UnjoinedView and no second onMember", async () => {
      await mount("/c/archived");
      await userEvent.click(screen.getByText("member"));
      expect(h.bootstrapCalls()).toBe(2);
      expect(screen.queryByTestId("unjoined")).toBeNull();
      expect(screen.getByText("Page not found")).toBeTruthy();
      expect(sets.memberChecked.has("archived")).toBe(true);
      expect(h.bootstrapCalls()).toBe(2);
    });

    test("an id already in memberChecked draws the not-found view at once", async () => {
      const router = await mount("/c/x");
      act(() => sets.memberChecked.add("y"));
      await act(async () => {
        await router.navigate({
          to: "/c/$conversationId",
          params: { conversationId: "y" },
        });
      });
      expect(screen.queryByTestId("unjoined")).toBeNull();
      expect(screen.getByText("Page not found")).toBeTruthy();
    });

    test("onNotFound draws the not-found view", async () => {
      await mount("/c/nope");
      await userEvent.click(screen.getByText("notfound"));
      expect(screen.getByText("Page not found")).toBeTruthy();
      expect(screen.queryByTestId("unjoined")).toBeNull();
    });
  });

  describe("(c) an id that was in the list and no longer is", () => {
    test("an id in `seen` is replaced by the fallback and shows no error", async () => {
      const router = await mount("/c/a");
      act(() => sets.seen.add("a"));
      h.answer(body(["b"]));
      await act(async () => void (await h.store.refresh()));
      expect(router.state.location.pathname).toBe("/c/gen");
      expect(screen.getByTestId("conversation-page")).toHaveTextContent("gen");
      expect(screen.queryByText("Page not found")).toBeNull();
      // a replace: the entry of the removed conversation is gone, not kept under the new one
      expect(router.history.length).toBe(1);
    });

    test("the fallback is the last viewed conversation when it is still in the list", async () => {
      device.data.set(
        "conversationList.lastViewed",
        JSON.stringify({ userId: ME, value: "b" }),
      );
      const router = await mount("/c/a");
      // The page of `a` wrote `a` as last viewed; `b` was viewed before, so write it back.
      device.data.set(
        "conversationList.lastViewed",
        JSON.stringify({ userId: ME, value: "b" }),
      );
      act(() => sets.seen.add("a"));
      h.answer(body(["b"]));
      await act(async () => void (await h.store.refresh()));
      expect(router.state.location.pathname).toBe("/c/b");
    });

    test("an id that was never seen is not replaced", async () => {
      const router = await mount("/c/ghost");
      expect(router.state.location.pathname).toBe("/c/ghost");
      expect(screen.getByTestId("unjoined")).toBeTruthy();
    });
  });

  describe("onBack", () => {
    test("with the flag it goes back in the history", async () => {
      const router = await mount("/");
      await act(async () => {
        await router.navigate({
          to: "/c/$conversationId",
          params: { conversationId: "a" },
          state: { fromList: true },
        });
      });
      const back = vi.spyOn(router.history, "back");
      await userEvent.click(screen.getByText("back"));
      await act(async () => {});
      expect(back).toHaveBeenCalledTimes(1);
      expect(router.state.location.pathname).toBe("/");
      expect(screen.getByTestId("list")).toBeTruthy();
    });

    test("with no flag it replaces the entry with /", async () => {
      const router = await mount("/c/a");
      await act(async () => {
        await router.navigate({
          to: "/c/$conversationId",
          params: { conversationId: "b" },
        });
      });
      const back = vi.spyOn(router.history, "back");
      await userEvent.click(screen.getByText("back"));
      await act(async () => {});
      expect(back).not.toHaveBeenCalled();
      expect(router.state.location.pathname).toBe("/");
      // the entry of b was replaced, so Back lands on a, not on b
      act(() => router.history.back());
      await act(async () => {});
      expect(router.state.location.pathname).toBe("/c/a");
    });
  });
});
