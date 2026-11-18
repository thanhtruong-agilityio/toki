import { render } from "@testing-library/react";
import { resolve } from "node:path";
import { createRef } from "react";
import { describe, expect, test } from "vitest";
import { expectCssTable } from "../../test/css-table";
import { PresenceDot, presenceStates } from "./PresenceDot";

describe("PresenceDot (R11, R12, R14)", () => {
  test("presenceStates is active, away, dnd and has no meet or offline state", () => {
    expect(presenceStates).toEqual(["active", "away", "dnd"]);
  });

  test.each([
    ["active", "pd"],
    ["away", "pd away"],
    ["dnd", "pd dnd"],
  ] as const)("state %s renders a span with class %s", (state, cls) => {
    const { container } = render(<PresenceDot state={state} />);
    const dot = container.firstElementChild!;
    expect(dot.tagName).toBe("SPAN");
    expect(dot.className).toBe(cls);
    expect(container.textContent).toBe("");
  });

  test("className is appended after its own classes and ref points at the span", () => {
    const ref = createRef<HTMLSpanElement>();
    const { container } = render(
      <PresenceDot ref={ref} state="away" className="mine" />,
    );
    expect(container.firstElementChild!.className).toBe("pd away mine");
    expect(ref.current).toBe(container.firstElementChild);
  });

  test("without a label the dot is aria-hidden", () => {
    const { container } = render(<PresenceDot state="active" />);
    const dot = container.firstElementChild!;
    expect(dot.getAttribute("aria-hidden")).toBe("true");
    expect(dot.hasAttribute("role")).toBe(false);
    expect(dot.hasAttribute("aria-label")).toBe(false);
  });

  test("with a label the dot has role img and that aria-label", () => {
    const { container } = render(<PresenceDot state="dnd" label="Busy" />);
    const dot = container.firstElementChild!;
    expect(dot.getAttribute("role")).toBe("img");
    expect(dot.getAttribute("aria-label")).toBe("Busy");
    expect(dot.hasAttribute("aria-hidden")).toBe(false);
  });

  test("a caller cannot replace the owned attributes, even with a cast", () => {
    const owned = {
      role: "button",
      "aria-label": "x",
      "aria-hidden": "false",
    } as unknown as object;
    const { container } = render(<PresenceDot state="active" {...owned} />);
    const dot = container.firstElementChild!;
    expect(dot.getAttribute("aria-hidden")).toBe("true");
    expect(dot.hasAttribute("role")).toBe(false);
    expect(dot.hasAttribute("aria-label")).toBe(false);
  });

  test("other attributes go through", () => {
    const { container } = render(
      <PresenceDot state="active" data-x="1" title="t" />,
    );
    expect(container.firstElementChild!.getAttribute("data-x")).toBe("1");
  });

  test("the state is required (R12)", () => {
    // @ts-expect-error state has no default
    render(<PresenceDot />);
  });

  test("owned attributes are not accepted by the props type", () => {
    // @ts-expect-error role is owned
    render(<PresenceDot state="active" role="img" />);
  });
});

describe("PresenceDot.css (R13)", () => {
  test("holds the rules of the spec", () => {
    expectCssTable(resolve(import.meta.dirname, "PresenceDot.css"), [
      [
        ".pd",
        "width:11px; height:11px; border-radius:50%; border:2px solid var(--surface); background:var(--accent); display:inline-block; flex:none; box-sizing:border-box",
      ],
      [".pd.away", "background:var(--surface); border-color:var(--muted)"],
      [".pd.dnd", "background:var(--danger)"],
    ]);
  });
});
