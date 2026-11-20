// @vitest-environment jsdom
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { I18nProvider } from "@toki/i18n/react";
import type { Language } from "@toki/i18n";
import { getSessionState, markSignedIn } from "@toki/client-core";
import { setPlatform, type Platform, type TabMessage } from "@toki/platform";
import { createWebPlatform } from "@toki/platform/web";
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { setConnectionCheck } from "../../src/patterns/online";
import { useRegisterAccountEntry } from "../../src/account/account-entries";
import { setAuthServices } from "../../src/auth/services";
import { clock } from "../../src/clock";
import { conversations, sessions, timers } from "../../src/client";
import { AppShellRoute } from "../../src/routes/app-layout";
import { routeTree } from "../../src/router";
import { createFakeCalls, createFakeEmergency } from "../support/auth-harness";

const SAM = {
  id: "00000000-0000-4000-8000-0000000000aa",
  email: "sam@example.com",
  displayName: "Sam Lê",
  role: "member" as const,
  language: "en" as const,
};

// The tab channel is a fake that the test can fire: another tab's message.
let emit: (message: unknown) => void;
let posted: TabMessage[];
function fakePlatform(): Platform {
  const listeners = new Set<(m: TabMessage) => void>();
  emit = (message) => listeners.forEach((l) => l(message as TabMessage));
  return {
    ...createWebPlatform(),
    tabs: {
      post: (m) => void posted.push(m),
      subscribe: (l) => {
        listeners.add(l);
        return () => void listeners.delete(l);
      },
    },
  };
}

beforeEach(() => {
  posted = [];
  setPlatform(fakePlatform());
  setAuthServices({
    calls: createFakeCalls(),
    emergency: createFakeEmergency(),
    clock,
    timers,
  });
  markSignedIn(SAM);
});
afterEach(() => {
  vi.restoreAllMocks();
});

async function mountApp(language: Language = "en", path = "/") {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  await act(async () => {
    render(
      <I18nProvider language={language}>
        <RouterProvider router={router} />
      </I18nProvider>,
    );
  });
  await screen.findByTestId("shell");
  return router;
}

// A shell with children of the test's own, to register stand-in entries.
async function mountWith(children: ReactNode, language: Language = "en") {
  const root = createRootRoute({ component: () => <AppShellRoute /> });
  const index = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: () => <>{children}</>,
  });
  const router = createRouter({
    routeTree: root.addChildren([index]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await act(async () => {
    render(
      <I18nProvider language={language}>
        <RouterProvider router={router} />
      </I18nProvider>,
    );
  });
  await screen.findByTestId("shell");
  return router;
}

// Fills the real conversation store through the real client with a made-up bootstrap.
async function fillStore() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        user: SAM,
        workspace: { id: "01930b7e-7a53-7c2e-9f1a-000000000090", name: "Acme" },
        members: [
          {
            id: SAM.id,
            displayName: "Sam Lê",
            role: "member",
            status: "active",
          },
        ],
        conversations: [
          {
            id: "01930b7e-7a53-7c2e-9f1a-000000000010",
            kind: "channel",
            name: "general",
            topic: null,
            isPrivate: false,
            isGeneral: true,
            notificationLevel: "mentions",
            isMuted: false,
            isStarred: false,
            memberIds: null,
          },
        ],
        eventNumber: 1,
      }),
    ),
  );
  await conversations.load();
  expect(conversations.getState().status).toBe("ready");
  vi.unstubAllGlobals();
}

const card = () => document.querySelector<HTMLButtonElement>("button.ucard")!;
const menuItems = () => screen.queryAllByRole("menuitem");

describe("the account card (R1, R2)", () => {
  test("the shell has one toast region", async () => {
    await mountApp();
    expect(document.querySelectorAll(".toasts")).toHaveLength(1);
  });

  test("is a button named Your account menu with the name and the role", async () => {
    await mountApp();
    expect(card()).toHaveAccessibleName("Your account menu");
    expect(card()).toHaveTextContent("Sam Lê");
    expect(card()).toHaveTextContent("Member");
    expect(card()).toHaveAttribute("aria-haspopup", "menu");
    expect(card().textContent).not.toMatch(/owner/i);
  });

  test("an Admin reads Admin", async () => {
    markSignedIn({ ...SAM, role: "admin" });
    await mountApp();
    expect(card()).toHaveTextContent("Admin");
  });

  test("in Vietnamese the name of the button and the role are Vietnamese", async () => {
    await mountApp("vi");
    expect(card()).toHaveAccessibleName("Menu tài khoản");
    expect(card()).toHaveTextContent("Thành viên");
  });

  test("with no signed-in person the shell draws no card", async () => {
    // The route alone, with no guard: the state is signed out.
    getSessionState();
    const { markSignedOut } = await import("@toki/client-core");
    markSignedOut();
    await mountWith(null);
    expect(document.querySelector(".usercard")).toBeNull();
  });
});

