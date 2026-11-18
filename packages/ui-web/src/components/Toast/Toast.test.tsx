import {
  act,
  fireEvent,
  render,
  screen,
  type RenderResult,
} from "@testing-library/react";
import { resolve } from "node:path";
import { createRef, useRef } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { readCss } from "../../test/css";
import { Toast } from "./Toast";
import { ToastRegion } from "./ToastRegion";
import {
  ToastProvider,
  useToastAnchor,
  useToastAvoid,
  useToasts,
} from "./ToastProvider";
import {
  computeToastBottom,
  computeToastExtent,
  TOAST_MS_PLAIN,
  TOAST_MS_WITH_ACTION,
} from "./toastPlace";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

type Api = ReturnType<typeof useToasts>;

// Renders a provider and returns the api that a screen would get.
function setup(): { api: () => Api; view: RenderResult } {
  let api!: Api;
  function Grab() {
    api = useToasts();
    return null;
  }
  const view = render(
    <ToastProvider>
      <Grab />
    </ToastProvider>,
  );
  return { api: () => api, view };
}

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe("Toast (R19)", () => {
  test("renders div.toast holding a span with the text and no role", () => {
    const ref = createRef<HTMLDivElement>();
    const { container } = render(
      <Toast ref={ref} text="Left #design" className="mine" />,
    );
    const toast = container.firstElementChild as HTMLElement;
    expect(toast.tagName).toBe("DIV");
    expect(toast.className).toBe("toast mine");
    expect(toast.hasAttribute("role")).toBe(false);
    expect(toast.children).toHaveLength(1);
    expect(toast.firstElementChild!.tagName).toBe("SPAN");
    expect(toast.textContent).toBe("Left #design");
    expect(ref.current).toBe(toast);
  });

  test("with an action it renders a button of type button after the span", () => {
    const onPress = vi.fn();
    const { container } = render(
      <Toast text="Message deleted" action={{ label: "Undo", onPress }} />,
    );
    const toast = container.firstElementChild!;
    expect(toast.children).toHaveLength(2);
    const button = screen.getByRole("button", { name: "Undo" });
    expect(toast.lastElementChild).toBe(button);
    expect(button.getAttribute("type")).toBe("button");
    fireEvent.click(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test("a caller's role is dropped and other attributes go through", () => {
    const extra = { role: "alert" } as unknown as object;
    const { container } = render(<Toast text="t" data-x="1" {...extra} />);
    const toast = container.firstElementChild!;
    expect(toast.hasAttribute("role")).toBe(false);
    expect(toast.getAttribute("data-x")).toBe("1");
  });

  test("the props type: text is required, role and children are not accepted", () => {
    // @ts-expect-error text is required
    render(<Toast />);
    // @ts-expect-error role is owned
    render(<Toast text="t" role="status" />);
    render(
      // @ts-expect-error children are owned
      <Toast text="t">x</Toast>,
    );
  });

  test("a Toast holds no timer and no state: it stays on screen", () => {
    render(<Toast text="t" />);
    advance(60000);
    expect(screen.getByText("t")).toBeTruthy();
  });
});

describe("ToastProvider and the region (R21, R22)", () => {
  test("the region is in the document with no toast, after the children, and is polite", () => {
    const { view } = setup();
    const region = view.container.querySelector(".toasts")!;
    expect(region).not.toBeNull();
    expect(region.tagName).toBe("DIV");
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.children).toHaveLength(0);
    expect(view.container.lastElementChild).toBe(region);
  });

  test("the region holds no other live role", () => {
    const { api, view } = setup();
    act(() => void api().show({ text: "one" }));
    expect(view.container.querySelectorAll("[role]")).toHaveLength(0);
    expect(view.container.querySelectorAll("[aria-live]")).toHaveLength(1);
  });

  test("useToasts outside a provider throws an error that names ToastProvider", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    function Bad() {
      useToasts();
      return null;
    }
    expect(() => render(<Bad />)).toThrowError(/ToastProvider/);
    error.mockRestore();
  });

  test("show adds a toast at once and returns an id; dismiss removes it", () => {
    const { api } = setup();
    let id = -1;
    act(() => {
      id = api().show({ text: "Saved" });
    });
    expect(screen.getByText("Saved")).toBeTruthy();
    act(() => api().dismiss(id));
    expect(screen.queryByText("Saved")).toBeNull();
  });

  test("dismiss of an unknown id, or a second dismiss, does nothing", () => {
    const { api } = setup();
    let id = -1;
    act(() => {
      id = api().show({ text: "Saved" });
      api().show({ text: "Other" });
    });
    act(() => {
      api().dismiss(9999);
      api().dismiss(id);
      api().dismiss(id);
    });
    expect(screen.queryByText("Saved")).toBeNull();
    expect(screen.getByText("Other")).toBeTruthy();
  });

  test("show and dismiss keep their identity and a caller does not render again", () => {
    let renders = 0;
    let first: Api | undefined;
    let last: Api | undefined;
    function Caller() {
      const api = useToasts();
      renders += 1;
      first ??= api;
      last = api;
      return null;
    }
    render(
      <ToastProvider>
        <Caller />
      </ToastProvider>,
    );
    expect(renders).toBe(1);
    act(() => {
      const ids = [1, 2, 3].map((n) => first!.show({ text: `t${n}` }));
      ids.forEach((id) => first!.dismiss(id));
    });
    expect(renders).toBe(1);
    expect(last!.show).toBe(first!.show);
    expect(last!.dismiss).toBe(first!.dismiss);
  });

  test("the region follows toasts in the order of show, the oldest on top (R25)", () => {
    const { api, view } = setup();
    act(() => {
      api().show({ text: "first" });
      api().show({ text: "second" });
      api().show({ text: "third" });
    });
    const texts = Array.from(view.container.querySelectorAll(".toast")).map(
      (t) => t.textContent,
    );
    expect(texts).toEqual(["first", "second", "third"]);
  });
});

describe("ToastRegion (R4)", () => {
  test("ref points at div.toasts, className is appended and aria-live is owned", () => {
    const ref = createRef<HTMLDivElement>();
    const extra = { "aria-live": "assertive" } as unknown as object;
    render(
      <ToastProvider>
        <ToastRegion ref={ref} className="mine" data-x="1" {...extra} />
      </ToastProvider>,
    );
    const region = ref.current!;
    expect(region.tagName).toBe("DIV");
    expect(region.className).toBe("toasts mine");
    expect(region.getAttribute("data-x")).toBe("1");
    expect(region.getAttribute("aria-live")).toBe("polite");
  });

  test("outside a provider it throws an error that names ToastProvider", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<ToastRegion />)).toThrowError(/ToastProvider/);
    error.mockRestore();
  });
});

