import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { I18nProvider } from "@toki/i18n/react";
import type { Language } from "@toki/i18n";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { routeTree } from "../router";

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

  test("one Home link, current, and no role-only item", async () => {
    await mount("en");
    const links = within(screen.getByRole("navigation")).getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual(["Home"]);
    expect(links[0]).toHaveAttribute("aria-current", "page");
    expect(links[0]).toHaveAttribute("href", "/");
    expect(document.querySelector('a.ni[data-id="admin"]')).toBeNull();
  });

  test("gives the shell no list, no panel, no workspace and no account", async () => {
    await mount("en");
    expect(document.querySelector(".convs, .side, .ws, .usercard")).toBeNull();
  });

  test("a plain click on Home goes through the router", async () => {
    const router = await mount("en");
    const spy = vi.spyOn(router, "navigate");
    await userEvent.click(screen.getByRole("link", { name: "Home" }));
    expect(spy).toHaveBeenCalledWith({ to: "/" });
  });
});

describe("the layout route in Vietnamese (R31)", () => {
  test("names the landmark and the item in Vietnamese", async () => {
    await mount("vi");
    expect(screen.getByRole("navigation")).toHaveAccessibleName(
      "Điều hướng chính",
    );
    expect(
      within(screen.getByRole("navigation")).getByRole("link"),
    ).toHaveTextContent("Trang chủ");
  });
});
