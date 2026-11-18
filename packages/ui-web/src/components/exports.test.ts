import { describe, expect, test } from "vitest";
import * as components from "./index";
import * as entry from "../index";

describe("exports (R1, R2)", () => {
  test("components/index.ts exports the nine components and the constants of R2", () => {
    for (const name of [
      "Button",
      "IconButton",
      "Chip",
      "ChipGroup",
      "Switch",
      "Field",
      "Select",
      "Tag",
      "Badge",
      "buttonVariants",
      "buttonSizes",
      "iconButtonSizes",
      "chipSizes",
      "fieldVariants",
      "badgeVariants",
    ]) {
      expect(components, name).toHaveProperty(name);
    }
  });

  test("src/index.ts re-exports the same names", () => {
    expect(Object.keys(entry).sort()).toEqual(
      expect.arrayContaining(Object.keys(components)),
    );
  });

  test("the lists are in the order of R2", () => {
    expect(components.buttonVariants).toEqual([
      "default",
      "primary",
      "danger",
      "ghost",
      "link",
    ]);
    expect(components.buttonSizes).toEqual(["md", "sm"]);
    expect(components.iconButtonSizes).toEqual(["md", "sm"]);
    expect(components.chipSizes).toEqual(["md", "sm"]);
    expect(components.fieldVariants).toEqual(["default", "code", "search"]);
    expect(components.badgeVariants).toEqual(["default", "mute", "mention"]);
  });

  test("no component export ends in Icon; the icons come from src/icons (R1)", () => {
    expect(
      Object.keys(components).filter((name) => name.endsWith("Icon")),
    ).toEqual([]);
    const extra = Object.keys(entry).filter((name) => !(name in components));
    expect(
      extra.filter((name) => !name.endsWith("Icon") && name !== "iconNames"),
    ).toEqual([]);
  });
});
