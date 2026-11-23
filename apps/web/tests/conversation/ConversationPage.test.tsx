// @vitest-environment jsdom
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { markSignedIn } from "@toki/client-core";
import { I18nProvider } from "@toki/i18n/react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ConversationPage } from "../../src/conversation/ConversationPage";
import { validatePanelSearch } from "../../src/conversation/useDetailsPanel";
import { AppShellRoute } from "../../src/routes/app-layout";
import { user } from "../support/auth-harness";
import {
  detail,
  http,
  useFakeApi,
  type FakeApiHarness,
} from "../support/conversation-api";
import { mountConversation } from "../support/conversation-mount";
import {
  channel,
  dm,
  ME,
  person,
  workspaceBody,
} from "../support/conversation-store";
import { fakeDevice } from "../support/pane-harness";

vi.mock("../../src/client", async () =>
  (await import("../support/conversation-store")).clientModule(),
);
vi.mock("../../src/conversation-list/ConversationListPane", () => ({
  ConversationListPane: () => <p>pane</p>,
}));

let h: FakeApiHarness;

beforeEach(async () => {
  h = useFakeApi(
    workspaceBody(
      [channel("c1", "general"), dm("d1", "p1")],
      [person("p1", "Alex Phạm")],
    ),
    { details: [detail("c1", "general")] },
  );
  await h.loadNow();
});

const page = (id: string, onBack = () => {}) =>
  mountConversation(
    (cid) => <ConversationPage conversationId={cid} onBack={onBack} />,
    {
      path: `/c/${id}`,
    },
  );

describe("the page keeps the seam of TOKI-033 (R21)", () => {
  test("draws one element with the test id and the name in an h1", async () => {
    await page("c1");
    const element = screen.getByTestId("conversation-page");
    expect(element.querySelector("h1")).toHaveTextContent("general");
    expect(element.querySelector("main")).toBeNull();
  });

  test("a direct message is named with the other person", async () => {
    await page("d1");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Alex Phạm",
    );
  });

  test("the header's Back button calls onBack", async () => {
    const onBack = vi.fn();
    await page("c1", onBack);
    await userEvent.click(
      screen.getByRole("button", { name: "Back to conversations" }),
    );
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

// The page inside the real shell route: the panel goes to the shell's slot (R10).
async function inShell(path: string) {
  fakeDevice();
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
        component: () => <p data-testid="home">home</p>,
      }),
      createRoute({
        getParentRoute: () => root,
        path: "/c/$conversationId",
        validateSearch: validatePanelSearch,
        component: function Body() {
          return <ConversationPage conversationId="c1" onBack={() => {}} />;
        },
      }),
    ]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(<RouterProvider router={router} />);
  });
  return { router, view };
}

describe("the panel in the shell's slot (R10, R11)", () => {
  test("closed: the shell has no panel", async () => {
    await inShell("/c/c1");
    expect(screen.getByTestId("shell")).not.toHaveAttribute("data-panel");
  });

  test("panel=details: the shell shows the side pane with the panel named Conversation details", async () => {
    await inShell("/c/c1?panel=details");
    const shell = screen.getByTestId("shell");
    expect(shell).toHaveAttribute("data-panel");
    expect(shell).toHaveAttribute("data-pane", "side");
    expect(
      within(shell).getByRole("complementary", {
        name: "Conversation details",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Details" }),
    ).toBeInTheDocument();
    expect(document.getElementById("conversation-details")).not.toBeNull();
  });

  test("a press on the members button opens it, Close and the members button close it", async () => {
    const { router } = await inShell("/c/c1");
    await userEvent.click(
      screen.getByRole("button", { name: "Members and details" }),
    );
    expect(screen.getByTestId("shell")).toHaveAttribute("data-panel");
    await userEvent.click(screen.getByRole("button", { name: "Close panel" }));
    expect(screen.getByTestId("shell")).not.toHaveAttribute("data-panel");
    expect(router.state.location.search).toEqual({});
  });

  test("Escape closes it", async () => {
    await inShell("/c/c1?panel=details");
    expect(screen.getByTestId("shell")).toHaveAttribute("data-panel");
    await userEvent.keyboard("{Escape}");
    expect(screen.getByTestId("shell")).not.toHaveAttribute("data-panel");
  });

  test("the title of a DM's panel is Profile", async () => {
    fakeDevice();
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
          path: "/c/$conversationId",
          validateSearch: validatePanelSearch,
          component: () => (
            <ConversationPage conversationId="d1" onBack={() => {}} />
          ),
        }),
      ]),
      history: createMemoryHistory({ initialEntries: ["/c/d1?panel=details"] }),
    });
    await act(async () => void render(<RouterProvider router={router} />));
    expect(
      screen.getByRole("heading", { level: 2, name: "Profile" }),
    ).toBeInTheDocument();
  });

  test("the slot is cleared when the page unmounts", async () => {
    const { router } = await inShell("/c/c1?panel=details");
    expect(screen.getByTestId("shell")).toHaveAttribute("data-panel");
    await act(async () => void (await router.navigate({ to: "/" })));
    expect(screen.getByTestId("home")).toBeInTheDocument();
    expect(screen.getByTestId("shell")).not.toHaveAttribute("data-panel");
  });
});

describe("a read answered no access (R14)", () => {
  test("a refresh that fails raises no unhandled rejection and the page stays not found", async () => {
    // A plain function: a vi.fn tracks the promise it returns and so counts it as handled.
    let calls = 0;
    const store = h.store as { refresh: () => Promise<void> };
    store.refresh = () => {
      calls += 1;
      return Promise.reject(new Error("offline"));
    };
    h.api.channels.members.mockRejectedValue(http(404));
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
      await inShell("/c/c1?panel=details");
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 20));
    } finally {
      process.off("unhandledRejection", unhandled);
    }
    expect(calls).toBe(1);
    expect(unhandled).not.toHaveBeenCalled();
    expect(screen.queryByTestId("conversation-page")).toBeNull();
  });
});
