import { describe, expect, it } from "vitest";
import * as mod from "../../src/modules/messages/index.js";
import * as schema from "../../src/modules/messages/schema.js";

// The names of the exports that are a definition of schema.ts, as in the
// export test of the conversations module.
function leakedTables(
  exported: Record<string, unknown>,
  tables: Record<string, unknown>,
): string[] {
  const tableObjects = new Set<unknown>(Object.values(tables));
  return Object.entries(exported)
    .filter(([, value]) => tableObjects.has(value))
    .map(([name]) => name);
}

// The names the messages module exports, extended by every later ticket in its
// own change (TOKI-036 R24). There is none yet, and never a table.
export const EXPORTED_NAMES: string[] = [];

describe("the public surface of the messages module (TOKI-036 R24)", () => {
  it("exports the listed names and no table", () => {
    expect(Object.keys(mod)).toEqual(EXPORTED_NAMES);
    expect(leakedTables(mod, schema)).toEqual([]);
  });
});
