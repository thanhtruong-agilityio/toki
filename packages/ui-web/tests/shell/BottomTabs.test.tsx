import { createRef } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, onTestFinished, test, vi } from "vitest";
import { AppShell, BottomTabs, type NavSection } from "../../src/shell/index";

const sections: NavSection[] = [
  {
    id: "home",
    icon: "home",
    label: "Home",
    href: "/",
    badge: 3,
    badgeLabel: "3 unread",
    tab: true,
  },
  {
    id: "activity",
    icon: "bell",
    label: "Activity",
    href: "/a",
    badge: 2,
    tab: true,
  },
  { id: "later", icon: "bookmark", label: "Later", href: "/l", tab: true },
  { id: "files", icon: "file", label: "Files", href: "/f", tab: true },
  { id: "prefs", icon: "settings", label: "Prefs", href: "/p", more: true },
  { id: "people", icon: "users", label: "People", href: "/pe" },
];
const labels = { mainNavigation: "Main", conversations: "Convs" };
const base = { sections, currentSection: "home", labels };

function bar(container: HTMLElement): HTMLElement {
  return container.querySelector("nav > div.nav-tabs")!;
}

// Records whether React's handler cancelled the click, then cancels it so that
// jsdom does not try to navigate.
function stopJsdomNavigation(): boolean[] {
  const seen: boolean[] = [];
  const listener = (e: Event) => {
    seen.push(e.defaultPrevented);
    e.preventDefault();
  };
  document.addEventListener("click", listener);
  onTestFinished(() => document.removeEventListener("click", listener));
  return seen;
}

describe("BottomTabs structure (R6)", () => {
  test("div.nav-tabs inside the nav, one a.nt for each tab section in order", () => {
    const { container } = render(<AppShell {...base}>x</AppShell>);
    const tabs = [...bar(container).querySelectorAll("a.nt")];
    expect(tabs.map((a) => a.getAttribute("data-id"))).toEqual([
      "home",
      "activity",
      "later",
      "files",
    ]);
    expect(tabs.map((a) => a.getAttribute("href"))).toEqual([
      "/",
      "/a",
      "/l",
      "/f",
    ]);
    for (const a of tabs) {
      expect(a.querySelector("svg.ic")).not.toBeNull();
      expect(a.querySelector(":scope > span")).not.toBeNull();
    }
    expect(tabs[0]).toHaveAttribute("aria-current", "page");
    expect(tabs[1]).not.toHaveAttribute("aria-current");
    // The sidebar's own items are not touched.
    expect(container.querySelectorAll("nav a.ni")).toHaveLength(6);
  });

  test("with no tab section the bar holds no link", () => {
    const { container } = render(
      <AppShell {...base} sections={[sections[5]!]}>
        x
      </AppShell>,
    );
    expect(bar(container).querySelectorAll("a, button")).toHaveLength(0);
  });

  test("BottomTabs renders div.nav-tabs by itself", () => {
    const { container } = render(
      <BottomTabs sections={sections} currentSection="later" />,
    );
    expect(container.firstElementChild).toHaveClass("nav-tabs");
    expect(
      container.querySelector('a.nt[aria-current="page"]'),
    ).toHaveAttribute("data-id", "later");
  });
});

describe("BottomTabs badges (R7)", () => {
  test.each([
    [0, false],
    [-1, false],
    [Number.NaN, false],
    [undefined, false],
    [1, true],
    [100, true],
  ])("badge %s drawn: %s", (badge, drawn) => {
    const { container } = render(
      <AppShell
        {...base}
        sections={[
          {
            id: "later",
            icon: "bookmark",
            label: "L",
            href: "/l",
            badge,
            tab: true,
          },
        ]}
        currentSection="x"
      >
        x
      </AppShell>,
    );
    const el = bar(container).querySelector("a.nt .cnt");
    if (drawn) expect(el).toHaveTextContent(String(badge));
    else expect(el).toBeNull();
  });

  test("home badge is mute, others default; the label names the count", () => {
    const { container } = render(<AppShell {...base}>x</AppShell>);
    const [home, activity] = [...bar(container).querySelectorAll("a.nt")];
    expect(home!.querySelector(".cnt")).toHaveClass("mute");
    expect(
      within(home as HTMLElement).getByText("3 unread"),
    ).toBeInTheDocument();
    expect(activity!.querySelector(".cnt")).not.toHaveClass("mute");
    expect(activity!.querySelector(".cnt")).toHaveTextContent("2");
  });

  test("Files has no number unless it is given one; More never has one", () => {
    const { container } = render(
      <AppShell
        {...base}
        moreTab={{ label: "More", open: false, onOpen: () => {} }}
      >
        x
      </AppShell>,
    );
    expect(
      bar(container).querySelector('a.nt[data-id="files"] .cnt'),
    ).toBeNull();
    expect(bar(container).querySelector("button.nt .cnt")).toBeNull();
  });
});

