import { createRef } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, onTestFinished, test, vi } from "vitest";
import { AppShell, type NavSection } from "../../src/layout/index";

const sections: NavSection[] = [
  {
    id: "home",
    icon: "home",
    label: "H",
    href: "/",
    badge: 3,
    badgeLabel: "3 unread",
  },
  { id: "activity", icon: "bell", label: "A", href: "/activity", badge: 2 },
  { id: "later", icon: "bookmark", label: "L", href: "/later" },
  {
    id: "prefs",
    icon: "settings",
    label: "P",
    href: "/prefs",
    // A field the type no longer has (TOKI-145 R5): the item writes no attribute for it.
    ...{ calmHidden: true },
  },
];
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

const labels = { mainNavigation: "Main", conversations: "Convs" };
const base = { sections, currentSection: "home", labels };

describe("AppShell structure (R3)", () => {
  test("without list and panel: root, sidebar, nav, main, toast anchor", () => {
    const { container } = render(<AppShell {...base}>body</AppShell>);
    const root = screen.getByTestId("shell");
    expect(root.tagName).toBe("DIV");
    expect(root).toHaveClass("app");
    expect(container.querySelector(".convs")).toBeNull();
    expect(container.querySelector(".side")).toBeNull();
    expect([...root.children].map((c) => c.className)).toEqual([
      "sidebar",
      "main",
      "toast-anchor",
    ]);
    expect(screen.getByRole("navigation")).toHaveAccessibleName("Main");
    expect(screen.getByRole("main")).toHaveTextContent("body");
    expect(screen.queryAllByRole("complementary")).toHaveLength(0);
    expect(container.querySelector(".sidebar")).not.toHaveAttribute(
      "data-has-list",
    );
    const anchor = container.querySelector(".toast-anchor")!;
    expect(anchor).toHaveAttribute("aria-hidden", "true");
    expect(anchor).toBeEmptyDOMElement();
  });

  test("with list and panel: order, landmarks and names", () => {
    const { container } = render(
      <AppShell
        {...base}
        list={<p>list body</p>}
        panel={<p>panel body</p>}
        panelLabel="Details"
      >
        body
      </AppShell>,
    );
    const root = screen.getByTestId("shell");
    expect([...root.children].map((c) => c.className)).toEqual([
      "sidebar",
      "main",
      "side",
      "toast-anchor",
    ]);
    const sidebar = container.querySelector(".sidebar")!;
    expect(sidebar).toHaveAttribute("data-has-list");
    expect([...sidebar.children].map((c) => c.tagName)).toEqual([
      "NAV",
      "ASIDE",
    ]);
    const asides = screen.getAllByRole("complementary");
    expect(asides).toHaveLength(2);
    expect(asides[0]).toHaveAccessibleName("Convs");
    expect(asides[0]).toHaveTextContent("list body");
    expect(asides[1]).toHaveAccessibleName("Details");
    expect(asides[1]).toHaveTextContent("panel body");
  });

  test("the nav holds the sidebar's navigation, the card is last in the sidebar", () => {
    const { container } = render(
      <AppShell
        {...base}
        list={<p>l</p>}
        account={{
          label: "Account",
          name: "Ann Lee",
          hue: 10,
          detail: "Admin",
        }}
      >
        x
      </AppShell>,
    );
    const sidebar = container.querySelector(".sidebar")!;
    expect([...sidebar.children].map((c) => c.className)).toEqual([
      "nav",
      "convs",
      "usercard",
    ]);
  });

  test("panelLabel is required with panel (type error)", () => {
    // @ts-expect-error panel without panelLabel
    const el = <AppShell {...base} panel={<p />} />;
    expect(el).toBeTruthy();
  });
});

describe("AppShell attributes (R4)", () => {
  test("data-section, data-pane, data-chat-open, data-panel", () => {
    const { rerender } = render(<AppShell {...base}>x</AppShell>);
    const root = screen.getByTestId("shell");
    expect(root).toHaveAttribute("data-section", "home");
    expect(root).toHaveAttribute("data-pane", "main");
    expect(root).not.toHaveAttribute("data-chat-open");
    expect(root).not.toHaveAttribute("data-panel");

    rerender(
      <AppShell {...base} list={<p />}>
        x
      </AppShell>,
    );
    expect(root).toHaveAttribute("data-pane", "list");

    rerender(
      <AppShell {...base} list={<p />} chatOpen>
        x
      </AppShell>,
    );
    expect(root).toHaveAttribute("data-chat-open", "");
    expect(root).toHaveAttribute("data-pane", "main");

    rerender(
      <AppShell {...base} list={<p />} panel={<p />} panelLabel="P">
        x
      </AppShell>,
    );
    expect(root).toHaveAttribute("data-panel", "");
    expect(root).toHaveAttribute("data-pane", "side");

    rerender(
      <AppShell {...base} currentSection="activity">
        x
      </AppShell>,
    );
    expect(root).toHaveAttribute("data-section", "activity");
  });
});

