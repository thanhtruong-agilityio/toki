import { describe, expect, test } from "vitest";
import { ownSources } from "./support";

// R2: `deps.ts` is the only file of this change that imports the client package or the client.
// R3: no JSX text with a letter. R6, R7: no role is compared here (TOKI-027 R16). R12: no delete.
function hasClientImport(text: string): boolean {
  return /from\s+["'](?:@toki\/client-core|(?:\.\.?\/)+client)["']/.test(text);
}
const hasJsxLetterText = (text: string) =>
  /<[A-Za-z][^<>]*>\s*[A-Za-z][^<>{}]*</.test(text);
const comparesRole = (text: string) =>
  /role\s*[!=]==?\s*["'](admin|member)["']|["'](admin|member)["']\s*[!=]==?\s*\w*\.?role/.test(
    text,
  );
const mentionsDelete = (text: string) =>
  /deleteChannel|removeChannel|method:\s*["']DELETE["']|["'`]DELETE["'`]|\/channels\/[^"'`]*DELETE/.test(
    text,
  );

describe("the scans see what they look for (negative controls)", () => {
  test("client import", () => {
    expect(hasClientImport('import { api } from "../client";')).toBe(true);
    expect(hasClientImport('import x from "@toki/client-core";')).toBe(true);
    expect(hasClientImport('import x from "./deps";')).toBe(false);
  });
  test("jsx text", () => {
    expect(hasJsxLetterText("<p>Hello</p>")).toBe(true);
    expect(hasJsxLetterText("<p>{t('x')}</p>")).toBe(false);
  });
  test("role comparison", () => {
    expect(comparesRole('if (user.role === "admin") {}')).toBe(true);
    expect(comparesRole("canArchiveChannel(actor, facts)")).toBe(false);
  });
  test("delete", () => {
    expect(mentionsDelete("conversations.deleteChannel(id)")).toBe(true);
    expect(mentionsDelete('fetch(u, { method: "DELETE" })')).toBe(true);
    expect(mentionsDelete("archiveChannel(id)")).toBe(false);
  });
});

describe("the sources of the folder", () => {
  const sources = ownSources();
  test("the folder has sources", () => {
    expect(sources.map((s) => s.name)).toContain("deps.ts");
  });
  test("no file but deps.ts imports @toki/client-core or the client", () => {
    for (const file of sources) {
      if (file.name === "deps.ts") continue;
      expect(hasClientImport(file.text), file.name).toBe(false);
    }
  });
  test("no JSX text node holds a letter (R3)", () => {
    for (const file of sources.filter((s) => s.name.endsWith(".tsx"))) {
      expect(hasJsxLetterText(file.text), file.name).toBe(false);
    }
  });
  test("no role is compared to a string (TOKI-027 R16)", () => {
    for (const file of sources)
      expect(comparesRole(file.text), file.name).toBe(false);
  });
  test("no source holds a style attribute or an !important (R4)", () => {
    for (const file of sources.filter((s) => /\.tsx?$/.test(s.name))) {
      expect(file.text, file.name).not.toMatch(/\bstyle=/);
      expect(file.text, file.name).not.toMatch(/!important/);
    }
  });
  test("the files of R1 exist and index.ts exports its names", async () => {
    const names = sources.map((s) => s.name);
    for (const file of [
      "deps.ts",
      "access.ts",
      "archiveFlow.ts",
      "restoreFlow.ts",
      "ArchiveSection.tsx",
      "useArchiveChannel.ts",
      "ArchivedChannelPage.tsx",
      "ArchivedHeader.tsx",
      "ArchivedNotice.tsx",
      "ArchivedHistory.tsx",
      "archivedDetail.ts",
      "RestoreButton.tsx",
      "useRestoreChannel.ts",
      "archive.css",
      "index.ts",
    ]) {
      expect(names, file).toContain(file);
    }
    const index = (await import("../../src/channel-archive/index")) as Record<
      string,
      unknown
    >;
    for (const name of [
      "ArchiveSection",
      "ArchivedChannelPage",
      "ArchivedHistory",
      "RestoreButton",
      "canOfferArchive",
      "canOfferRestore",
      "isArchivedMember",
    ]) {
      expect(index, name).toHaveProperty(name);
    }
  });
  test("nothing deletes a channel (R12)", () => {
    for (const file of sources)
      expect(mentionsDelete(file.text), file.name).toBe(false);
  });
});

describe("deps.ts exports the names of R2", () => {
  test("they are there", async () => {
    const deps = (await import("../../src/channel-archive/deps")) as Record<
      string,
      unknown
    >;
    for (const name of [
      "conversations",
      "classifyApiError",
      "useConversationSelector",
      "useCurrentUser",
      "readChannelOnce",
    ]) {
      expect(deps, name).toHaveProperty(name);
    }
  });
});
