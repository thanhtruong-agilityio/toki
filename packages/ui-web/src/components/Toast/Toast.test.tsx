import {
  act,
  fireEvent,
  render,
  screen,
  type RenderResult,
} from "@testing-library/react";
import { resolve } from "node:path";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { readCss } from "../../test/css";
import { Toast } from "./Toast";
import { ToastProvider, useToasts } from "./ToastProvider";
import { TOAST_MS_PLAIN, TOAST_MS_WITH_ACTION } from "./toastPlace";

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
