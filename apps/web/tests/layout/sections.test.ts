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
  test("holds the Home, Admin and Preferences rows, for now", () => {
    expect(sections.map((s) => s.id)).toEqual(["home", "admin", "preferences"]);
  });

  test("the Admin row sits after People and before Preferences, whichever of them exist (TOKI-025 R2)", () => {
    const ids = visibleSections("admin").map((s) => s.id);
    const at = ids.indexOf("admin");
    expect(at).toBeGreaterThan(-1);
    if (ids.includes("people"))
      expect(at).toBeGreaterThan(ids.indexOf("people"));
    if (ids.includes("preferences"))
      expect(at).toBeLessThan(ids.indexOf("preferences"));
  });

  test("the Admin row (TOKI-025 R2)", () => {
    const admin = sections.find((s) => s.id === "admin")!;
    expect(admin.icon).toBe("shield");
    expect(admin.labelKey).toBe("nav.admin");
    expect(admin.to).toBe("/admin");
    expect(admin.roles).toEqual(["admin"]);
    expect(admin.more).toBe(true);
    expect(admin.tab).toBeUndefined();
    expect(admin.match("/admin")).toBe(true);
    expect(admin.match("/admin/anything")).toBe(true);
    expect(admin.match("/administrator")).toBe(false);
    expect(admin.match("/")).toBe(false);
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

  test("the Preferences row (TOKI-099 R21)", () => {
    const row = sections.find((s) => s.id === "preferences")!;
    expect(row.icon).toBe("settings");
    expect(row.labelKey).toBe("nav.preferences");
    expect(row.to).toBe("/prefs");
    // TOKI-145 R5: Calm shows the row on its rail, so no row says it is hidden.
    expect(row).not.toHaveProperty("calmHidden");
    expect(row.more).toBe(true);
    expect(row.roles).toBeUndefined();
    expect(row.match("/prefs")).toBe(true);
    expect(row.match("/prefs/anything")).toBe(true);
    expect(row.match("/")).toBe(false);
  });

  test("Preferences is the last row of every role, so a row added later goes above it", () => {
    for (const role of ["member", "admin"] as const)
      expect(visibleSections(role).at(-1)?.id).toBe("preferences");
  });

  test("every label key is a message of the catalog", () => {
    const t = createTranslator("en");
    for (const row of sections) expect(t(row.labelKey)).not.toBe(row.labelKey);
  });
});

describe("visibleSections (R36)", () => {
  test("only an admin sees the Admin row", () => {
    expect(visibleSections("admin").map((s) => s.id)).toContain("admin");
    expect(visibleSections("member").map((s) => s.id)).not.toContain("admin");
    expect(visibleSections(undefined).map((s) => s.id)).not.toContain("admin");
  });
  test("with no known role, only the rows with no roles", () => {
    expect(visibleSections().map((s) => s.id)).toEqual(["home", "preferences"]);
    expect(visibleSections(undefined).every((s) => !s.roles)).toBe(true);
  });
  test("member and admin see the rows with no roles", () => {
    expect(visibleSections("member").map((s) => s.id)).toEqual([
      "home",
      "preferences",
    ]);
    expect(visibleSections("admin").map((s) => s.id)).toEqual([
      "home",
      "admin",
      "preferences",
    ]);
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
