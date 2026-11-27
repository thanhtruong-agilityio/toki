import { describe, expect, it } from "vitest";
import * as mod from "../../src/modules/messages/index.js";
import * as schema from "../../src/modules/messages/schema.js";
import { leakedTables } from "../realtime/leaked-tables.js";

// The names the messages module exports, extended by every later ticket in its
// own change (TOKI-036 R24). There is none yet, and never a table.
export const EXPORTED_NAMES: string[] = [];

describe("the public surface of the messages module (TOKI-036 R24)", () => {
  it("exports the listed names and no table", () => {
    expect(Object.keys(mod)).toEqual(EXPORTED_NAMES);
    expect(leakedTables(mod, schema)).toEqual([]);
  });
});