describe("timers (R23)", () => {
  test("the constants are 5000 and 2800 ms", () => {
    expect(TOAST_MS_WITH_ACTION).toBe(5000);
    expect(TOAST_MS_PLAIN).toBe(2800);
  });

  test("a toast with an action goes at 5000 ms, not before", () => {
    const { api } = setup();
    act(() => {
      api().show({ text: "Deleted", action: { label: "Undo", onPress() {} } });
    });
    advance(4999);
    expect(screen.queryByText("Deleted")).not.toBeNull();
    advance(1);
    expect(screen.queryByText("Deleted")).toBeNull();
  });

  test("a toast without an action goes at 2800 ms, not before", () => {
    const { api } = setup();
    act(() => void api().show({ text: "Saved" }));
    advance(2799);
    expect(screen.queryByText("Saved")).not.toBeNull();
    advance(1);
    expect(screen.queryByText("Saved")).toBeNull();
  });

  test("each toast has its own timer", () => {
    const { api } = setup();
    act(() => void api().show({ text: "a" }));
    advance(1000);
    act(() => void api().show({ text: "b" }));
    advance(1800);
    expect(screen.queryByText("a")).toBeNull();
    expect(screen.queryByText("b")).not.toBeNull();
    advance(1000);
    expect(screen.queryByText("b")).toBeNull();
  });
});

