import { render } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import {
  badgeVariants,
  buttonSizes,
  buttonVariants,
  chipSizes,
  fieldVariants,
  iconButtonSizes,
} from "./components";
import { componentExamples } from "./examples";

const srcDir = import.meta.dirname;

function html(component: string): HTMLElement {
  const entry = componentExamples.find((e) => e.component === component);
  if (!entry) throw new Error(`no entry for ${component}`);
  const { container } = render(
    <>
      {entry.examples.map((e) => (
        <div key={e.id}>{e.element}</div>
      ))}
    </>,
  );
  return container;
}

// How each value of a list shows in the markup (R26).
const present: Array<[string, string, string]> = [
  ...buttonVariants.map((v): [string, string, string] => [
    "Button",
    `variant ${v}`,
    {
      default: ".btn:not(.primary):not(.danger):not(.ghost)",
      primary: ".btn.primary",
      danger: ".btn.danger",
      ghost: ".btn.ghost",
      link: ".linkbtn",
    }[v],
  ]),
  ...buttonSizes.map((s): [string, string, string] => [
    "Button",
    `size ${s}`,
    s === "sm" ? ".btn.sm" : ".btn:not(.sm)",
  ]),
  ...iconButtonSizes.map((s): [string, string, string] => [
    "IconButton",
    `size ${s}`,
    s === "sm" ? ".ib.sm" : ".ib:not(.sm)",
  ]),
  ["IconButton", "pressed true", '.ib[aria-pressed="true"]'],
  ["IconButton", "pressed false", '.ib[aria-pressed="false"]'],
  ...chipSizes.map((s): [string, string, string] => [
    "Chip",
    `size ${s}`,
    s === "sm" ? ".chip.sm" : ".chip:not(.sm)",
  ]),
  ["Chip", "pressed true", '.chip[aria-pressed="true"]'],
  ["Chip", "pressed false", '.chip[aria-pressed="false"]'],
  ["Chip", "ChipGroup", ".chips"],
  ["Switch", "checked true", '.sw[aria-checked="true"]'],
  ["Switch", "checked false", '.sw[aria-checked="false"]'],
  ...fieldVariants.map((v): [string, string, string] => [
    "Field",
    `variant ${v}`,
    { default: ".inp:not(.code)", code: ".inp.code", search: "label.field" }[v],
  ]),
  ["Field", "search without icon", "label.field:not(:has(svg))"],
  ["Field", "search with icon", "label.field svg"],
  ["Field", "input without a visible label", "input.inp[aria-label]"],
  ["Field", "textarea", "textarea.inp"],
  ["Field", "error", ".gerr"],
  ["Field", "readOnly", ".inp[readonly]"],
  ["Field", "disabled", ".inp[disabled]"],
  ["Select", "error", ".gerr"],
  ["Select", "disabled", ".sel[disabled]"],
  ["Tag", "tag", ".tag"],
  ...badgeVariants.map((v): [string, string, string] => [
    "Badge",
    `variant ${v}`,
    {
      default: ".cnt:not(.mute):not(.mn)",
      mute: ".cnt.mute",
      mention: ".cnt.mn",
    }[v],
  ]),
  // The nine items that the preview page checks by selector (R26).
  ["Button", "icon next to text", ".btn .ic"],
  ["Button", "fullWidth", ".btn.wide"],
  ["Button", "disabled link button", ".linkbtn[disabled]"],
  ["Select", "fullWidth", ".sel.wide"],
  ["Select", "label", ".lbl + .sel"],
  ["Badge", "label", ".cnt .sr"],
  ["Field", "search with error", ".field.invalid"],
  ["Field", "search readOnly", ".field.readonly"],
  ["Field", "search disabled", ".field.disabled"],
];

describe("examples (R26)", () => {
  test.each(present)("%s shows %s", (component, _what, selector) => {
    expect(
      html(component).querySelector(selector),
      `${component}: ${selector}`,
    ).not.toBeNull();
  });

  test("the entries come in the order of the spec", () => {
    expect(componentExamples.slice(0, 8).map((e) => e.component)).toEqual([
      "Button",
      "IconButton",
      "Chip",
      "Switch",
      "Field",
      "Select",
      "Tag",
      "Badge",
    ]);
  });

  test("ids are unique within a component and each example has a title", () => {
    for (const entry of componentExamples) {
      const ids = entry.examples.map((e) => e.id);
      expect(new Set(ids).size, entry.component).toBe(ids.length);
      for (const e of entry.examples) expect(e.title).not.toBe("");
    }
  });

  test("no file but examples.ts and the examples files imports an examples file", () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : [path];
      });
    for (const file of walk(srcDir)) {
      if (
        !/\.tsx?$/.test(file) ||
        file.endsWith("examples.ts") ||
        file.endsWith(".examples.tsx")
      )
        continue;
      if (file.endsWith("examples.test.tsx")) continue;
      expect(readFileSync(file, "utf8"), file).not.toMatch(/\.examples["']/);
    }
  });
});

describe("folders (R31)", () => {
  const dir = resolve(srcDir, "components");
  const folders = readdirSync(dir).filter((n) =>
    statSync(join(dir, n)).isDirectory(),
  );
  const index = readFileSync(join(dir, "index.ts"), "utf8");

  test.each(folders)(
    "%s has an index line, an examples file and an entry",
    (name) => {
      expect(index).toContain(`export * from "./${name}";`);
      expect(statSync(join(dir, name, `${name}.examples.tsx`)).isFile()).toBe(
        true,
      );
      expect(componentExamples.some((e) => e.component === name)).toBe(true);
    },
  );
});
