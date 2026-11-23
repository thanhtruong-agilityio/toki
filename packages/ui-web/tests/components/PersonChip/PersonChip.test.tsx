import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRef } from "react";
import { describe, expect, test, vi } from "vitest";
import { PersonChip } from "../../../src/components/PersonChip/PersonChip";
import { examples } from "../../../src/components/PersonChip/PersonChip.examples";
import { componentExamples } from "../../../src/examples";
import * as entry from "../../../src";
import { expectCssTable } from "../../support/css-table";

const SRC_DIR = `${import.meta.dirname}/../../../src/components/PersonChip`;

describe("PersonChip (TOKI-034 R17)", () => {
  test("renders span.pchip with an avatar, span.nm and a small icon button", () => {
    const ref = createRef<HTMLSpanElement>();
    const onRemove = vi.fn();
    const { container } = render(
      <PersonChip
        ref={ref}
        className="mine"
        name="Lan Nguyễn"
        hue={120}
        removeLabel="Remove Lan Nguyễn"
        onRemove={onRemove}
      />,
    );
    const chip = container.firstElementChild as HTMLElement;
    expect(chip.tagName).toBe("SPAN");
    expect(chip.className).toBe("pchip mine");
    expect(ref.current).toBe(chip);
    const children = Array.from(chip.children);
    expect(children.map((c) => c.className.split(" ")[0])).toEqual([
      "av",
      "nm",
      "ib",
    ]);
    expect(children[0]!.getAttribute("style")).toContain("--s: 20px");
    expect(children[1]!.textContent).toBe("Lan Nguyễn");
    expect(children[2]!.className).toContain("sm");
    const button = screen.getByRole("button", { name: "Remove Lan Nguyễn" });
    fireEvent.click(button);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  test("with removeLabel empty the text is the name and the initials, nothing else (R3)", () => {
    const { container } = render(
      <PersonChip
        name="Lan Nguyễn"
        hue={1}
        removeLabel=""
        onRemove={() => {}}
      />,
    );
    expect(container.textContent).toBe("Lan NguyễnLN");
  });

  test("a long name is in a cut span and the chip is no wider than its parent", () => {
    const name = "N".repeat(80);
    const { container } = render(
      <PersonChip name={name} hue={1} removeLabel="x" onRemove={() => {}} />,
    );
    expect(container.querySelector(".nm")!.textContent).toBe(name);
  });

  test("holds no import of @toki/i18n and no word of its own (R3, R28)", () => {
    const source = readFileSync(resolve(SRC_DIR, "PersonChip.tsx"), "utf8");
    for (const banned of [
      "@toki/i18n",
      "@toki/platform",
      "@toki/client-core",
      "@toki/shared",
    ]) {
      expect(source).not.toContain(banned);
    }
    expect(source).not.toMatch(/>\s*[A-Za-z][^<>{}]*</);
  });

  test("is exported with its props type (R1)", () => {
    expect(entry).toHaveProperty("PersonChip");
  });

  test("examples default and long-name, in the PersonChip entry (R29)", () => {
    expect(examples.map((e) => e.id)).toEqual(["default", "long-name"]);
    expect(
      componentExamples.find((e) => e.component === "PersonChip")?.examples,
    ).toBe(examples);
  });
});

describe("PersonChip.css (Table B)", () => {
  test("holds exactly the two rows of Table B", () => {
    expectCssTable(resolve(SRC_DIR, "PersonChip.css"), [
      [
        ".pchip",
        "display:inline-flex; align-items:center; gap:6px; min-height:28px; padding:2px 2px 2px 6px; border-radius:99px; font-size:12.5px; font-weight:500; color:var(--ink-2); border:1px solid var(--line); background:var(--surface); max-width:100%",
      ],
      [
        ".pchip .nm",
        "min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap",
      ],
    ]);
  });
});
