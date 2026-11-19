import { describe, expect, it } from "vitest";
import { hasFormContent } from "../../src/patterns/formContent";

describe("hasFormContent (R19)", () => {
  it.each([
    ["an empty object", {}, false],
    ["an empty string", { a: "" }, false],
    ["only spaces", { a: "   \n\t" }, false],
    ["typed text", { a: " hi " }, true],
    ["an empty array", { a: [] }, false],
    ["a filled array", { a: [1] }, true],
    ["an empty Set", { a: new Set() }, false],
    ["a filled Set", { a: new Set([1]) }, true],
    ["an empty Map", { a: new Map() }, false],
    ["a filled Map", { a: new Map([[1, 2]]) }, true],
    ["a number", { a: 3 }, false],
    ["zero", { a: 0 }, false],
    ["true", { a: true }, false],
    ["false", { a: false }, false],
    ["null", { a: null }, false],
    ["undefined", { a: undefined }, false],
    ["a plain object", { a: { b: "text" } }, false],
    ["one empty and one filled value", { a: "", b: "x" }, true],
  ])("%s -> %s", (_name, values, expected) => {
    expect(hasFormContent(values)).toBe(expected);
  });

  it("never throws", () => {
    expect(hasFormContent(null as never)).toBe(false);
    expect(hasFormContent(undefined as never)).toBe(false);
    const hostile = {
      get a(): string {
        throw new Error("boom");
      },
    };
    expect(hasFormContent(hostile)).toBe(false);
  });
});
