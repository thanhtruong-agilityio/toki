import { describe, expect, test } from "vitest";
import { createTranslator } from "@toki/i18n";
import {
  currentSectionId,
  sections,
  visibleSections,
} from "../../src/layout/sections";

// Technical design, Frontend, "Real paths" (R10, R30).
const paths: Record<string, string> = {
  home: "/",
  activity: "/activity",
  later: "/later",
  files: "/files",
  people: "/people",
  preferences: "/prefs",
  admin: "/admin",
};

describe("the section list (R10, R30)", () => {
  test("holds the Home row only, for now", () => {
    expect(sections.map((s) => s.id)).toEqual(["home"]);
  });

  test("every row is a phase 1 section with its path", () => {
    for (const row of sections) {
      expect(Object.keys(paths), row.id).toContain(row.id);
      expect(row.to, row.id).toBe(paths[row.id]);
    }
  });

  test("no row for a feature of a later phase", () => {
    const ids = sections.map((s) => s.id);
    for (const phase2 of ["mail", "calendar", "meet", "tasks"])
      expect(ids).not.toContain(phase2);
  });

  test("the Home row", () => {
    const home = sections[0]!;
    expect(home.icon).toBe("home");
    expect(home.labelKey).toBe("nav.home");
    expect(home.tab).toBe(true);
    expect(home.roles).toBeUndefined();
    expect(home.match("/")).toBe(true);
    expect(home.match("/c/abc")).toBe(true);
    expect(home.match("/c/abc/t/def")).toBe(true);
    expect(home.match("/activity")).toBe(false);
    expect(home.match("/cx")).toBe(false);
  });

  test("every label key is a message of the catalog", () => {
    const t = createTranslator("en");
    for (const row of sections) expect(t(row.labelKey)).not.toBe(row.labelKey);
  });
});

describe("visibleSections (R36)", () => {
  test("with no known role, only the rows with no roles", () => {
    expect(visibleSections().map((s) => s.id)).toEqual(["home"]);
    expect(visibleSections(undefined).every((s) => !s.roles)).toBe(true);
  });
  test("member and admin see the rows with no roles", () => {
    expect(visibleSections("member").map((s) => s.id)).toEqual(["home"]);
    expect(visibleSections("admin").map((s) => s.id)).toEqual(["home"]);
  });
  test("filters a list that is given (the shell fixture's)", () => {
    const rows = [
      { ...sections[0]!, id: "a" },
      { ...sections[0]!, id: "b", roles: ["admin" as const] },
    ];
    expect(visibleSections(undefined, rows).map((s) => s.id)).toEqual(["a"]);
    expect(visibleSections("member", rows).map((s) => s.id)).toEqual(["a"]);
    expect(visibleSections("admin", rows).map((s) => s.id)).toEqual(["a", "b"]);
  });
});

describe("currentSectionId (R30)", () => {
  test("the first visible row whose match is true", () => {
    const rows = [
      { id: "a", match: (p: string) => p === "/a" },
      { id: "b", match: (p: string) => p.startsWith("/a") },
    ];
    expect(currentSectionId(rows, "/a")).toBe("a");
    expect(currentSectionId(rows, "/ab")).toBe("b");
    expect(currentSectionId(rows, "/z")).toBeUndefined();
  });
  test("Home is current on /, /c/:id and /c/:id/t/:messageId", () => {
    for (const p of ["/", "/c/1", "/c/1/t/2"])
      expect(currentSectionId(sections, p)).toBe("home");
    expect(currentSectionId(sections, "/nowhere")).toBeUndefined();
  });
});