describe("BottomTabs clicks (R5)", () => {
  test("a plain click calls onNavigate with the section and cancels", async () => {
    const seen = stopJsdomNavigation();
    const onNavigate = vi.fn();
    const { container } = render(
      <AppShell {...base} onNavigate={onNavigate}>
        x
      </AppShell>,
    );
    await userEvent.click(bar(container).querySelector('a[data-id="later"]')!);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate.mock.calls[0]![0]).toBe(sections[2]);
    expect(seen).toEqual([true]);
  });

  test.each(["Control", "Meta", "Shift", "Alt"])(
    "a click with %s is left to the browser",
    async (key) => {
      const seen = stopJsdomNavigation();
      const onNavigate = vi.fn();
      const { container } = render(
        <AppShell {...base} onNavigate={onNavigate}>
          x
        </AppShell>,
      );
      const link = bar(container).querySelector('a[data-id="later"]')!;
      const user = userEvent.setup();
      await user.keyboard(`{${key}>}`);
      await user.click(link);
      await user.keyboard(`{/${key}}`);
      expect(onNavigate).not.toHaveBeenCalled();
      expect(seen).toEqual([false]);
    },
  );

  test("Enter on a focused link navigates; a missing handler is left alone", async () => {
    const seen = stopJsdomNavigation();
    const onNavigate = vi.fn();
    const { container, rerender } = render(
      <AppShell {...base} onNavigate={onNavigate}>
        x
      </AppShell>,
    );
    const link =
      bar(container).querySelector<HTMLElement>('a[data-id="files"]')!;
    link.focus();
    await userEvent.keyboard("{Enter}");
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(seen).toEqual([true]);
    rerender(<AppShell {...base}>x</AppShell>);
    await userEvent.click(link);
    expect(seen).toEqual([true, false]);
  });
});

describe("BottomTabs More button (R6, R9)", () => {
  test("no moreTab, no button", () => {
    const { container } = render(<AppShell {...base}>x</AppShell>);
    expect(bar(container).querySelector("button")).toBeNull();
  });

  test("the button comes after the links, with label, MenuIcon and ARIA", () => {
    const { container, rerender } = render(
      <AppShell
        {...base}
        moreTab={{ label: "More", open: false, onOpen: () => {} }}
      >
        x
      </AppShell>,
    );
    const items = [...bar(container).children];
    const button = items[items.length - 1] as HTMLElement;
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveClass("nt");
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAccessibleName("More");
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).not.toHaveAttribute("aria-current");
    expect(button.querySelector("svg.ic")).not.toBeNull();
    expect(items.slice(0, -1).every((e) => e.tagName === "A")).toBe(true);
    rerender(
      <AppShell
        {...base}
        currentSection="prefs"
        moreTab={{ label: "More", open: true, onOpen: () => {} }}
      >
        x
      </AppShell>,
    );
    const again = bar(container).querySelector("button.nt")!;
    expect(again).toHaveAttribute("aria-expanded", "true");
    expect(again).toHaveAttribute("aria-current", "page");
  });

  test("the press calls onOpen and nothing else; no dialog before or after", async () => {
    const onOpen = vi.fn();
    const ref = createRef<HTMLButtonElement>();
    const { container } = render(
      <AppShell {...base} moreTab={{ label: "More", open: false, onOpen, ref }}>
        x
      </AppShell>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    const button = bar(container).querySelector<HTMLElement>("button.nt")!;
    expect(ref.current).toBe(button);
    await userEvent.click(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
    button.focus();
    await userEvent.keyboard(" ");
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(container.querySelector("[role=dialog], dialog")).toBeNull();
  });
});
