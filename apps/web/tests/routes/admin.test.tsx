// @vitest-environment jsdom
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { act, render, screen, within } from "@testing-library/react";
import { markSignedIn } from "@toki/client-core";
import { setPlatform } from "@toki/platform";
import { createWebPlatform } from "@toki/platform/web";
import { I18nProvider } from "@toki/i18n/react";
import type { Language } from "@toki/i18n";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { setAuthServices } from "../../src/auth/services";
import { clock } from "../../src/clock";
import { timers } from "../../src/client";
import { routeTree } from "../../src/router";
import {
  createFakeCalls,
  createFakeEmergency,
  user,
} from "../support/auth-harness";

// The route, the gate and the no-access view (TOKI-025 R1 to R4).
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // The account menu of the shell listens to the other tabs through the platform (TOKI-099 R12).
  setPlatform(createWebPlatform());
  fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  setAuthServices({
    calls: createFakeCalls(),
    emergency: createFakeEmergency(),
    clock,
    timers,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function mount(role: "admin" | "member", language: Language = "en") {
  markSignedIn({ ...user, role });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/admin"] }),
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

describe("the Admin route (R1, R3, R4)", () => {
  test("an Admin sees the page inside the shell with the title Admin", async () => {
    await mount("admin");
    expect(screen.getByTestId("shell")).toHaveAttribute(
      "data-section",
      "admin",
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Admin" }),
    ).toBeInTheDocument();
  });

  test("a Member sees only the no-access title and nothing else", async () => {
    await mount("member");
    const main = screen.getByRole("main");
    expect(
      within(main).getByRole("heading", {
        level: 1,
        name: "You do not have access to this page",
      }),
    ).toBeInTheDocument();
    // No word that names the page's content, not even its own title.
    expect(main.textContent).toBe("You do not have access to this page");
    expect(screen.queryByText("Admin")).toBeNull();
    expect(document.querySelector('a.ni[data-id="admin"]')).toBeNull();
  });

  test("a Member's page sends no request to the server", async () => {
    await mount("member");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("the no-access title is read in Vietnamese too", async () => {
    await mount("member", "vi");
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Bạn không có quyền truy cập trang này",
      }),
    ).toBeInTheDocument();
  });
});