describe("the menu and its entries (R4, R5, R23)", () => {
  test("holds Preferences then Sign out and nothing else", async () => {
    await mountApp();
    await userEvent.click(card());
    expect(menuItems().map((i) => i.textContent)).toEqual([
      "Preferences",
      "Sign out",
    ]);
    expect(screen.getByRole("menu")).toHaveAccessibleName("Your account menu");
    expect(screen.queryAllByRole("separator")).toHaveLength(0);
    expect(screen.queryByText(/^(Active|Away|Do not disturb)$/)).toBeNull();
  });

  test("an Admin sees the same two entries as a Member", async () => {
    markSignedIn({ ...SAM, role: "admin" });
    await mountApp();
    await userEvent.click(card());
    expect(menuItems().map((i) => i.textContent)).toEqual([
      "Preferences",
      "Sign out",
    ]);
  });

  test("stand-in setStatus and focus group go in the fixed order, with a rule after the group", async () => {
    function Standins() {
      useRegisterAccountEntry("focus", {
        id: "focus",
        heading: "Focus time",
        items: [
          { label: "25 minutes", onSelect: () => {} },
          { label: "50 minutes", onSelect: () => {} },
        ],
      });
      useRegisterAccountEntry("setStatus", {
        label: "Set status",
        onSelect: () => {},
      });
      return null;
    }
    await mountWith(<Standins />);
    await userEvent.click(card());
    expect(menuItems().map((i) => i.textContent)).toEqual([
      "Set status",
      "25 minutes",
      "50 minutes",
      "Preferences",
      "Sign out",
    ]);
    const group = screen.getByRole("group", { name: "Focus time" });
    expect(within(group).getAllByRole("menuitem")).toHaveLength(2);
    expect(screen.getAllByRole("separator")).toHaveLength(1);
  });

  test("with pause and focus both registered: two headings and two separators; with only setStatus: no separator", async () => {
    function Both() {
      useRegisterAccountEntry("pause", {
        id: "pause",
        heading: "Pause notifications",
        items: [{ label: "30 minutes", onSelect: () => {} }],
      });
      useRegisterAccountEntry("focus", {
        id: "focus",
        heading: "Focus time",
        items: [{ label: "25 minutes", onSelect: () => {} }],
      });
      return null;
    }
    await mountWith(<Both />);
    await userEvent.click(card());
    expect(screen.getAllByRole("group")).toHaveLength(2);
    expect(
      screen.getByRole("group", { name: "Pause notifications" }),
    ).toBeTruthy();
    expect(screen.getByRole("group", { name: "Focus time" })).toBeTruthy();
    expect(screen.getAllByRole("separator")).toHaveLength(2);
  });

  test("with only setStatus registered there is no separator", async () => {
    function Only() {
      useRegisterAccountEntry("setStatus", {
        label: "Set status",
        onSelect: () => {},
      });
      return null;
    }
    await mountWith(<Only />);
    await userEvent.click(card());
    expect(menuItems().map((i) => i.textContent)).toEqual([
      "Set status",
      "Preferences",
      "Sign out",
    ]);
    expect(screen.queryAllByRole("separator")).toHaveLength(0);
  });

  test("the menu is not inside the card", async () => {
    await mountApp();
    await userEvent.click(card());
    expect(card().contains(screen.getByRole("menu"))).toBe(false);
  });
});

describe("focus and keys (R6)", () => {
  test("a press opens the menu with focus on the first item", async () => {
    await mountApp();
    await userEvent.click(card());
    expect(menuItems()[0]).toHaveFocus();
  });

  test("ArrowDown opens it on the first item and ArrowUp on the last", async () => {
    await mountApp();
    card().focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(menuItems()[0]).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(card()).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}");
    expect(menuItems().at(-1)).toHaveFocus();
  });

  test("Esc closes it and focus is on the card", async () => {
    await mountApp();
    await userEvent.click(card());
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(card()).toHaveFocus();
  });

  test("Preferences goes to /prefs and focus is on the card", async () => {
    const router = await mountApp();
    await userEvent.click(card());
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Preferences" }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe("/prefs"));
    expect(screen.queryByRole("menu")).toBeNull();
    expect(card()).toHaveFocus();
  });
});

