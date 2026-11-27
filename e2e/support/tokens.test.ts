import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { diffTokens, kindOf, parseTokenNames } from "./tokens";

const css = readFileSync("packages/tokens/src/tokens.css", "utf8");

describe("parseTokenNames (R4)", () => {
  const names = parseTokenNames(css);

  it("reads the 32 custom properties of the first :root block, in order", () => {
    expect(names).toHaveLength(32);
    expect(names[0]).toBe("--bg");
    expect(names[31]).toBe("--pop");
  });

  it("has no name twice and takes nothing from the later blocks", () => {
    expect(new Set(names).size).toBe(32);
  });

  it("does not take color-scheme, which is not a custom property", () => {
    expect(names).not.toContain("color-scheme");
  });

  it("reads a tiny stylesheet", () => {
    const tiny = `:root, :root[data-look="calm"][data-scheme="light"] {\n  --a: 1;\n  --b-c: 2;\n}\n:root[data-look="focus"][data-scheme="dark"] {\n  --z: 3;\n}`;
    expect(parseTokenNames(tiny)).toEqual(["--a", "--b-c"]);
  });

  it("fails when the first block is missing", () => {
    expect(() => parseTokenNames(".x { --a: 1 }")).toThrow(/:root/);
  });
});

describe("kindOf", () => {
  it("classes the 32 names, and no name is left unclassed", () => {
    expect(kindOf("--shadow")).toBe("shadow");
    expect(kindOf("--pop")).toBe("shadow");
    expect(kindOf("--av-s")).toBe("percent");
    expect(kindOf("--av-tl")).toBe("percent");
    expect(kindOf("--gap")).toBe("length");
    expect(kindOf("--radius-sm")).toBe("length");
    expect(kindOf("--accent")).toBe("colour");
    const kinds = parseTokenNames(css).map(kindOf);
    expect(kinds.filter((k) => k === "shadow")).toHaveLength(2);
    expect(kinds.filter((k) => k === "percent")).toHaveLength(4);
    expect(kinds.filter((k) => k === "length")).toHaveLength(5);
    expect(kinds.filter((k) => k === "colour")).toHaveLength(21);
  });
});

describe("diffTokens (R3)", () => {
  it("gives one row for each difference", () => {
    expect(
      diffTokens(
        { "--bg": "rgb(1, 2, 3)", "--ink": "x" },
        { "--bg": "rgb(1, 2, 4)", "--ink": "x" },
      ),
    ).toEqual([
      { property: "--bg", prototype: "rgb(1, 2, 3)", app: "rgb(1, 2, 4)" },
    ]);
  });

  it("gives nothing when the values are the same", () => {
    expect(diffTokens({ "--bg": "a" }, { "--bg": "a" })).toEqual([]);
  });

  it("reports a property that the prototype lacks", () => {
    expect(diffTokens({}, { "--bg": "a" })).toEqual([
      { property: "--bg", prototype: "the prototype has no value", app: "a" },
    ]);
  });

  it("reports a property that has no value on either side", () => {
    expect(diffTokens({ "--bg": "" }, { "--bg": "" })).toEqual([
      {
        property: "--bg",
        prototype: "the prototype has no value",
        app: "the app has no value",
      },
    ]);
  });

  it("reports a property that the app lacks", () => {
    expect(diffTokens({ "--bg": "a" }, {})).toEqual([
      { property: "--bg", prototype: "a", app: "the app has no value" },
    ]);
  });
});
