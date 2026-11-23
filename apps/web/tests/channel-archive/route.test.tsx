// @vitest-environment jsdom
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@toki/i18n/react";
import { ToastProvider } from "@toki/ui-web";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ConversationRouteView } from "../../src/routes/conversation";
import {
  SessionSetsProvider,
  useSessionSets,
  type SessionSets,
} from "../../src/shell/session-sets";
import {
  detail,
  http,
  summary,
  useFakeApi,
  type FakeApiHarness,
} from "../support/conversation-api";
import { channel, workspaceBody } from "../support/conversation-store";
import { fakeDevice } from "../support/pane-harness";

vi.mock("../../src/client", async () =>
  (await import("../support/conversation-store")).clientModule(),
);

// A stand-in for the unjoined body that does what `UnjoinedChannel` does (TOKI-034 R16): it reads
// the channel when it mounts, so the answer reaches the store.
vi.mock("../../src/conversation/UnjoinedView", async () => {
  const { useEffect } = await import("react");
  const { conversations } = await import("../../src/client");
  return {
    UnjoinedView: (props: { channelId: string; onMember: () => void }) => {
      useEffect(() => {
        conversations.readChannel(props.channelId).catch(() => {});
      }, [props.channelId]);
      return (
        <div data-testid="unjoined">
          {props.channelId}
          <button onClick={props.onMember}>member</button>
        </div>
      );
    },
  };
});
vi.mock("../../src/conversation/ConversationPage", () => ({
  ConversationPage: (props: { conversationId: string }) => (
    <div data-testid="conversation-page">{props.conversationId}</div>
  ),
}));

let h: FakeApiHarness;
let sets!: SessionSets;
let router!: ReturnType<typeof createRouter>;

function Grab() {
  sets = useSessionSets();
  return null;
}

const listBody = (ids: string[]) =>
  workspaceBody([
    channel("gen", "general", { isGeneral: true }),
    ...ids.map((id) => channel(id, id)),
  ]);

async function mount(path: string) {
  const root = createRootRoute({
    component: () => (
      <I18nProvider>
        <ToastProvider>
          <SessionSetsProvider>
            <Grab />
            <Outlet />
          </SessionSetsProvider>
        </ToastProvider>
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
  router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  await act(async () => {
    render(<RouterProvider router={router} />);
  });
}

const flush = () => act(async () => {});
const archivedPage = () => screen.queryByTestId("archived-channel-page");
const ordinaryPage = () => screen.queryByTestId("conversation-page");
const here = () => router.state.location.pathname;

async function setup(
  ids: string[],
  server: Parameters<typeof detail>[2][] | Array<ReturnType<typeof detail>>,
) {
  fakeDevice();
  h = useFakeApi(listBody(ids), { details: server as never });
  await h.loadNow();
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("an archived channel the person belongs to (R13)", () => {
  test("(i) the Admin who archives stays on the address and sees the page, with no new history entry", async () => {
    await setup(["a"], [detail("a", "design")]);
    await mount("/c/a");
    act(() => sets.seen.add("a"));
    expect(ordinaryPage()).toHaveTextContent("a");
    const before = router.history.length;
    await act(async () => {
      await h.store.archiveChannel("a");
    });
    await flush();
    expect(archivedPage()).not.toBeNull();
    expect(ordinaryPage()).toBeNull();
    expect(here()).toBe("/c/a");
    expect(router.history.length).toBe(before);
  });

  test("(ii) a member who opens it from Browse: the read puts the detail in the store and the page draws", async () => {
    await setup([], [detail("x", "old", { archived: true })]);
    await mount("/c/x");
    await flush();
    expect(archivedPage()).not.toBeNull();
    expect(screen.queryByTestId("unjoined")).toBeNull();
    expect(here()).toBe("/c/x");
  });

  test("(ii) onMember before the read answers: at most one refresh, and the page ends up drawn", async () => {
    await setup([], [detail("x", "old", { archived: true })]);
    let release: () => void = () => {};
    h.api.channels.get.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ channel: h.details["x"] });
        }),
    );
    const calls = h.bootstrapCalls();
    await mount("/c/x");
    fireEvent.click(screen.getByText("member"));
    await flush();
    release();
    await flush();
    expect(archivedPage()).not.toBeNull();
    expect(h.bootstrapCalls() - calls).toBeLessThanOrEqual(1);
  });

  test("(iii) a reload at the address (nothing seen) ends on the page", async () => {
    await setup([], [detail("x", "old", { archived: true })]);
    await mount("/c/x");
    await flush();
    expect(archivedPage()).not.toBeNull();
  });

  test("(iv) a read that answers first: the page, no move", async () => {
    await setup(["a"], [detail("a", "design")]);
    await mount("/c/a");
    act(() => sets.seen.add("a"));
    h.details["a"] = detail("a", "design", { archived: true });
    await act(async () => {
      await h.store.readChannel("a");
    });
    await flush();
    expect(archivedPage()).not.toBeNull();
    expect(here()).toBe("/c/a");
  });

  test("(iv) a refresh that answers first leaves no detail: the person moves to #general", async () => {
    await setup(["a"], [detail("a", "design")]);
    await mount("/c/a");
    act(() => sets.seen.add("a"));
    h.answer(listBody([]));
    await act(async () => {
      await h.store.refresh();
    });
    await flush();
    expect(archivedPage()).toBeNull();
    expect(here()).toBe("/c/gen");
  });

  test("an id the store holds draws the ordinary page (case a wins), and so does it after a restore", async () => {
    await setup(["a"], [detail("a", "design")]);
    await mount("/c/a");
    act(() => sets.seen.add("a"));
    expect(ordinaryPage()).not.toBeNull();
    expect(archivedPage()).toBeNull();
    await act(async () => {
      await h.store.archiveChannel("a");
    });
    await flush();
    expect(archivedPage()).not.toBeNull();
    h.answer(listBody(["a"]));
    await act(async () => {
      await h.store.restoreChannel("a");
    });
    await flush();
    expect(ordinaryPage()).not.toBeNull();
    expect(archivedPage()).toBeNull();
  });
});

describe("what is decided as before", () => {
  test.each([
    [
      "a person who is not a member",
      () => summary("x", "old", { archived: true, isMember: false }),
    ],
    [
      "an active channel the person is not in",
      () => summary("x", "old", { archived: false, isMember: false }),
    ],
  ])("%s ends on the unjoined view", async (_name, make) => {
    await setup([], [make()]);
    await mount("/c/x");
    await flush();
    expect(screen.getByTestId("unjoined")).toBeInTheDocument();
    expect(archivedPage()).toBeNull();
  });

  test("an id that does not exist ends on the unjoined view", async () => {
    await setup([], []);
    h.api.channels.get.mockRejectedValue(http(404));
    await mount("/c/nope");
    await flush();
    expect(screen.getByTestId("unjoined")).toBeInTheDocument();
    expect(archivedPage()).toBeNull();
  });
});