describe("pause on pointer and focus (R23, concerns 1 and 2)", () => {
  test("the timer stops while the pointer is over the toast and restarts with the full time", () => {
    const { api } = setup();
    act(() => void api().show({ text: "Saved" }));
    const toast = screen.getByText("Saved").closest(".toast")!;
    advance(1000);
    fireEvent.pointerEnter(toast);
    advance(60000);
    expect(screen.queryByText("Saved")).not.toBeNull();
    fireEvent.pointerLeave(toast);
    advance(2799);
    expect(screen.queryByText("Saved")).not.toBeNull();
    advance(1);
    expect(screen.queryByText("Saved")).toBeNull();
  });

  test("the timer stops while focus is inside the toast and restarts when it leaves", () => {
    const { api } = setup();
    act(() => {
      api().show({ text: "Deleted", action: { label: "Undo", onPress() {} } });
    });
    const button = screen.getByRole("button", { name: "Undo" });
    advance(4000);
    fireEvent.focus(button);
    advance(60000);
    expect(screen.queryByText("Deleted")).not.toBeNull();
    fireEvent.blur(button);
    advance(4999);
    expect(screen.queryByText("Deleted")).not.toBeNull();
    advance(1);
    expect(screen.queryByText("Deleted")).toBeNull();
  });

  test("the timer stays stopped while either the pointer or focus holds the toast", () => {
    const { api } = setup();
    act(() => {
      api().show({ text: "Deleted", action: { label: "Undo", onPress() {} } });
    });
    const toast = screen.getByText("Deleted").closest(".toast")!;
    const button = screen.getByRole("button", { name: "Undo" });
    fireEvent.pointerEnter(toast);
    fireEvent.focus(button);
    fireEvent.pointerLeave(toast);
    advance(60000);
    expect(screen.queryByText("Deleted")).not.toBeNull();
    fireEvent.blur(button);
    advance(5000);
    expect(screen.queryByText("Deleted")).toBeNull();
  });

  test("a pause on one toast does not stop the others", () => {
    const { api } = setup();
    act(() => {
      api().show({ text: "a" });
      api().show({ text: "b" });
    });
    fireEvent.pointerEnter(screen.getByText("a").closest(".toast")!);
    advance(2800);
    expect(screen.queryByText("a")).not.toBeNull();
    expect(screen.queryByText("b")).toBeNull();
  });
});

describe("the button and the cap (R24, R25)", () => {
  test("pressing the button removes the toast first, then calls onPress once", () => {
    const { api } = setup();
    const seen: number[] = [];
    act(() => {
      api().show({
        text: "Deleted",
        action: {
          label: "Undo",
          onPress: () => seen.push(vi.getTimerCount()),
        },
      });
    });
    expect(vi.getTimerCount()).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    // The toast's timer was cleared before onPress ran.
    expect(seen).toEqual([0]);
    expect(screen.queryByText("Deleted")).toBeNull();
    advance(10000);
    expect(seen).toHaveLength(1);
  });

  test("at most three toasts show: a fourth removes the oldest and clears its timer", () => {
    const { api, view } = setup();
    act(() => {
      ["a", "b", "c", "d"].forEach((text) => api().show({ text }));
    });
    const texts = Array.from(view.container.querySelectorAll(".toast")).map(
      (t) => t.textContent,
    );
    expect(texts).toEqual(["b", "c", "d"]);
    expect(vi.getTimerCount()).toBe(3);
  });

  test("an evicted toast with an action does not call onPress", () => {
    const { api } = setup();
    const onPress = vi.fn();
    act(() => {
      api().show({ text: "old", action: { label: "Undo", onPress } });
      ["b", "c", "d"].forEach((text) => api().show({ text }));
    });
    expect(screen.queryByText("old")).toBeNull();
    advance(10000);
    expect(onPress).not.toHaveBeenCalled();
  });

  test("equal texts are not merged", () => {
    const { api, view } = setup();
    act(() => {
      api().show({ text: "same" });
      api().show({ text: "same" });
    });
    expect(view.container.querySelectorAll(".toast")).toHaveLength(2);
  });
});

