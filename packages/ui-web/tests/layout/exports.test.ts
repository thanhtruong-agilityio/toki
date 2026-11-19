import { describe, expect, test } from "vitest";
import * as shell from "../../src/layout/index";
import * as entry from "../../src/index";
import type {
  AppShellProps,
  BottomTabsProps,
  MoreTab,
  NavSection,
  PaneName,
  SectionPageProps,
  SidePanelProps,
  TabListProps,
  TabProps,
} from "../../src/layout/index";
import type {
  AppShellProps as AppShellPropsEntry,
  BottomTabsProps as BottomTabsPropsEntry,
  MoreTab as MoreTabEntry,
  NavSection as NavSectionEntry,
  PaneName as PaneNameEntry,
  AppearanceOptions,
  Look,
  Accent,
  Density,
  SectionPageProps as SectionPagePropsEntry,
  SidePanelProps as SidePanelPropsEntry,
  TabListProps as TabListPropsEntry,
  TabProps as TabPropsEntry,
} from "../../src/index";

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
  SectionPageProps,
  SidePanelProps,
  TabListProps,
  TabProps,
  SectionPagePropsEntry,
  SidePanelPropsEntry,
  TabListPropsEntry,
  TabPropsEntry,
  AppearanceOptions,
  Look,
  Accent,
  Density,
];
export type { ShellTypes };

describe("shell exports (R1)", () => {
  // Every value name of R1; the types are checked by the tuple above.
  test("the shell exports every name of R1", () => {
    for (const name of [
      "AppShell",
      "BottomTabs",
      "WorkspaceHeader",
      "SearchBox",
      "UserCard",
      "SidePanel",
      "SectionPage",
      "TabList",
      "Tab",
      "derivePane",
      "useNarrow",
    ])
      expect(shell, name).toHaveProperty(name);
  });
  test("src/index.ts re-exports them", () => {
    expect(Object.keys(entry)).toEqual(
      expect.arrayContaining(Object.keys(shell)),
    );
    expect(entry).toHaveProperty("applyAppearance");
    for (const name of Object.keys(shell))
      expect(entry, name).toHaveProperty(name);
  });
});
