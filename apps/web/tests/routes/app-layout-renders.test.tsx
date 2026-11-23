// @vitest-environment jsdom
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { act, render, screen } from "@testing-library/react";
import { I18nProvider } from "@toki/i18n/react";
import { markSignedIn } from "@toki/client-core";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { AppShellRoute } from "../../src/routes/app-layout";
import { useShellPanel } from "../../src/shell/shell-slots";
import {
  channel,
  ME,
  useFakeStore,
  workspaceBody,
} from "../support/conversation-store";
import { user } from "../support/auth-harness";
import { fakeDevice } from "../support/pane-harness";

vi.mock("../../src/client", async () =>
  (await import("../support/conversation-store")).clientModule(),
);

// The layout draws the pane as `list`, so a render of the layout is a render of this stand-in.
const paneRenders = vi.fn();
vi.mock("../../src/conversation-list/ConversationListPane", () => ({
  ConversationListPane: () => {
    paneRenders();
    return <p>pane</p>;
  },
}));

let bump!: () => void;
function Owner() {
  const [n, setN] = useState(0);
  bump = () => setN((v) => v + 1);
  useShellPanel({ label: "Details", content: <p data-testid="side">{n}</p> });
  return null;
}

describe("the panel slot costs no loop (R26)", () => {
  test("ten re-renders of the page that owns the panel render the layout at most twice", async () => {
    fakeDevice();
    await useFakeStore(
      workspaceBody([channel("gen", "general", { isGeneral: true })]),
    ).loadNow();
    markSignedIn({ ...user, id: ME });
    const root = createRootRoute({
      component: () => (
        <I18nProvider language="en">
          <AppShellRoute />
        </I18nProvider>
      ),
    });
    const router = createRouter({
      routeTree: root.addChildren([
        createRoute({
          getParentRoute: () => root,
          path: "/",
          component: Owner,
        }),
      ]),
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    await act(async () => {
      render(<RouterProvider router={router} />);
    });
    expect(screen.getByTestId("side")).toHaveTextContent("0");
    const before = paneRenders.mock.calls.length;
    for (let i = 0; i < 10; i += 1) await act(async () => bump());
    expect(screen.getByTestId("side")).toHaveTextContent("10");
    expect(paneRenders.mock.calls.length - before).toBeLessThanOrEqual(2);
  });
});
