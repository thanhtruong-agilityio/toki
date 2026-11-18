import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resolve } from "node:path";
import { createRef } from "react";
import { describe, expect, test, vi } from "vitest";
import { expectCssTable } from "../../test/css-table";
import { Chip, ChipGroup, chipSizes } from "./Chip";

describe("Chip and ChipGroup (R13, Table B)", () => {
  test("renders a button of type button, class chip, no aria-pressed by default", () => {
    render(<Chip>All</Chip>);
    const chip = screen.getByRole("button", { name: "All" });
    expect(chip).toHaveAttribute("type", "button");
    expect(chip.className).toBe("chip");
    expect(chip).not.toHaveAttribute("aria-pressed");
    expect(chipSizes).toEqual(["md", "sm"]);
  });

  test("pressed sets aria-pressed and adds no class", () => {
    const { rerender } = render(<Chip pressed>a</Chip>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button").className).toBe("chip");
    rerender(<Chip pressed={false}>a</Chip>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  });

  test("class order is chip, sm, className; owned attributes win over a cast", () => {
    const hostile = { type: "submit", "aria-pressed": "true" } as object;
    render(
      <Chip size="sm" className="mine" {...hostile}>
        a
      </Chip>,
    );
    const chip = screen.getByRole("button");
    expect(chip.className).toBe("chip sm mine");
    expect(chip).toHaveAttribute("type", "button");
    expect(chip).not.toHaveAttribute("aria-pressed");
  });

  test("ref, click, keys and disabled", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLButtonElement>();
    const onClick = vi.fn();
    const { rerender } = render(
      <Chip ref={ref} onClick={onClick}>
        a
      </Chip>,
    );
    expect(ref.current).toBe(screen.getByRole("button"));
    await user.click(ref.current!);
    await user.keyboard(" ");
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(3);
    onClick.mockClear();
    rerender(
      <Chip onClick={onClick} disabled>
        a
      </Chip>,
    );
    await user.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  test("ChipGroup is a div with class chips and role group, with an optional name", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <ChipGroup ref={ref} aria-label="Filter" className="mine">
        <Chip>a</Chip>
      </ChipGroup>,
    );
    const group = screen.getByRole("group", { name: "Filter" });
    expect(group.tagName).toBe("DIV");
    expect(group.className).toBe("chips mine");
    expect(ref.current).toBe(group);
  });

  test("with no children the text is empty (R3)", () => {
    const { container } = render(
      <>
        <Chip />
        <ChipGroup />
      </>,
    );
    expect(container.textContent).toBe("");
  });
});

describe("Chip.css (R5, R8, Table E and I)", () => {
  test("holds exactly the rows of Table E and the narrow row of Table I", () => {
    expectCssTable(
      resolve(import.meta.dirname, "Chip.css"),
      [
        [
          ".chip",
          "display:inline-flex; align-items:center; gap:6px; height:28px; padding:0 12px; border-radius:99px; font-size:12.5px; font-weight:500; color:var(--ink-2); border:1px solid var(--line); background:var(--surface); transition:background .15s,color .15s,border-color .15s; white-space:nowrap",
        ],
        [".chip:hover:where(:not([disabled]))", "background:var(--hover)"],
        [
          '.chip[aria-pressed="true"]',
          "background:var(--accent-soft); color:var(--accent-text); border-color:transparent",
        ],
        [".chip.sm", "height:26px"],
        [".chip[disabled]", "opacity:.5; cursor:not-allowed"],
        [".chips", "display:flex; gap:6px; flex-wrap:wrap"],
      ],
      [[".chip", "min-height:40px; height:36px"]],
    );
  });
});
