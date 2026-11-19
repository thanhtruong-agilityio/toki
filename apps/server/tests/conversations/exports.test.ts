import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as mod from "../../src/modules/conversations/index.js";
import * as schema from "../../src/modules/conversations/schema.js";

// One list of the names this module exports, extended by every later ticket in
// its own change (R18). It checks that each name is exported and that no
// export is a table definition; it does not check that nothing else is exported.
// The names of the exports that are a table definition of schema.ts.
export function leakedTables(
  exported: Record<string, unknown>,
  tables: Record<string, unknown>,
): string[] {
  const tableObjects = new Set<unknown>(Object.values(tables));
  return Object.entries(exported)
    .filter(([, value]) => tableObjects.has(value))
    .map(([name]) => name);
}

export const EXPORTED_NAMES = [
  "buildDmKey",
  "getConversationFacts",
  "isConversationMember",
  "listMemberIds",
  "createGeneralChannel",
  "addMemberToGeneral",
  "getGeneralConversationId",
  "channelRoutes",
];

describe("the public surface of the conversations module (R18)", () => {
  it.each(EXPORTED_NAMES)("exports %s", (name) => {
    expect(typeof (mod as Record<string, unknown>)[name]).toBe("function");
  });

  it("exports no table definition", () => {
    expect(leakedTables(mod, schema)).toEqual([]);
    expect(Object.keys(mod)).not.toContain("conversations");
    expect(Object.keys(mod)).not.toContain("conversationMembers");
  });

  it("fails when a table object is added to the exports", () => {
    const withTable = { ...mod, conversations: schema.conversations };
    expect(leakedTables(withTable, schema)).toEqual(["conversations"]);
    const renamed = { ...mod, anything: schema.conversationMembers };
    expect(leakedTables(renamed, schema)).toEqual(["anything"]);
  });

  it("does not re-export the table file from index.ts", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const text = readFileSync(
      join(here, "../../src/modules/conversations/index.ts"),
      "utf8",
    );
    expect(text).not.toMatch(/schema/);
  });
});

describe("R24: no test or source of this change imports another module's table", () => {
  it("imports nothing from another module and no other schema file", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const files = [
      "../../src/modules/conversations/dm-key.ts",
      "../../src/modules/conversations/facts.ts",
      "../../src/modules/conversations/general.ts",
      "../../src/modules/conversations/schema.ts",
      "../../src/modules/conversations/access.ts",
      "../../src/modules/conversations/browse.ts",
      "../../src/modules/conversations/channels.ts",
      "../../src/modules/conversations/settings.ts",
      "../../src/modules/conversations/changes.ts",
      "../../src/modules/conversations/channel-routes.ts",
      "../../src/modules/conversations/deps.ts",
      "../../src/modules/conversations/safe-error.ts",
      "channels.access.test.ts",
      "channels.safe-error.test.ts",
      "facts.test.ts",
      "facts.db.test.ts",
      "general.db.test.ts",
      "dm-key.db.test.ts",
      "../conversation-tables.db.test.ts",
    ];
    for (const file of files) {
      const text = readFileSync(join(here, file), "utf8");
      expect(text, file).not.toMatch(
        /modules\/(members|auth|notifications|workspace)/,
      );
      expect(text, file).not.toMatch(
        /from "\.\.\/(members|auth|notifications|workspace)\//,
      );
    }
  });
});
