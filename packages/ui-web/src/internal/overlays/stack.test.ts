import { afterEach, describe, expect, test, vi } from "vitest";
import {
  isPressHandled,
  isTop,
  layerCount,
  layersAbove,
  markPressHandled,
  nextOrder,
  pushLayer,
  removeLayer,
} from "./stack";

const ids: number[] = [];
let seq = 1000;

function add(
  kind: "dialog" | "menu",
  close: () => void = () => {},
  order = nextOrder(),
) {
  const id = seq++;
  ids.push(id);
  pushLayer({ id, order, kind, close, getNode: () => null });
  return id;
}

function esc(init: KeyboardEventInit = {}, target: Node = document.body) {
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

afterEach(() => {
  for (const id of ids.splice(0)) removeLayer(id);
  vi.restoreAllMocks();
});

describe("stack of layers (R4, R9)", () => {
  test("the Esc listener is on document, in the capture phase, only while the stack is not empty", () => {
    const add$ = vi.spyOn(document, "addEventListener");
    const remove$ = vi.spyOn(document, "removeEventListener");
    const a = add("dialog");
    const b = add("menu");
    const keydowns = add$.mock.calls.filter((c) => c[0] === "keydown");
    expect(keydowns).toHaveLength(1);
    expect(keydowns[0]![2]).toBe(true);
    removeLayer(a);
    expect(remove$.mock.calls.filter((c) => c[0] === "keydown")).toHaveLength(
      0,
    );
    removeLayer(b);
    const removed = remove$.mock.calls.filter((c) => c[0] === "keydown");
    expect(removed).toHaveLength(1);
    expect(removed[0]![2]).toBe(true);
    expect(layerCount()).toBe(0);
  });

  test("with an empty stack the event is not touched", () => {
    const event = esc();
    expect(event.defaultPrevented).toBe(false);
  });

  test("one press asks one layer; the event is prevented and stopped", () => {
    const close = vi.fn();
    add("dialog", close);
    const bubble = vi.fn();
    document.addEventListener("keydown", bubble);
    const event = esc();
    document.removeEventListener("keydown", bubble);
    expect(close).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledWith("escape");
    expect(event.defaultPrevented).toBe(true);
    expect(bubble).not.toHaveBeenCalled();
  });

  test("a key other than Escape is left alone", () => {
    const close = vi.fn();
    add("dialog", close);
    const event = esc({ key: "a" });
    expect(close).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  test("three layers, three presses: the menu, then B, then A", () => {
    const calls: string[] = [];
    const ids3: Record<string, number> = {};
    for (const name of ["A", "B", "menu"]) {
      ids3[name] = add(name === "menu" ? "menu" : "dialog", () => {
        calls.push(name);
        removeLayer(ids3[name]!);
      });
    }
    esc();
    esc();
    esc();
    expect(calls).toEqual(["menu", "B", "A"]);
  });

  test("the order is the counter, not the order of the pushes", () => {
    const calls: string[] = [];
    const first = nextOrder();
    const second = nextOrder();
    // The child (higher order) pushes first, as in one commit.
    add("menu", () => calls.push("child"), second);
    add("dialog", () => calls.push("parent"), first);
    esc();
    expect(calls).toEqual(["child"]);
  });

  test("isTop and layersAbove", () => {
    const a = add("dialog");
    const b = add("dialog");
    expect(isTop(a)).toBe(false);
    expect(isTop(b)).toBe(true);
    expect(layersAbove(a).map((l) => l.id)).toEqual([b]);
    expect(layersAbove(b)).toEqual([]);
    expect(layerCount()).toBe(2);
  });

  test("Escape during composition is ignored and not stopped", () => {
    const close = vi.fn();
    add("dialog", close);
    const composing = esc({ isComposing: true });
    expect(composing.defaultPrevented).toBe(false);
    const safari = esc({ keyCode: 229 });
    expect(safari.defaultPrevented).toBe(false);
    expect(close).not.toHaveBeenCalled();
  });

  test("the latest close handler is the one called", () => {
    const id = seq++;
    ids.push(id);
    const first = vi.fn();
    const second = vi.fn();
    let current = first;
    pushLayer({
      id,
      order: nextOrder(),
      kind: "dialog",
      close: (reason) => current(reason),
      getNode: () => null,
    });
    current = second;
    esc();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe("handled presses (R10)", () => {
  test("a marked press is reported as handled; another is not", () => {
    const a = new Event("pointerdown");
    const b = new Event("pointerdown");
    markPressHandled(a);
    expect(isPressHandled(a)).toBe(true);
    expect(isPressHandled(b)).toBe(false);
  });
});