describe("unmount (R26)", () => {
  test("every timer is cleared and nothing is set afterwards", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { api, view } = setup();
    act(() => {
      api().show({ text: "a" });
      api().show({ text: "b", action: { label: "Undo", onPress() {} } });
    });
    expect(vi.getTimerCount()).toBe(2);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
    advance(10000);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("Toast.css (R20, R21, R32, R33)", () => {
  const css = readCss(resolve(import.meta.dirname, "Toast.css"));
  const rule = (selector: string, media: string | null = null) =>
    css.find((r) => r.selector === selector && r.media === media);
  const decl = (text: string) =>
    Object.fromEntries(
      text.split(";").map((part) => {
        const i = part.indexOf(":");
        return [part.slice(0, i).trim(), part.slice(i + 1).trim()];
      }),
    );

  test(".toasts holds the declarations of R21", () => {
    expect(rule(".toasts")!.declarations).toEqual(
      decl(
        "position:fixed; left:50%; transform:translateX(-50%); display:flex; flex-direction:column; gap:8px; align-items:center; pointer-events:none; z-index:40; width:min(480px,92%)",
      ),
    );
  });

  test(".toast holds the declarations of R20", () => {
    expect(rule(".toast")!.declarations).toEqual(
      decl(
        "pointer-events:auto; display:flex; align-items:center; gap:12px; background:var(--ink); color:var(--surface); padding:9px 12px 9px 14px; border-radius:var(--radius-sm); box-shadow:var(--pop); animation:tin 0.18s ease-out; font-weight:500",
      ),
    );
  });

  test("the button has the Calm label and the Focus look selector has the accent", () => {
    expect(rule(".toast button")!.declarations).toEqual(
      decl("color:var(--accent-soft); font-weight:700; padding:2px 6px"),
    );
    expect(rule('[data-eff="focus"] .toast button')!.declarations).toEqual({
      color: "var(--accent)",
    });
  });

  test("the animation tin starts 8px low and transparent", () => {
    expect(rule("from", "tin")!.declarations).toEqual({
      transform: "translateY(8px)",
      opacity: "0",
    });
  });

  test("the keyboard ring shows on the toast (R33)", () => {
    expect(rule(".toast button:focus-visible")!.declarations).toEqual({
      "outline-color": "var(--surface)",
    });
  });

  test("the narrow block has only the 40px button (R32)", () => {
    const narrow = css.filter((r) => r.media === "(max-width:719px)");
    expect(narrow.map((r) => r.selector)).toEqual([".toast button"]);
    expect(narrow[0]!.declarations).toEqual({ "min-height": "40px" });
  });

  test("the text of a toast is not cut: no overflow or nowrap rule", () => {
    for (const r of css) {
      expect(r.declarations["white-space"]).toBeUndefined();
      expect(r.declarations["text-overflow"]).toBeUndefined();
    }
  });
});

const VH = 800;

describe("computeToastBottom (R27)", () => {
  test("with no obstacle it is 20", () => {
    expect(computeToastBottom(VH, [])).toBe(20);
  });

  test("a bar whose top is 62 px above the bottom gives 76", () => {
    expect(
      computeToastBottom(VH, [{ top: VH - 62, left: 0, right: 360 }]),
    ).toBe(76);
  });

  test("two obstacles give the larger clearance", () => {
    expect(
      computeToastBottom(VH, [
        { top: VH - 62, left: 0, right: 360 },
        { top: VH - 200, left: 0, right: 360 },
      ]),
    ).toBe(214);
  });

  test("an obstacle below the window, one with NaN and one with no width are ignored", () => {
    expect(computeToastBottom(VH, [{ top: VH, left: 0, right: 360 }])).toBe(20);
    expect(
      computeToastBottom(VH, [{ top: VH + 50, left: 0, right: 360 }]),
    ).toBe(20);
    expect(
      computeToastBottom(VH, [{ top: Number.NaN, left: 0, right: 360 }]),
    ).toBe(20);
    expect(
      computeToastBottom(VH, [{ top: 700, left: Number.NaN, right: 360 }]),
    ).toBe(20);
    expect(computeToastBottom(VH, [{ top: 700, left: 100, right: 100 }])).toBe(
      20,
    );
    expect(computeToastBottom(VH, [{ top: 700, left: 100, right: 50 }])).toBe(
      20,
    );
  });

  test("a small clearance never gives less than 20", () => {
    // 800 - 790 + 14 = 24, and 800 - 799 + 14 = 15 gives 20.
    expect(computeToastBottom(VH, [{ top: 790, left: 0, right: 360 }])).toBe(
      24,
    );
    expect(computeToastBottom(VH, [{ top: 799, left: 0, right: 360 }])).toBe(
      20,
    );
  });

  describe("with an extent", () => {
    const extent = { left: 100, right: 300 };

    test("an obstacle whose span does not overlap is ignored", () => {
      expect(
        computeToastBottom(VH, [{ top: 700, left: 0, right: 90 }], extent),
      ).toBe(20);
      expect(
        computeToastBottom(VH, [{ top: 700, left: 310, right: 600 }], extent),
      ).toBe(20);
    });

    test("one that overlaps by 1 px counts", () => {
      expect(
        computeToastBottom(VH, [{ top: 700, left: 0, right: 101 }], extent),
      ).toBe(114);
      expect(
        computeToastBottom(VH, [{ top: 700, left: 299, right: 600 }], extent),
      ).toBe(114);
    });

    test("one that only touches does not", () => {
      expect(
        computeToastBottom(VH, [{ top: 700, left: 0, right: 100 }], extent),
      ).toBe(20);
      expect(
        computeToastBottom(VH, [{ top: 700, left: 300, right: 600 }], extent),
      ).toBe(20);
    });

    test("with no extent every obstacle counts", () => {
      expect(computeToastBottom(VH, [{ top: 700, left: 0, right: 90 }])).toBe(
        114,
      );
    });
  });
});

describe("computeToastExtent (R31)", () => {
  test("with no anchor at 360 px the width is 331.2 and the box is centred in the window", () => {
    const e = computeToastExtent(360);
    expect(e.width).toBeCloseTo(331.2, 5);
    expect(e.left).toBeCloseTo(14.4, 5);
  });

  test("with no anchor on a wide window the width is 480", () => {
    expect(computeToastExtent(1300)).toEqual({ left: 410, width: 480 });
  });

  test("an anchor 300 px wide gives 276 and centres on the anchor", () => {
    const e = computeToastExtent(1300, { left: 100, right: 400 });
    expect(e.width).toBeCloseTo(276, 5);
    expect(e.left).toBeCloseTo(250 - 138, 5);
  });

  test("an anchor wider than 480/0.92 gives 480", () => {
    expect(computeToastExtent(1300, { left: 272, right: 1300 })).toEqual({
      left: 272 + 514 - 240,
      width: 480,
    });
  });
});

// The placement: the region stays above what the layout registers (R28, R31).
type Rect = { top: number; left: number; right: number; height: number };
const rects = new WeakMap<Element, Rect>();

function stubRect(el: Element, rect: Rect) {
  rects.set(el, rect);
  (el as HTMLElement).getBoundingClientRect = () => {
    const r = rects.get(el)!;
    return {
      ...r,
      bottom: r.top + r.height,
      width: r.right - r.left,
      x: r.left,
      y: r.top,
      toJSON() {},
    } as DOMRect;
  };
}

// An element that registers itself as a thing that toasts must stay above.
function Avoid({ id, rect }: { id: string; rect: Rect }) {
  const ref = useRef<HTMLDivElement>(null);
  useToastAvoid(ref);
  return (
    <div
      data-testid={id}
      ref={(el) => {
        (ref as { current: HTMLDivElement | null }).current = el;
        if (el && !rects.has(el)) stubRect(el, rect);
      }}
    />
  );
}

function Anchor({ id, rect }: { id: string; rect: Rect }) {
  const ref = useRef<HTMLDivElement>(null);
  useToastAnchor(ref);
  return (
    <div
      data-testid={id}
      ref={(el) => {
        (ref as { current: HTMLDivElement | null }).current = el;
        if (el && !rects.has(el)) stubRect(el, rect);
      }}
    />
  );
}

let observers: Array<{
  cb: () => void;
  observed: Set<Element>;
  disconnected: boolean;
}> = [];
class StubResizeObserver {
  entry = { cb: () => {}, observed: new Set<Element>(), disconnected: false };
  constructor(cb: () => void) {
    this.entry.cb = cb;
    observers.push(this.entry);
  }
  observe(el: Element) {
    this.entry.observed.add(el);
  }
  unobserve(el: Element) {
    this.entry.observed.delete(el);
  }
  disconnect() {
    this.entry.disconnected = true;
    this.entry.observed.clear();
  }
}
const fireResize = () =>
  act(() => observers.forEach((o) => !o.disconnected && o.cb()));

function setWindow(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", {
    value: width,
    configurable: true,
  });
  Object.defineProperty(window, "innerHeight", {
    value: height,
    configurable: true,
  });
}

let placeApi!: ReturnType<typeof useToasts>;
function PlaceGrab() {
  placeApi = useToasts();
  return null;
}
const region = (c: HTMLElement) => c.querySelector(".toasts") as HTMLElement;
const bottom = (c: HTMLElement) => region(c).style.bottom;

describe("placement", () => {
  beforeEach(() => {
    observers = [];
    setWindow(1000, 800);
    vi.stubGlobal("ResizeObserver", StubResizeObserver);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("useToastAvoid (R28)", () => {
    test("with nothing registered the region is 20 px from the bottom and uses the CSS width", () => {
      const { container } = render(
        <ToastProvider>
          <PlaceGrab />
        </ToastProvider>,
      );
      expect(bottom(container)).toBe("20px");
      expect(region(container).style.left).toBe("");
      expect(region(container).style.width).toBe("");
    });

    test("a registered composer lifts the region 14 px above its top", () => {
      const { container } = render(
        <ToastProvider>
          <Avoid
            id="c"
            rect={{ top: 700, left: 0, right: 1000, height: 100 }}
          />
        </ToastProvider>,
      );
      expect(bottom(container)).toBe("114px");
    });

    test("it measures again when the element changes size, and when a toast is added", () => {
      const { container, getByTestId } = render(
        <ToastProvider>
          <PlaceGrab />
          <Avoid
            id="c"
            rect={{ top: 700, left: 0, right: 1000, height: 100 }}
          />
        </ToastProvider>,
      );
      const el = getByTestId("c");
      stubRect(el, { top: 650, left: 0, right: 1000, height: 150 });
      expect(bottom(container)).toBe("114px");
      fireResize();
      expect(bottom(container)).toBe("164px");
      // The element moved by a transform: no ResizeObserver call, a toast is added.
      stubRect(el, { top: 600, left: 0, right: 1000, height: 200 });
      act(() => void placeApi.show({ text: "x" }));
      expect(bottom(container)).toBe("214px");
    });

    test("it measures again on a resize of the window", () => {
      const { container } = render(
        <ToastProvider>
          <Avoid
            id="c"
            rect={{ top: 700, left: 0, right: 1000, height: 100 }}
          />
        </ToastProvider>,
      );
      setWindow(1000, 600);
      act(() => void fireEvent(window, new Event("resize")));
      expect(bottom(container)).toBe("20px");
    });

    test("it measures again on transitionend and transitioncancel of the element, without a ResizeObserver", () => {
      vi.stubGlobal("ResizeObserver", undefined);
      const { container, getByTestId } = render(
        <ToastProvider>
          <Avoid
            id="bar"
            rect={{ top: 740, left: 0, right: 1000, height: 60 }}
          />
        </ToastProvider>,
      );
      expect(bottom(container)).toBe("74px");
      const bar = getByTestId("bar");
      // The bar hides itself with translateY(100%): its top is now the window's bottom.
      stubRect(bar, { top: 800, left: 0, right: 1000, height: 60 });
      expect(bottom(container)).toBe("74px");
      act(() => void fireEvent(bar, new Event("transitionend")));
      expect(bottom(container)).toBe("20px");
      stubRect(bar, { top: 740, left: 0, right: 1000, height: 60 });
      act(() => void fireEvent(bar, new Event("transitioncancel")));
      expect(bottom(container)).toBe("74px");
    });

    test("it falls back to 20 px when the element is unregistered or has no height", () => {
      function Page({ show }: { show: boolean }) {
        return (
          <ToastProvider>
            {show ? (
              <Avoid
                id="c"
                rect={{ top: 700, left: 0, right: 1000, height: 100 }}
              />
            ) : null}
          </ToastProvider>
        );
      }
      const { container, rerender, getByTestId } = render(<Page show />);
      expect(bottom(container)).toBe("114px");
      stubRect(getByTestId("c"), { top: 700, left: 0, right: 1000, height: 0 });
      fireResize();
      expect(bottom(container)).toBe("20px");
      stubRect(getByTestId("c"), {
        top: 700,
        left: 0,
        right: 1000,
        height: 100,
      });
      fireResize();
      expect(bottom(container)).toBe("114px");
      rerender(<Page show={false} />);
      expect(bottom(container)).toBe("20px");
    });

    test("an element whose span does not overlap the region is ignored", () => {
      const { container } = render(
        <ToastProvider>
          <Anchor
            id="main"
            rect={{ top: 0, left: 272, right: 1000, height: 800 }}
          />
          <Avoid
            id="sidebar"
            rect={{ top: 700, left: 0, right: 272, height: 100 }}
          />
        </ToastProvider>,
      );
      expect(bottom(container)).toBe("20px");
    });

    test("with no ToastProvider above, the hooks do nothing", () => {
      expect(() =>
        render(
          <>
            <Avoid id="a" rect={{ top: 1, left: 0, right: 1, height: 1 }} />
            <Anchor id="b" rect={{ top: 1, left: 0, right: 1, height: 1 }} />
          </>,
        ),
      ).not.toThrow();
    });

    test("it disconnects its observer when the provider unmounts", () => {
      const { unmount } = render(
        <ToastProvider>
          <Avoid
            id="c"
            rect={{ top: 700, left: 0, right: 1000, height: 100 }}
          />
        </ToastProvider>,
      );
      expect(observers.some((o) => o.observed.size > 0)).toBe(true);
      unmount();
      expect(observers.every((o) => o.observed.size === 0)).toBe(true);
    });
  });

  describe("useToastAnchor (R31)", () => {
    test("the region is centred on the anchor and as wide as R31 says", () => {
      const { container } = render(
        <ToastProvider>
          <Anchor
            id="main"
            rect={{ top: 0, left: 100, right: 400, height: 800 }}
          />
        </ToastProvider>,
      );
      expect(region(container).style.width).toBe("276px");
      expect(region(container).style.left).toBe("250px");
    });

    test("a wide anchor gives 480 px", () => {
      const { container } = render(
        <ToastProvider>
          <Anchor
            id="main"
            rect={{ top: 0, left: 272, right: 1000, height: 800 }}
          />
        </ToastProvider>,
      );
      expect(region(container).style.width).toBe("480px");
      expect(region(container).style.left).toBe("636px");
    });

    test("it follows the anchor when the anchor changes", () => {
      const { container, getByTestId } = render(
        <ToastProvider>
          <Anchor
            id="main"
            rect={{ top: 0, left: 272, right: 1000, height: 800 }}
          />
        </ToastProvider>,
      );
      stubRect(getByTestId("main"), {
        top: 0,
        left: 68,
        right: 1000,
        height: 800,
      });
      fireResize();
      expect(region(container).style.left).toBe("534px");
    });

    test("the last anchor registered wins; with none the area is the window", () => {
      function Page({ both }: { both: boolean }) {
        return (
          <ToastProvider>
            <Anchor
              id="a"
              rect={{ top: 0, left: 100, right: 400, height: 800 }}
            />
            {both ? (
              <Anchor
                id="b"
                rect={{ top: 0, left: 0, right: 200, height: 800 }}
              />
            ) : null}
          </ToastProvider>
        );
      }
      const { container, rerender } = render(<Page both />);
      expect(region(container).style.left).toBe("100px");
      rerender(<Page both={false} />);
      expect(region(container).style.left).toBe("250px");
    });

    test("an anchor with no width counts as no anchor", () => {
      const { container } = render(
        <ToastProvider>
          <Anchor id="a" rect={{ top: 0, left: 0, right: 0, height: 800 }} />
        </ToastProvider>,
      );
      expect(region(container).style.left).toBe("");
    });
  });
  describe("the on-screen keyboard (R34)", () => {
    type Viewport = EventTarget & { height: number; offsetTop: number };
    const setViewport = (vv: Viewport | undefined) =>
      Object.defineProperty(window, "visualViewport", {
        value: vv,
        configurable: true,
      });
    const makeViewport = (height: number, offsetTop = 0): Viewport =>
      Object.assign(new EventTarget(), { height, offsetTop });
    afterEach(() => setViewport(undefined));

    const page = (composerTop?: number) => (
      <ToastProvider>
        {composerTop === undefined ? null : (
          <Avoid
            id="composer"
            rect={{ top: composerTop, left: 0, right: 1000, height: 100 }}
          />
        )}
      </ToastProvider>
    );

    test("toasts stay at least 20 px above the part of the window that the keyboard covers", () => {
      setViewport(makeViewport(500));
      const { container } = render(page());
      expect(bottom(container)).toBe("320px");
    });

    test("with the keyboard shut, or no visualViewport, nothing changes", () => {
      setViewport(makeViewport(800));
      const { container, unmount } = render(page());
      expect(bottom(container)).toBe("20px");
      unmount();
      setViewport(undefined);
      const again = render(page());
      expect(bottom(again.container)).toBe("20px");
    });

    test("the offset of the visual viewport counts", () => {
      setViewport(makeViewport(500, 100));
      const { container } = render(page());
      expect(bottom(container)).toBe("220px");
    });

    test("it is the larger of the composer value and the keyboard value, never their sum (both orders)", () => {
      // A composer low on the page: the keyboard value is larger.
      setViewport(makeViewport(500));
      const low = render(page(700));
      expect(bottom(low.container)).toBe("320px");
      low.unmount();
      // A composer already lifted above the keyboard (iOS): its value is larger.
      setViewport(makeViewport(500));
      const lifted = render(page(400));
      expect(bottom(lifted.container)).toBe("414px");
    });

    test("it follows resize and scroll events of the visual viewport", () => {
      const vv = makeViewport(800);
      setViewport(vv);
      const { container } = render(page());
      expect(bottom(container)).toBe("20px");
      vv.height = 450;
      act(() => void vv.dispatchEvent(new Event("resize")));
      expect(bottom(container)).toBe("370px");
      vv.offsetTop = 50;
      act(() => void vv.dispatchEvent(new Event("scroll")));
      expect(bottom(container)).toBe("320px");
    });

    test("it stops listening when the provider unmounts", () => {
      const vv = makeViewport(800);
      const remove = vi.spyOn(vv, "removeEventListener");
      setViewport(vv);
      const { unmount } = render(page());
      unmount();
      expect(remove).toHaveBeenCalledWith("resize", expect.any(Function));
      expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
    });
  });
});
