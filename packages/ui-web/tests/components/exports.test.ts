import { describe, expect, test } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import * as components from "../../src/components/index";
import * as entry from "../../src/index";
import * as appearance from "../../src/appearance";
import * as shell from "../../src/layout";
import * as join from "../../src/join";
import * as signIn from "../../src/sign-in";
import * as conversationList from "../../src/conversation-list";
import type {
  DialogCloseReason,
  MenuCloseReason,
  MenuGroupProps,
  MenuItemProps,
  MenuProps,
  MenuSeparatorProps,
  ModalProps,
  SheetProps,
} from "../../src/components/index";
import type {
  DialogCloseReason as DialogCloseReasonEntry,
  MenuCloseReason as MenuCloseReasonEntry,
  MenuGroupProps as MenuGroupPropsEntry,
  MenuItemProps as MenuItemPropsEntry,
  MenuProps as MenuPropsEntry,
  MenuSeparatorProps as MenuSeparatorPropsEntry,
  ModalProps as ModalPropsEntry,
  SheetProps as SheetPropsEntry,
} from "../../src/index";

// The folder this file sat in before the tests moved to tests/: its relative paths still start here.
const SRC_DIR = `${import.meta.dirname}/../../src/components`;

// A missing type makes `pnpm typecheck` fail on the imports above; the tuple
// uses each one so that none is reported as unused.
type OverlayTypes = [
  MenuProps,
  MenuItemProps,
  MenuGroupProps,
  MenuSeparatorProps,
  MenuCloseReason,
  ModalProps,
  SheetProps,
  DialogCloseReason,
  MenuPropsEntry,
  MenuItemPropsEntry,
  MenuGroupPropsEntry,
  MenuSeparatorPropsEntry,
  MenuCloseReasonEntry,
  ModalPropsEntry,
  SheetPropsEntry,
  DialogCloseReasonEntry,
];
export type { OverlayTypes };

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

  test("components/index.ts exports the names of the confirmation dialog (TOKI-093 R1)", () => {
    for (const name of [
      "ConfirmDialog",
      "confirmVariants",
      "confirmCancelReasons",
    ]) {
      expect(components, name).toHaveProperty(name);
    }
  });

  test("components/index.ts exports the names of the overlays (TOKI-014 R1)", () => {
    for (const name of [
      "Menu",
      "MenuItem",
      "MenuGroup",
      "MenuSeparator",
      "menuAligns",
      "menuItemVariants",
      "menuCloseReasons",
      "useMenuTrigger",
      "computeMenuPosition",
      "Modal",
      "Sheet",
      "dialogBackdrops",
      "dialogCloseReasons",
    ]) {
      expect(components, name).toHaveProperty(name);
    }
    // Dialog is shared by Modal and Sheet and is not exported.
    expect(components).not.toHaveProperty("Dialog");
    expect(components.menuAligns).toEqual(["end", "start"]);
    expect(components.menuItemVariants).toEqual(["default", "danger"]);
    expect(components.menuCloseReasons).toEqual([
      "select",
      "escape",
      "tab",
      "outside",
    ]);
    expect(components.dialogBackdrops).toEqual(["dim", "opaque"]);
    expect(components.dialogCloseReasons).toEqual([
      "escape",
      "outside",
      "close",
    ]);
  });

  test("each overlay folder holds its component, css, examples and index, and its test is in tests (TOKI-014 R1)", () => {
    for (const name of ["Menu", "Modal", "Sheet"]) {
      // The test sits in tests/components/<name>/, not beside the source.
      expect(
        existsSync(resolve(import.meta.dirname, name, `${name}.test.tsx`)),
        `${name}/${name}.test.tsx`,
      ).toBe(true);
      for (const file of [
        `${name}.tsx`,
        `${name}.css`,
        `${name}.examples.tsx`,
        "index.ts",
      ]) {
        expect(
          existsSync(resolve(SRC_DIR, name, file)),
          `${name}/${file}`,
        ).toBe(true);
      }
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
    // The shell and appearance exports come from their own modules (TOKI-015 R1);
    // the sign-in pieces from src/sign-in (TOKI-023), the Join pages from src/join (TOKI-097) and
    // the conversation list from src/conversation-list (TOKI-033).
    const extra = Object.keys(entry).filter(
      (name) =>
        !(name in components) &&
        !(name in appearance) &&
        !(name in shell) &&
        !(name in signIn) &&
        !(name in join) &&
        !(name in conversationList),
    );
    expect(
      extra.filter((name) => !name.endsWith("Icon") && name !== "iconNames"),
    ).toEqual([]);
  });
});
