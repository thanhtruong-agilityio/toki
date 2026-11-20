// @vitest-environment jsdom
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { I18nProvider } from "@toki/i18n/react";
import type { Language } from "@toki/i18n";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { markSignedIn } from "@toki/client-core";
import { setPlatform } from "@toki/platform";
import { createWebPlatform } from "@toki/platform/web";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { routeTree } from "../../src/router";
import type { Role, SectionRow } from "../../src/layout/sections";
import { AppShellRoute } from "../../src/routes/app-layout";
import { setAuthServices } from "../../src/auth/services";
import { clock } from "../../src/clock";
import { timers } from "../../src/client";
import {
  createFakeCalls,
  createFakeEmergency,
  user,
} from "../support/auth-harness";

// R42: the app opens at `/` only with a session. The stub answers `GET /auth/session` with a signed-in
// person, and the state is the one the guard reads.
beforeEach(() => {
  const calls = createFakeCalls();
  setAuthServices({
    calls,
    emergency: createFakeEmergency(),
    clock,
    timers,
  });
  // The account menu listens to the other tabs through the platform (TOKI-099 R12).
  setPlatform(createWebPlatform());
  markSignedIn(user);
});

async function mount(language: Language, path = "/") {
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

describe("the layout route in English (R30, R31)", () => {
  test("shows the shell around the page, with the landmark named Main", async () => {
    await mount("en");
    const shell = screen.getByTestId("shell");
    expect(shell).toHaveAttribute("data-section", "home");
    expect(screen.getByRole("navigation")).toHaveAccessibleName("Main");
    expect(
      within(screen.getByRole("main")).getByTestId("app-root"),
    ).toHaveTextContent("Toki");
  });

  test("one Home link, current, then Preferences, and no role-only item", async () => {
    await mount("en");
    // The sidebar's item and the bottom bar's tab: one link each (jsdom
    // applies no CSS, so both are in the tree).
    const nav = screen.getByRole("navigation");
    const links = [...nav.querySelectorAll<HTMLElement>("a.ni")];
    expect(links.map((a) => a.textContent)).toEqual(["Home", "Preferences"]);
    expect(links[0]).toHaveAttribute("aria-current", "page");
    expect(links[0]).toHaveAttribute("href", "/");
    expect(nav.querySelectorAll("a.nt")).toHaveLength(1);
    expect(document.querySelector('a.ni[data-id="admin"]')).toBeNull();
  });

  test("gives the shell no list, no panel and no workspace, and the card of the signed-in person (TOKI-099 R1)", async () => {
    await mount("en");
    expect(document.querySelector(".convs, .side, .ws")).toBeNull();
    expect(document.querySelectorAll(".usercard")).toHaveLength(1);
  });

  test("a plain click on Home goes through the router", async () => {
    const router = await mount("en");
    const spy = vi.spyOn(router, "navigate");
    await userEvent.click(
      screen.getByRole("navigation").querySelector("a.ni")!,
    );
    expect(spy).toHaveBeenCalledWith({ to: "/" });
  });
});

describe("the layout route in Vietnamese (R31)", () => {
  test("names the landmark and the item in Vietnamese", async () => {
    await mount("vi");
    expect(screen.getByRole("navigation")).toHaveAccessibleName(
      "Điều hướng chính",
    );
    const nav = screen.getByRole("navigation");
    expect(nav.querySelector("a.ni")).toHaveTextContent("Trang chủ");
    expect(nav.querySelector("a.nt")).toHaveTextContent("Trang chủ");
  });
});

describe("the layout route for a Member and for an Admin (R36)", () => {
  const rows: SectionRow[] = [
    row("home"),
    row("activity"),
    row("people"),
    { ...row("admin"), roles: ["admin"] },
  ];
  function row(id: string): SectionRow {
    return {
      id,
      icon: "home",
      labelKey: "nav.home",
      to: `/${id}`,
      match: () => false,
      tab: true,
    };
  }
  async function mountWith(role: Role | undefined) {
    const root = createRootRoute({
      component: () => <AppShellRoute role={role} rows={rows} />,
    });
    const router = createRouter({
      routeTree: root,
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    await act(async () => {
      render(
        <I18nProvider language="en">
          <RouterProvider router={router} />
        </I18nProvider>,
      );
    });
    await screen.findByTestId("shell");
  }
  const ids = () =>
    [...document.querySelectorAll<HTMLElement>("a.ni")].map(
      (a) => a.dataset.id,
    );

  test("a Member sees no Admin item", async () => {
    await mountWith("member");
    expect(ids()).toEqual(["home", "activity", "people"]);
    expect(document.querySelector('a.ni[data-id="admin"]')).toBeNull();
  });

  test("an Admin sees the Admin item", async () => {
    await mountWith("admin");
    expect(ids()).toEqual(["home", "activity", "people", "admin"]);
    expect(document.querySelector('a.ni[data-id="admin"]')).not.toBeNull();
  });

  test("with no known role the rows with a role are not drawn", async () => {
    await mountWith(undefined);
    expect(ids()).toEqual(["home", "activity", "people"]);
  });
});