describe("Sign out (R7, R9, R11)", () => {
  test("asks for no confirmation, calls the server and ends on /login with no next and no store", async () => {
    await fillStore();

    const call = vi.spyOn(sessions, "signOut").mockResolvedValue(undefined);
    const router = await mountApp("en", "/prefs");
    await userEvent.click(card());
    await userEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(getSessionState().status).toBe("signedOut"));
    expect(call).toHaveBeenCalledTimes(1);
    expect(posted).toEqual([{ type: "signedOut" }]);
    // the address after every effect has flushed
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search).toEqual({});
    expect(router.history.location.href).toBe("/login");
    expect(conversations.getState().status).toBe("idle");
    expect(document.body.textContent).not.toContain("general");
  });

  test("the same result when AppShellRoute is unmounted before markSignedOut() is called", async () => {
    await fillStore();
    vi.spyOn(sessions, "signOut").mockResolvedValue(undefined);
    // The layout goes away at the moment the store is reset, as a state change would unmount it.
    const reset = conversations.reset.bind(conversations);
    vi.spyOn(conversations, "reset").mockImplementation(() => {
      cleanup();
      reset();
    });
    const router = await mountApp("en", "/prefs");
    await userEvent.click(card());
    await userEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    await waitFor(() => expect(getSessionState().status).toBe("signedOut"));
    expect(conversations.getState().status).toBe("idle");
    expect(router.history.location.href).toBe("/login");
  });

  test("offline: Sign out calls nothing, the explanation shows and the person stays signed in (R20)", async () => {
    const call = vi.spyOn(sessions, "signOut");
    setConnectionCheck(() => false);
    await mountApp();
    await userEvent.click(card());
    await userEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(
      await screen.findByText(
        "You are offline. Try again when the connection is back.",
      ),
    ).toBeTruthy();
    expect(call).not.toHaveBeenCalled();
    expect(getSessionState().status).toBe("signedIn");
    setConnectionCheck(null);
  });

  test("a failed call leaves the person signed in with one toast and no signal", async () => {
    vi.spyOn(sessions, "signOut").mockRejectedValue(
      Object.assign(new Error("x"), { kind: "network" }),
    );
    await mountApp();
    await userEvent.click(card());
    await userEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(
      await screen.findByText("That did not work. Try again."),
    ).toBeTruthy();
    expect(screen.getAllByText("That did not work. Try again.")).toHaveLength(
      1,
    );
    // One toast region for the whole shell: a second provider would add a second one.
    expect(document.querySelectorAll(".toasts")).toHaveLength(1);
    expect(getSessionState().status).toBe("signedIn");
    expect(posted).toEqual([]);
    expect(card()).not.toHaveAttribute("aria-busy");
  });

  test("while the call runs the card says Signing out, is busy and the entry is disabled", async () => {
    let release = () => {};
    vi.spyOn(sessions, "signOut").mockImplementation(
      () => new Promise<void>((r) => void (release = r)),
    );
    await mountApp();
    await userEvent.click(card());
    await userEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    await waitFor(() => expect(card()).toHaveAttribute("aria-busy", "true"));
    expect(card()).toHaveTextContent("Signing out…");
    expect(screen.getByRole("status")).toHaveTextContent("Signing out…");
    await userEvent.click(card());
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await act(async () => release());
    await waitFor(() => expect(getSessionState().status).toBe("signedOut"));
  });
});

describe("the signal of another tab (R12)", () => {
  test("a signedOut message ends this tab with no request, and a malformed one does nothing", async () => {
    await fillStore();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const router = await mountApp("en", "/");
    act(() => emit({ type: "other" }));
    act(() => emit({}));
    expect(getSessionState().status).toBe("signedIn");
    act(() => emit({ type: "signedOut" }));
    await waitFor(() => expect(getSessionState().status).toBe("signedOut"));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search).toEqual({});
    expect(conversations.getState().status).toBe("idle");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(posted).toEqual([]);
    vi.unstubAllGlobals();
  });

  test("a message that arrives while the sign-out call is running ends the tab once, with no toast", async () => {
    let fail: (e: unknown) => void = () => {};
    vi.spyOn(sessions, "signOut").mockImplementation(
      () => new Promise<void>((_r, rej) => void (fail = rej)),
    );
    await mountApp();
    await userEvent.click(card());
    await userEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    await waitFor(() => expect(card()).toHaveAttribute("aria-busy", "true"));
    act(() => emit({ type: "signedOut" }));
    await waitFor(() => expect(getSessionState().status).toBe("signedOut"));
    await act(async () =>
      fail(Object.assign(new Error("401"), { kind: "http", status: 401 })),
    );
    expect(screen.queryByText("That did not work. Try again.")).toBeNull();
    expect(posted).toEqual([]);
  });

  test("after unmount a message changes nothing", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await mountApp();
    cleanup();
    act(() => emit({ type: "signedOut" }));
    expect(getSessionState().status).toBe("signedIn");
    vi.unstubAllGlobals();
  });
});
