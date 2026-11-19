import { describe, expect, it } from "vitest";
import { buildDmKey } from "../../src/modules/conversations/dm-key.js";

const A = "0190a000-0000-7000-8000-00000000000a";
const B = "0190a000-0000-7000-8000-00000000000b";
const C = "0190a000-0000-7000-8000-00000000000c";
const ids = (n: number) =>
  Array.from(
    { length: n },
    (_, i) => `0190a000-0000-7000-8000-${String(i).padStart(12, "0")}`,
  );

describe("buildDmKey (R11)", () => {
  it("gives a dm for 2 people and a group_dm for 3 to 8", () => {
    expect(buildDmKey([A, B]).kind).toBe("dm");
    expect(buildDmKey([A, B, C]).kind).toBe("group_dm");
    expect(buildDmKey(ids(8)).kind).toBe("group_dm");
  });

  it("joins the sorted ids with commas", () => {
    expect(buildDmKey([B, A])).toEqual({ kind: "dm", key: `${A},${B}` });
  });

  it("gives one key for the same people in any order and any case", () => {
    expect(buildDmKey([A, B])).toEqual(buildDmKey([B, A]));
    expect(buildDmKey([A.toUpperCase(), B])).toEqual(buildDmKey([B, A]));
    expect(buildDmKey([C, A, B])).toEqual(buildDmKey([A, B, C]));
  });

  it("gives different keys for different sets", () => {
    expect(buildDmKey([A, B]).key).not.toBe(buildDmKey([A, B, C]).key);
  });

  it("sorts like the database: byte order of lower-case text", () => {
    const list = ["0190a000-0000-7000-8000-00000000000f", A, B];
    const { key } = buildDmKey(list);
    expect(key.split(",")).toEqual([...list.map((x) => x)].sort());
  });

  it("refuses fewer than 2 different people (messaging yourself)", () => {
    expect(() => buildDmKey([])).toThrow(/at least 2/);
    expect(() => buildDmKey([A])).toThrow(/at least 2/);
  });

  it("refuses a repeated person, also in another case", () => {
    expect(() => buildDmKey([A, A])).toThrow(/repeated/);
    expect(() => buildDmKey([A, B, A.toUpperCase()])).toThrow(/repeated/);
  });

  it("accepts 8 people and refuses 9", () => {
    expect(() => buildDmKey(ids(8))).not.toThrow();
    expect(() => buildDmKey(ids(9))).toThrow(/more than 8/);
  });

  it("refuses a value that is not a UUID", () => {
    expect(() => buildDmKey([A, "not-a-uuid"])).toThrow(/not a UUID/);
    expect(() => buildDmKey([A, ""])).toThrow(/not a UUID/);
    expect(() => buildDmKey([A, ` ${B}`])).toThrow(/not a UUID/);
    expect(() => buildDmKey([A, 5 as never])).toThrow(/not a UUID/);
  });
});