describe("AppShell navigation (R5, R7)", () => {
  test("one a.ni per section in order, with icon, label, data-id and current", () => {
    render(<AppShell {...base}>x</AppShell>);
    const nav = screen.getByRole("navigation");
    const items = [...nav.querySelectorAll("a.ni")];
    expect(items.map((a) => a.getAttribute("data-id"))).toEqual([
      "home",
      "activity",
      "later",
      "prefs",
    ]);
    expect(items.map((a) => a.getAttribute("href"))).toEqual([
      "/",
      "/activity",
      "/later",
      "/prefs",
    ]);
    for (const a of items) {
      expect(a.querySelector("svg.ic")).not.toBeNull();
      expect(a.querySelector("span.lb")).not.toBeNull();
    }
    expect(items[0]).toHaveAttribute("aria-current", "page");
    expect(items[1]).not.toHaveAttribute("aria-current");
    for (const a of items) expect(a).not.toHaveAttribute("data-calm-hidden");
  });

  test("badge: mute for home, default for others, label from badgeLabel", () => {
    render(<AppShell {...base}>x</AppShell>);
    const home = screen.getByRole("link", { name: /H/ });
    const badge = home.querySelector(".cnt")!;
    expect(badge).toHaveClass("mute");
    expect(within(home).getByText("3 unread")).toBeInTheDocument();
    const act = screen.getByRole("link", { name: /A/ });
    expect(act.querySelector(".cnt")).not.toHaveClass("mute");
    expect(act.querySelector(".cnt")).toHaveTextContent("2");
  });

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
          { id: "later", icon: "bookmark", label: "L", href: "/l", badge },
        ]}
        currentSection="x"
      >
        x
      </AppShell>,
    );
    const el = container.querySelector("a.ni .cnt");
    if (drawn) expect(el).toHaveTextContent(String(badge));
    else expect(el).toBeNull();
  });

  test("a plain click calls onNavigate with the section and the event, already cancelled", async () => {
    const seen: boolean[] = [];
    const onNavigate = vi.fn(
      (_s: NavSection, e: { defaultPrevented: boolean }) =>
        seen.push(e.defaultPrevented),
    );
    render(
      <AppShell {...base} onNavigate={onNavigate}>
        x
      </AppShell>,
    );
    await userEvent.click(screen.getByRole("link", { name: /A/ }));
    expect(seen).toEqual([true]);
    expect(onNavigate.mock.calls[0]![0]).toMatchObject({ id: "activity" });
  });

  test.each([
    ["Control", "{Control>}"],
    ["Meta", "{Meta>}"],
    ["Shift", "{Shift>}"],
    ["Alt", "{Alt>}"],
  ])("a click with %s is left to the browser", async (_name, down) => {
    const onNavigate = vi.fn();
    render(
      <AppShell {...base} onNavigate={onNavigate}>
        x
      </AppShell>,
    );
    const link = screen.getByRole("link", { name: /A/ });
    stopJsdomNavigation();
    const user = userEvent.setup();
    await user.keyboard(down);
    await user.click(link);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  test("a middle click is left to the browser", () => {
    const onNavigate = vi.fn();
    render(
      <AppShell {...base} onNavigate={onNavigate}>
        x
      </AppShell>,
    );
    const link = screen.getByRole("link", { name: /A/ });
    const seen = stopJsdomNavigation();
    link.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 1 }),
    );
    expect(onNavigate).not.toHaveBeenCalled();
    expect(seen).toEqual([false]);
  });

  test("with no onNavigate the click is not cancelled", () => {
    render(<AppShell {...base}>x</AppShell>);
    const link = screen.getByRole("link", { name: /A/ });
    const seen = stopJsdomNavigation();
    link.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    expect(seen).toEqual([false]);
  });
});

