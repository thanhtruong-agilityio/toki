import { describe, expect, expectTypeOf, it } from "vitest";
import * as mod from "../../src/modules/realtime/index.js";
import type {
  EventInput,
  StoredEvent,
} from "../../src/modules/realtime/index.js";
import * as schema from "../../src/modules/realtime/schema.js";

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

// The names the realtime module exports, extended by every later ticket in its
// own change (TOKI-036 R24). appendEvent stays inside the module.
export const EXPORTED_NAMES = [
  "getLastEventNumber",
  "getOldestEventNumber",
  "lockEventCounter",
  "pruneEvents",
  "readEventsAfter",
  "recordEvent",
  "startEventPruning",
];

describe("the public surface of the realtime module (TOKI-036 R24)", () => {
  it("exports the listed functions and nothing else", () => {
    expect(Object.keys(mod).sort()).toEqual(EXPORTED_NAMES);
    for (const name of EXPORTED_NAMES) {
      expect(typeof (mod as Record<string, unknown>)[name]).toBe("function");
    }
  });

  it("exports no table definition", () => {
    expect(leakedTables(mod, schema)).toEqual([]);
  });

  it("exports the types of an event", () => {
    expectTypeOf<StoredEvent["number"]>().toEqualTypeOf<number>();
    expectTypeOf<EventInput["at"]>().toEqualTypeOf<Date>();
  });
});
