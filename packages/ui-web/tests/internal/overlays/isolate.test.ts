import { afterEach, describe, expect, test } from "vitest";
import { isolate } from "../../../src/internal/overlays/isolate";

function el(
  parent: HTMLElement,
  id: string,
  attrs: Record<string, string> = {},
) {
  const node = document.createElement("div");
  node.id = id;
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  parent.appendChild(node);
  return node;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("isolation (R15, R34)", () => {
  test("every other child of body gets inert and aria-hidden; the own portal does not", () => {
    const a = el(document.body, "a");
    const b = el(document.body, "b");
    const own = el(document.body, "own");
    const release = isolate(own);
    for (const node of [a, b]) {
      expect(node).toHaveAttribute("inert");
      expect(node).toHaveAttribute("aria-hidden", "true");
    }
    expect(own).not.toHaveAttribute("inert");
    expect(own).not.toHaveAttribute("aria-hidden");
    release();
    for (const node of [a, b]) {
      expect(node).not.toHaveAttribute("inert");
      expect(node).not.toHaveAttribute("aria-hidden");
    }
  });

  test("an element that had the attributes gets them back as they were", () => {
    const a = el(document.body, "a", { inert: "", "aria-hidden": "false" });
    const own = el(document.body, "own");
    const release = isolate(own);
    expect(a).toHaveAttribute("aria-hidden", "true");
    release();
    expect(a).toHaveAttribute("inert", "");
    expect(a).toHaveAttribute("aria-hidden", "false");
  });

  test("two isolations restore correctly in any order", () => {
    const a = el(document.body, "a");
    const own1 = el(document.body, "own1");
    const release1 = isolate(own1);
    const own2 = el(document.body, "own2");
    const release2 = isolate(own2);
    // own1 is isolated by the second; a by both.
    expect(own1).toHaveAttribute("inert");
    release1();
    expect(a).toHaveAttribute("inert");
    expect(own1).toHaveAttribute("inert");
    release2();
    expect(a).not.toHaveAttribute("inert");
    expect(own1).not.toHaveAttribute("inert");
  });

  test("releasing twice does nothing the second time", () => {
    const a = el(document.body, "a");
    const own = el(document.body, "own");
    const release = isolate(own);
    release();
    a.setAttribute("inert", "");
    release();
    expect(a).toHaveAttribute("inert");
  });

  test("an element with data-layer-skip, and its containers, are left alone; the siblings along the way are isolated", () => {
    const root = el(document.body, "root");
    const pane = el(root, "pane");
    const inner = el(pane, "inner");
    const region = el(root, "region", { "data-layer-skip": "" });
    const other = el(document.body, "other");
    const own = el(document.body, "own");
    const release = isolate(own);
    expect(root).not.toHaveAttribute("inert");
    expect(root).not.toHaveAttribute("aria-hidden");
    expect(region).not.toHaveAttribute("inert");
    expect(region).not.toHaveAttribute("aria-hidden");
    expect(pane).toHaveAttribute("inert");
    expect(pane).toHaveAttribute("aria-hidden", "true");
    expect(inner).not.toHaveAttribute("inert");
    expect(other).toHaveAttribute("inert");
    release();
    for (const node of [root, pane, region, other])
      expect(node).not.toHaveAttribute("inert");
  });

  test("nothing is left when it has nothing to isolate", () => {
    const own = el(document.body, "own");
    const release = isolate(own);
    release();
    expect(document.querySelectorAll("[inert],[aria-hidden]")).toHaveLength(0);
  });
});
