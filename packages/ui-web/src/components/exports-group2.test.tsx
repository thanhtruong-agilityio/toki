import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import * as components from "./index";
import * as entry from "../index";
import { componentExamples } from "../examples";

const names = [
  "Avatar",
  "getInitials",
  "PresenceDot",
  "presenceStates",
  "EmptyState",
  "Toast",
  "ToastProvider",
  "ToastRegion",
  "useToasts",
  "useToastAvoid",
  "useToastAnchor",
  "computeToastBottom",
  "computeToastExtent",
  "TOAST_MS_WITH_ACTION",
  "TOAST_MS_PLAIN",
];

describe("exports of group 2 (R1, R2)", () => {
  test.each(names)("components/index.ts exports %s", (name) => {
    expect(components).toHaveProperty(name);
  });

  test("src/index.ts re-exports them, with its own line unchanged", () => {
    for (const name of names) expect(entry).toHaveProperty(name);
  });
});

function html(component: string): HTMLElement {
  const found = componentExamples.find((e) => e.component === component);
  if (!found) throw new Error(`no entry for ${component}`);
  const { container } = render(
    <>
      {found.examples.map((e) => (
        <div key={e.id}>{e.element}</div>
      ))}
    </>,
  );
  return container;
}

describe("examples of group 2 (R30)", () => {
  test("the entries follow group 1 in the order of the spec", () => {
    expect(componentExamples.slice(8, 12).map((e) => e.component)).toEqual([
      "Avatar",
      "PresenceDot",
      "EmptyState",
      "Toast",
    ]);
  });

  test("Avatar shows the density size, 46, the sizes 18, 24, 30 and 64, three presences, a one-word and a long name", () => {
    const c = html("Avatar");
    const sizeOf = (el: Element) =>
      (el as HTMLElement).style.getPropertyValue("--s");
    const avs = Array.from(c.querySelectorAll(".av"));
    const sizes = avs.map(sizeOf);
    for (const s of ["", "46px", "18px", "24px", "30px", "64px"])
      expect(sizes, s).toContain(s);
    for (const cls of ["active", "away", "dnd"]) {
      const dot =
        cls === "active" ? ".pdw .pd:not(.away):not(.dnd)" : `.pdw .pd.${cls}`;
      expect(c.querySelector(dot), cls).not.toBeNull();
    }
    expect(avs.some((a) => a.textContent!.length === 1)).toBe(true);
    expect(avs.some((a) => a.textContent === "KV")).toBe(true);
  });

  test("PresenceDot shows each state with and without a label", () => {
    const c = html("PresenceDot");
    expect(c.querySelectorAll(".pd")).toHaveLength(6);
    expect(c.querySelectorAll(".pd.away")).toHaveLength(2);
    expect(c.querySelectorAll(".pd.dnd")).toHaveLength(2);
    expect(c.querySelectorAll('.pd[role="img"]')).toHaveLength(3);
  });

  test("EmptyState shows one with and one without an action", () => {
    const c = html("EmptyState");
    const empties = Array.from(c.querySelectorAll(".empty"));
    expect(empties.some((e) => e.querySelector(".btn"))).toBe(true);
    expect(empties.some((e) => !e.querySelector(".btn"))).toBe(true);
  });

  test("Toast shows one without an action, one with an action and a long text", () => {
    const c = html("Toast");
    const toasts = Array.from(c.querySelectorAll(".toast"));
    expect(toasts.some((t) => !t.querySelector("button"))).toBe(true);
    expect(toasts.some((t) => t.querySelector("button"))).toBe(true);
    expect(toasts.some((t) => t.textContent!.length > 80)).toBe(true);
  });
});
