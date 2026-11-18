import { describe, expect, test } from "vitest";
import * as shell from "./index";
import * as entry from "../index";
import type {
  AppShellProps,
  BottomTabsProps,
  MoreTab,
  NavSection,
  PaneName,
} from "./index";
import type {
  AppShellProps as AppShellPropsEntry,
  BottomTabsProps as BottomTabsPropsEntry,
  MoreTab as MoreTabEntry,
  NavSection as NavSectionEntry,
  PaneName as PaneNameEntry,
} from "../index";

// A missing type fails `pnpm typecheck` on the imports above; the tuple uses
// each one. Each step of TOKI-015 adds its own names here.
type ShellTypes = [
  AppShellProps,
  BottomTabsProps,
  MoreTab,
  NavSection,
  PaneName,
  AppShellPropsEntry,
  BottomTabsPropsEntry,
  MoreTabEntry,
  NavSectionEntry,
  PaneNameEntry,
];
export type { ShellTypes };

describe("shell exports (R1)", () => {
  test("the shell exports the names built so far", () => {
    for (const name of [
      "AppShell",
      "WorkspaceHeader",
      "SearchBox",
      "UserCard",
      "derivePane",
      "BottomTabs",
      "useNarrow",
    ])
      expect(shell, name).toHaveProperty(name);
  });
  test("src/index.ts re-exports them", () => {
    expect(Object.keys(entry)).toEqual(
      expect.arrayContaining(Object.keys(shell)),
    );
    expect(entry).toHaveProperty("applyAppearance");
  });
});
