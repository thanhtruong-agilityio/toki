// @vitest-environment jsdom
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  useParams,
  RouterProvider,
  type RouterHistory,
} from "@tanstack/react-router";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import {
  useDetailsPanel,
  validatePanelSearch,
} from "../../src/conversation/useDetailsPanel";

// The route of the real app, in a memory router: the same `validateSearch`, a stand-in body.
function Body() {
  const { conversationId } = useParams({ strict: false }) as {
    conversationId: string;
  };
  const { open, openDetails, closeDetails } = useDetailsPanel(conversationId);
  return (
    <div>
      <p data-testid="state">{open ? "open" : "closed"}</p>
      <button onClick={openDetails}>open</button>
      <button onClick={closeDetails}>close</button>
      <Link to="/c/$conversationId" params={{ conversationId: "b" }}>
        other
      </Link>
    </div>
  );
}

function makeRouter(history: RouterHistory) {
  const root = createRootRoute({ component: Outlet });
  const tree = root.addChildren([
    createRoute({
      getParentRoute: () => root,
      path: "/",
      component: () => <p>list</p>,
    }),
    createRoute({
      getParentRoute: () => root,
      path: "/c/$conversationId",
      validateSearch: validatePanelSearch,
      component: Body,
    }),
  ]);
  return createRouter({ routeTree: tree, history });
}

async function mount(history: RouterHistory) {
  const router = makeRouter(history);
  await act(async () => {
    render(<RouterProvider router={router} />);
  });
  return router;
}

const memory = (entries: string[], initialIndex?: number) =>
  createMemoryHistory({ initialEntries: entries, initialIndex });

const here = (router: Awaited<ReturnType<typeof mount>>) => ({
  path: router.state.location.pathname,
  search: router.state.location.search,
  index: (router.state.location.state as { __TSR_index: number }).__TSR_index,
});

const state = () => screen.getByTestId("state").textContent;

describe("validatePanelSearch (R8)", () => {
  test("keeps panel=details and drops every other value or key", () => {
    expect(validatePanelSearch({ panel: "details" })).toEqual({
      panel: "details",
    });
    expect(validatePanelSearch({ panel: "other" })).toEqual({});
    expect(validatePanelSearch({ panel: ["details"] })).toEqual({});
    expect(validatePanelSearch({ x: 1 })).toEqual({});
    expect(validatePanelSearch({})).toEqual({});
  });
});

describe("opening (R8)", () => {
  test("a press pushes one entry with the search and the flag", async () => {
    const router = await mount(memory(["/c/a"]));
    expect(state()).toBe("closed");
    await userEvent.click(screen.getByText("open"));
    expect(state()).toBe("open");
    expect(here(router)).toEqual({
      path: "/c/a",
      search: { panel: "details" },
      index: 1,
    });
    expect(router.state.location.state.detailsPushed).toBe(true);
    expect(router.history.length).toBe(2);
  });

  test("?panel=other shows no panel", async () => {
    const router = await mount(memory(["/c/a?panel=other"]));
    expect(state()).toBe("closed");
    // The parameter itself is dropped by validateSearch (the test above); here it opens nothing.
    expect(router.state.location.pathname).toBe("/c/a");
  });

  test("an address with the parameter shows the panel", async () => {
    await mount(memory(["/c/a?panel=details"]));
    expect(state()).toBe("open");
  });

  test("opening another conversation closes the panel; Back returns to the first with it open and one more Back closes it", async () => {
    const router = await mount(memory(["/c/a"]));
    await userEvent.click(screen.getByText("open"));
    await userEvent.click(screen.getByText("other"));
    expect(here(router).path).toBe("/c/b");
    expect(state()).toBe("closed");

    await act(async () => router.history.back());
    expect(here(router)).toMatchObject({
      path: "/c/a",
      search: { panel: "details" },
    });
    expect(state()).toBe("open");

    await userEvent.click(screen.getByText("close"));
    expect(here(router)).toEqual({ path: "/c/a", search: {}, index: 0 });
    expect(state()).toBe("closed");
  });
});

describe("closing (R9)", () => {
  test("Close of an entry the app pushed goes back one entry", async () => {
    const router = await mount(memory(["/c/a"]));
    await userEvent.click(screen.getByText("open"));
    await userEvent.click(screen.getByText("close"));
    expect(here(router)).toEqual({ path: "/c/a", search: {}, index: 0 });
    expect(state()).toBe("closed");
  });

  test("browser Back on an open panel ends on the conversation, one entry back", async () => {
    const router = await mount(memory(["/c/a"]));
    await userEvent.click(screen.getByText("open"));
    await act(async () => router.history.back());
    expect(here(router)).toEqual({ path: "/c/a", search: {}, index: 0 });
    expect(state()).toBe("closed");
  });

  test("a link with the parameter and no state is closed by replace: no entry is added or lost", async () => {
    const router = await mount(memory(["/c/a?panel=details"]));
    expect(router.state.location.state.detailsPushed).toBeUndefined();
    await userEvent.click(screen.getByText("close"));
    expect(here(router)).toEqual({ path: "/c/a", search: {}, index: 0 });
    expect(router.history.length).toBe(1);
    expect(state()).toBe("closed");
  });

  test("a reload keeps the panel open and keeps the state, so Close still goes back", async () => {
    const history = memory(["/c/a"]);
    const first = await mount(history);
    await userEvent.click(screen.getByText("open"));
    expect(first.state.location.state.detailsPushed).toBe(true);
    document.body.innerHTML = "";
    const again = await mount(history);
    expect(state()).toBe("open");
    await userEvent.click(screen.getByText("close"));
    expect(here(again)).toEqual({ path: "/c/a", search: {}, index: 0 });
  });

  test("after two opens and two closes the history is where it started", async () => {
    const router = await mount(memory(["/c/a"]));
    for (let i = 0; i < 2; i += 1) {
      await userEvent.click(screen.getByText("open"));
      await userEvent.click(screen.getByText("close"));
    }
    expect(here(router).index).toBe(0);
    expect(state()).toBe("closed");
  });
});
