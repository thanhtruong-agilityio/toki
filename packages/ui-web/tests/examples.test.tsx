import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import {
  badgeVariants,
  buttonSizes,
  buttonVariants,
  chipSizes,
  dialogBackdrops,
  fieldVariants,
  iconButtonSizes,
  menuAligns,
  menuItemVariants,
} from "../src/components";
import { componentExamples } from "../src/examples";

// The folder this file sat in before the tests moved to tests/: its relative paths still start here.
const SRC_DIR = `${import.meta.dirname}/../src`;

const srcDir = SRC_DIR;

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

describe("overlay examples (TOKI-014 R30)", () => {
  const ids = (component: string) =>
    componentExamples
      .find((e) => e.component === component)!
      .examples.map((e) => e.id);

  test("Menu, Modal and Sheet come in that order after the entries of groups 1 and 2", () => {
    const names = componentExamples.map((e) => e.component);
    expect(names.indexOf("Menu")).toBeGreaterThan(names.indexOf("Badge"));
    expect(names.indexOf("Modal")).toBe(names.indexOf("Menu") + 1);
    expect(names.indexOf("Sheet")).toBe(names.indexOf("Modal") + 1);
  });

  test("the 13 ids", () => {
    expect(ids("Menu")).toEqual([
      "default",
      "start",
      "groups",
      "danger",
      "disabled",
      "icon",
    ]);
    expect(ids("Modal")).toEqual([
      "with-footer",
      "no-footer",
      "label-only",
      "opaque",
      "no-close",
    ]);
    expect(ids("Sheet")).toEqual(["rows", "long-body"]);
  });

  // How a value of each list shows in an example id (R30).
  const map: Array<[string, string, string]> = [
    ...menuAligns.map((v): [string, string, string] => [
      "Menu",
      `align ${v}`,
      { end: "default", start: "start" }[v],
    ]),
    ...menuItemVariants.map((v): [string, string, string] => [
      "Menu",
      `variant ${v}`,
      { default: "default", danger: "danger" }[v],
    ]),
    ...dialogBackdrops.map((v): [string, string, string] => [
      "Modal",
      `backdrop ${v}`,
      { dim: "with-footer", opaque: "opaque" }[v],
    ]),
  ];

  test.each(map)("%s: %s has an example", (component, _what, id) => {
    expect(ids(component)).toContain(id);
  });

  async function open(component: string, id: string) {
    const example = componentExamples
      .find((e) => e.component === component)!
      .examples.find((e) => e.id === id)!;
    const user = userEvent.setup();
    const { container } = render(<figure>{example.element}</figure>);
    const opener = container.querySelector("button") as HTMLButtonElement;
    await user.click(opener);
    return { user, opener, container };
  }

  const all: Array<[string, string]> = [
    ["Menu", "default"],
    ["Menu", "start"],
    ["Menu", "groups"],
    ["Menu", "danger"],
    ["Menu", "disabled"],
    ["Menu", "icon"],
    ["Modal", "with-footer"],
    ["Modal", "no-footer"],
    ["Modal", "label-only"],
    ["Modal", "opaque"],
    ["Modal", "no-close"],
    ["Sheet", "rows"],
    ["Sheet", "long-body"],
  ];

  test.each(all)(
    "%s %s: the first button opens the layer; it closes and gives focus back",
    async (component, id) => {
      const { user, opener } = await open(component, id);
      const role = component === "Menu" ? "menu" : "dialog";
      expect(screen.getByRole(role)).toBeInTheDocument();
      if (id === "opaque" || id === "no-close") {
        // Esc and an outside press leave it open; the button in the panel,
        // reached by Tab, closes it.
        await user.keyboard("{Escape}");
        await user.click(document.querySelector(".scrim") as HTMLElement);
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        const done = screen.getByRole("button", { name: "Done" });
        for (let i = 0; i < 4 && document.activeElement !== done; i++)
          await user.tab();
        expect(document.activeElement).toBe(done);
        await user.keyboard("{Enter}");
      } else {
        await user.keyboard("{Escape}");
      }
      expect(screen.queryByRole(role)).toBeNull();
      expect(document.activeElement).toBe(opener);
    },
  );

  test("every opening button of a dialog passes its own ref as returnFocusRef (R13)", () => {
    for (const [file, count] of [
      ["Modal/Modal.examples.tsx", 5],
      ["Sheet/Sheet.examples.tsx", 1],
    ] as const) {
      const text = readFileSync(join(srcDir, "components", file), "utf8");
      expect(text.match(/returnFocusRef=\{/g)).toHaveLength(count);
    }
  });

  test("what each example shows once open", async () => {
    const shows: Array<[string, string, string]> = [
      ["Menu", "default", '.menu[role="menu"]'],
      ["Menu", "start", '.menu[role="menu"]'],
      ["Menu", "groups", ".menu .mt"],
      ["Menu", "danger", ".menu button.dng"],
      ["Menu", "disabled", '.menu button[aria-disabled="true"]'],
      ["Menu", "icon", ".menu button .ic"],
      ["Modal", "with-footer", '.scrim .modal[role="dialog"] .mft'],
      ["Modal", "no-footer", ".scrim .modal .mbd"],
      ["Modal", "label-only", ".scrim .modal[aria-label]"],
      ["Modal", "opaque", ".scrim.opaque"],
      ["Sheet", "rows", ".scrim.sheet .modal"],
      ["Sheet", "long-body", ".scrim.sheet .modal"],
    ];
    for (const [component, id, selector] of shows) {
      const { user } = await open(component, id);
      expect(
        document.querySelector(selector),
        `${component} ${id}`,
      ).not.toBeNull();
      if (id === "with-footer")
        expect(document.querySelector(".scrim.opaque")).toBeNull();
      if (id === "groups") {
        expect(document.querySelectorAll(".menu [role=menuitem]")).toHaveLength(
          9,
        );
        expect(document.querySelectorAll(".menu .mt")).toHaveLength(3);
        expect(document.querySelectorAll(".menu hr")).toHaveLength(2);
      }
      await user.keyboard("{Escape}");
      cleanup();
    }
    // no-close has no header button.
    await open("Modal", "no-close");
    expect(document.querySelector(".mhd button")).toBeNull();
  });
});