describe("AppShell header, search and card (R8)", () => {
  test("workspace header: first letter upper-cased, name and detail", () => {
    const { container } = render(
      <AppShell {...base} workspace={{ name: "ünder", detail: "8 people" }}>
        x
      </AppShell>,
    );
    const ws = container.querySelector(".ws")!;
    expect(ws.querySelector(".wsl")).toHaveTextContent("Ü");
    expect(ws.querySelector(".wst > .wsn")).toHaveTextContent("ünder");
    expect(ws.querySelector(".wst > .wss")).toHaveTextContent("8 people");
  });

  test("no detail, no .wss; no workspace, no .ws", () => {
    const { container, rerender } = render(
      <AppShell {...base} workspace={{ name: "Toki" }}>
        x
      </AppShell>,
    );
    expect(container.querySelector(".wss")).toBeNull();
    rerender(<AppShell {...base}>x</AppShell>);
    expect(container.querySelector(".ws")).toBeNull();
  });

  test("search box: named button, label, hint and press", async () => {
    const onOpen = vi.fn();
    const { container } = render(
      <AppShell {...base} search={{ label: "Search", hint: "Ctrl K", onOpen }}>
        x
      </AppShell>,
    );
    const btn = screen.getByRole("button", { name: "Search" });
    expect(btn).toHaveClass("srch");
    expect(btn.querySelector("svg")).not.toBeNull();
    expect(btn.querySelector("span.t")).toHaveTextContent("Search");
    expect(btn.querySelector("span.kbd")).toHaveTextContent("Ctrl K");
    await userEvent.click(btn);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll(".srch")).toHaveLength(1);
  });

  test("search box: no hint, no kbd; no search, nothing", () => {
    const { container, rerender } = render(
      <AppShell {...base} search={{ label: "S", onOpen: () => {} }}>
        x
      </AppShell>,
    );
    expect(container.querySelector(".kbd")).toBeNull();
    rerender(<AppShell {...base}>x</AppShell>);
    expect(container.querySelector(".srch")).toBeNull();
  });

  test("account card with no trigger is a div.ucard, no button", () => {
    const { container } = render(
      <AppShell
        {...base}
        account={{
          label: "Account",
          name: "Ann Lee",
          hue: 10,
          detail: "Admin",
          presence: "active",
          presenceLabel: "Online",
        }}
      >
        x
      </AppShell>,
    );
    const card = container.querySelector(".usercard > .ucard")!;
    expect(card.tagName).toBe("DIV");
    expect(screen.queryByRole("button")).toBeNull();
    expect(card.querySelector(".uct > .un")).toHaveTextContent("Ann Lee");
    expect(card.querySelector(".uct > .us")).toHaveTextContent("Admin");
    expect(card.querySelector(".av, .pdw .av")).not.toBeNull();
    const av = card.querySelector<HTMLElement>(".av")!;
    expect(av.style.getPropertyValue("--s")).toBe("36px");
  });

  test("no detail, no .us; no account, nothing", () => {
    const { container, rerender } = render(
      <AppShell {...base} account={{ label: "A", name: "B", hue: 1 }}>
        x
      </AppShell>,
    );
    expect(container.querySelector(".us")).toBeNull();
    rerender(<AppShell {...base}>x</AppShell>);
    expect(container.querySelector(".usercard")).toBeNull();
  });

  test("triggerProps go on button.ucard, the ref too, the owned attributes win", async () => {
    const onClick = vi.fn();
    const onKeyDown = vi.fn();
    const ref = createRef<HTMLButtonElement>();
    const { container } = render(
      <AppShell
        {...base}
        account={{
          label: "Account menu",
          name: "Ann Lee",
          hue: 10,
          triggerProps: {
            ref,
            "aria-haspopup": "menu",
            "aria-expanded": false,
            onClick,
            onKeyDown,
          },
        }}
      >
        x
      </AppShell>,
    );
    const btn = screen.getByRole("button", { name: "Account menu" });
    expect(btn).toBe(container.querySelector("button.ucard"));
    expect(btn).toHaveAttribute("type", "button");
    expect(btn).toHaveAttribute("aria-haspopup", "menu");
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(ref.current).toBe(btn);
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalled();
    await userEvent.keyboard("{ArrowDown}");
    expect(onKeyDown).toHaveBeenCalled();
    expect(btn.querySelector(".uct > .un")).toHaveTextContent("Ann Lee");
  });
});

describe("AppShell pieces (R9, R34)", () => {
  test("renders no dialog", () => {
    render(<AppShell {...base}>x</AppShell>);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("ref and className reach the root", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <AppShell {...base} ref={ref} className="extra">
        x
      </AppShell>,
    );
    expect(ref.current).toBe(screen.getByTestId("shell"));
    expect(ref.current).toHaveClass("app", "extra");
  });

  test("owned attributes win over the spread", () => {
    render(
      <AppShell
        {...base}
        {...({ "data-testid": "mine", "data-section": "zzz" } as object)}
      >
        x
      </AppShell>,
    );
    const root = screen.getByTestId("shell");
    expect(root).toHaveAttribute("data-section", "home");
  });
});
