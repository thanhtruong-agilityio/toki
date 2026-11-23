// @vitest-environment jsdom
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { ApiError, markSignedIn } from "@toki/client-core";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@toki/i18n/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ConversationRouteView } from "../../src/routes/conversation";
import { validatePanelSearch } from "../../src/conversation/useDetailsPanel";
import { AppShellRoute } from "../../src/routes/app-layout";
import { user } from "../support/auth-harness";
import {
  detail,
  useFakeApi,
  type FakeApiHarness,
} from "../support/conversation-api";
import { channel, ME, workspaceBody } from "../support/conversation-store";
import { fakeDevice } from "../support/pane-harness";

vi.mock("../../src/client", async () =>
  (await import("../support/conversation-store")).clientModule(),
);
vi.mock("../../src/conversation-list/ConversationListPane", () => ({
  ConversationListPane: () => <p>pane</p>,
}));

let h: FakeApiHarness;

// The real shell route, the real conversation route and the real page: the panel is drawn from the
// shell's slot, and the shell route fills the set of ids the route moves on from.
async function mountReal(path: string) {
  fakeDevice();
  markSignedIn({ ...user, id: ME });
  const root = createRootRoute({
    component: () => (
      <I18nProvider language="en">
        <AppShellRoute />
      </I18nProvider>
    ),
  });
  const routeTree = root.addChildren([
    createRoute({
      getParentRoute: () => root,
      path: "/c/$conversationId",
      validateSearch: validatePanelSearch,
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
  h = useFakeApi(
    workspaceBody([
      channel("gen", "general", { isGeneral: true }),
      channel("c1", "project-launch"),
      channel("c2", "leadership", { isPrivate: true }),
    ]),
    {
      details: [
        detail("gen", "general", { isGeneral: true }),
        detail("c1", "project-launch", { memberCount: 3 }),
        detail("c2", "leadership", { isPrivate: true, memberCount: 3 }),
      ],
    },
  );
  await h.loadNow();
});

const leave = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Leave channel" }));
  await act(async () => {});
};

describe("after a leave (R25)", () => {
  test("a public leave ends at #general with the panel closed and the history not grown; Undo does not move the router", async () => {
    const router = await mountReal("/c/c1?panel=details");
    expect(document.querySelector("#conversation-details")).not.toBeNull();
    await leave();
    expect(router.state.location.pathname).toBe("/c/gen");
    expect(router.state.location.search).toEqual({});
    expect(router.history.length).toBe(1);
    expect(document.querySelector("#conversation-details")).toBeNull();
    expect(h.api.channels.leave).toHaveBeenCalledWith("c1");

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await act(async () => {});
    expect(h.api.channels.join.mock.calls[0][0]).toBe("c1");
    expect(router.state.location.pathname).toBe("/c/gen");
  });

  test("a confirmed private leave ends the same way", async () => {
    const router = await mountReal("/c/c2?panel=details");
    await leave();
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    await act(async () => {});
    expect(router.state.location.pathname).toBe("/c/gen");
    expect(router.state.location.search).toEqual({});
    expect(router.history.length).toBe(1);
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });

  test("a 403 on a write makes the page draw the not-found view and refresh the store", async () => {
    const router = await mountReal("/c/c1?panel=details");
    const calls = h.bootstrapCalls();
    h.api.conversations.saveSettings.mockRejectedValueOnce(
      new ApiError({ kind: "http", status: 403 }),
    );
    fireEvent.click(screen.getByRole("switch", { name: "Mute conversation" }));
    await act(async () => {});
    expect(screen.getByText("Page not found")).toBeInTheDocument();
    expect(screen.queryByTestId("conversation-page")).toBeNull();
    expect(h.bootstrapCalls()).toBe(calls + 1);
    expect(document.querySelector("#conversation-details")).toBeNull();
    expect(router.state.location.pathname).toBe("/c/c1");
  });
});
