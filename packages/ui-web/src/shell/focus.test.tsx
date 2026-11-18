import { render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AppShell, type NavSection } from "./index";

const sections: NavSection[] = [
  { id: "home", icon: "home", label: "H", href: "/", tab: true },
  { id: "later", icon: "bookmark", label: "L", href: "/l", tab: true },
];
const labels = { mainNavigation: "Main", conversations: "Convs" };
const props = { sections, labels, list: <p>list</p> };

function stubNarrow(narrow: boolean) {
  const matchMedia = vi.fn(() => ({
    matches: narrow,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: matchMedia,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "matchMedia");
});

describe("the shown pane takes focus on a change (R29)", () => {
  test("the three panes can take focus from code and not from the Tab key", () => {
    const { container } = render(
      <AppShell
        {...props}
        currentSection="home"
        panel={<p>p</p>}
        panelLabel="Panel"
      >
        x
      </AppShell>,
    );
    for (const sel of [".convs", ".main", ".side"])
      expect(container.querySelector(sel), sel).toHaveAttribute(
        "tabindex",
        "-1",
      );
  });

  test("narrow: opening a conversation focuses main, closing it focuses the list", () => {
    stubNarrow(true);
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    const { container, rerender } = render(
      <AppShell {...props} currentSection="home">
        x
      </AppShell>,
    );
    expect(focus).not.toHaveBeenCalled();
    rerender(
      <AppShell {...props} currentSection="home" chatOpen>
        x
      </AppShell>,
    );
    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus.mock.contexts[0]).toBe(container.querySelector(".main"));
    rerender(
      <AppShell {...props} currentSection="home">
        x
      </AppShell>,
    );
    expect(focus).toHaveBeenCalledTimes(2);
    expect(focus.mock.contexts[1]).toBe(container.querySelector(".convs"));
  });

  test("narrow: the panel takes focus when it opens", () => {
    stubNarrow(true);
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    const { container, rerender } = render(
      <AppShell {...props} currentSection="later">
        x
      </AppShell>,
    );
    rerender(
      <AppShell
        {...props}
        currentSection="later"
        panel={<p>p</p>}
        panelLabel="Panel"
      >
        x
      </AppShell>,
    );
    expect(focus.mock.contexts).toEqual([container.querySelector(".side")]);
  });

  test("narrow: a pane that refuses the focus (still hidden) is tried again on the next frame", () => {
    stubNarrow(true);
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const real = HTMLElement.prototype.focus;
    let calls = 0;
    const focus = vi
      .spyOn(HTMLElement.prototype, "focus")
      .mockImplementation(function (this: HTMLElement, options) {
        // The first call is refused, as a browser does for a hidden element.
        if (++calls > 1) real.call(this, options);
      });
    const { container, rerender } = render(
      <AppShell {...props} currentSection="home">
        x
      </AppShell>,
    );
    rerender(
      <AppShell {...props} currentSection="home" chatOpen>
        x
      </AppShell>,
    );
    expect(focus).toHaveBeenCalledTimes(1);
    expect(frames).toHaveLength(1);
    frames[0]!(0);
    expect(focus).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(container.querySelector(".main"));
    // It stops once the pane has the focus.
    expect(frames).toHaveLength(1);
    vi.unstubAllGlobals();
  });

  test("not when the focus is already inside the pane", () => {
    stubNarrow(true);
    const { container, rerender } = render(
      <AppShell {...props} currentSection="home">
        <button type="button">inner</button>
      </AppShell>,
    );
    container.querySelector("button")!.focus();
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    rerender(
      <AppShell {...props} currentSection="home" chatOpen>
        <button type="button">inner</button>
      </AppShell>,
    );
    expect(focus).not.toHaveBeenCalled();
  });

  test("not on a change that leaves the pane as it was", () => {
    stubNarrow(true);
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    const { rerender } = render(
      <AppShell {...props} currentSection="later">
        x
      </AppShell>,
    );
    rerender(
      <AppShell {...props} currentSection="home" chatOpen>
        x
      </AppShell>,
    );
    expect(focus).not.toHaveBeenCalled();
  });

  test("at 720 px and above, and with no matchMedia, focus is not moved", () => {
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    const { rerender } = render(
      <AppShell {...props} currentSection="home">
        x
      </AppShell>,
    );
    rerender(
      <AppShell {...props} currentSection="home" chatOpen>
        x
      </AppShell>,
    );
    stubNarrow(false);
    rerender(
      <AppShell {...props} currentSection="home">
        x
      </AppShell>,
    );
    expect(focus).not.toHaveBeenCalled();
  });
});
