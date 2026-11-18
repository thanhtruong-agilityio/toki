import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as mod from "./index.js";
import * as schema from "./schema.js";

// One list of the names this module exports, extended by every later ticket in
// its own change (R18). It checks that each name is exported and that no
// export is a table definition; it does not check that nothing else is exported.
export const EXPORTED_NAMES = [
  "buildDmKey",
  "getConversationFacts",
  "isConversationMember",
  "listMemberIds",
  "createGeneralChannel",
  "addMemberToGeneral",
];

describe("the public surface of the conversations module (R18)", () => {
  it.each(EXPORTED_NAMES)("exports %s", (name) => {
    expect(typeof (mod as Record<string, unknown>)[name]).toBe("function");
  });

  it("exports no table definition", () => {
    const tables = new Set<unknown>(Object.values(schema));
    for (const [name, value] of Object.entries(mod)) {
      expect(tables.has(value), `${name} is a table of schema.ts`).toBe(false);
    }
    expect(Object.keys(mod)).not.toContain("conversations");
    expect(Object.keys(mod)).not.toContain("conversationMembers");
  });

  it("fails when a table object is added to the exports", () => {
    const tables = new Set<unknown>(Object.values(schema));
    const withTable = { ...mod, conversations: schema.conversations };
    const leaked = Object.values(withTable).some((v) => tables.has(v));
    expect(leaked).toBe(true);
  });

  it("does not re-export the table file from index.ts", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const text = readFileSync(join(here, "index.ts"), "utf8");
    expect(text).not.toMatch(/schema/);
  });
});

describe("R24: no test or source of this change imports another module's table", () => {
  it("imports nothing from another module and no other schema file", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const files = [
      "dm-key.ts",
      "facts.ts",
      "general.ts",
      "schema.ts",
      "facts.test.ts",
      "facts.db.test.ts",
      "general.db.test.ts",
      "dm-key.db.test.ts",
      "../../db/conversation-tables.db.test.ts",
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
