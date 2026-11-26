import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import {
  appRootOf,
  compareImages,
  expandScreens,
  flattenDeclarations,
  screenRow,
  seededOnce,
  type ScreenDecl,
} from "./parity";

// A solid w x h image; `dots` paints single white pixels.
function png(
  w: number,
  h: number,
  rgb: [number, number, number],
  dots: [number, number][] = [],
): Buffer {
  const img = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i++) img.data.set([...rgb, 255], i * 4);
  for (const [x, y] of dots)
    img.data.set([255, 255, 255, 255], (y * w + x) * 4);
  return PNG.sync.write(img);
}

const decl = (over: Partial<ScreenDecl> = {}): ScreenDecl => ({
  id: "s",
  section: "home",
  appRoute: "/",
  ...over,
});

describe("compareImages (R9)", () => {
  it("identical images: ratio 0, no box", () => {
    const r = compareImages(png(10, 10, [9, 9, 9]), png(10, 10, [9, 9, 9]));
    expect(r.sameSize).toBe(true);
    expect(r.ratio).toBe(0);
    expect(r.box).toBeNull();
  });

  it("one different pixel of 100: ratio 0.01, box 1x1", () => {
    const r = compareImages(
      png(10, 10, [9, 9, 9]),
      png(10, 10, [9, 9, 9], [[3, 4]]),
    );
    expect(r.ratio).toBeCloseTo(0.01);
    expect(r.box).toEqual([3, 4, 3, 4]);
    expect(r.diff).not.toBeNull();
  });

  it("the box surrounds every different pixel", () => {
    const r = compareImages(
      png(20, 20, [9, 9, 9]),
      png(
        20,
        20,
        [9, 9, 9],
        [
          [2, 3],
          [15, 12],
        ],
      ),
    );
    expect(r.box).toEqual([2, 3, 15, 12]);
  });

  it("sizes differ is a result (R6)", () => {
    const r = compareImages(png(10, 10, [0, 0, 0]), png(12, 10, [0, 0, 0]));
    expect(r.sameSize).toBe(false);
    expect(r.sizes).toEqual(["10x10", "12x10"]);
    expect(r.diff).toBeNull();
  });
});

describe("appRootOf (TOKI-137 R1)", () => {
  it("is .app when the declaration names no element", () => {
    expect(appRootOf(decl())).toBe(".app");
  });

  it("is the element that the declaration names", () => {
    expect(appRootOf(decl({ appRoot: "#root" }))).toBe("#root");
  });
});

describe("expandScreens (R5, R12)", () => {
  it("gives one entry for each look and width by default (2 x 3)", () => {
    const entries = expandScreens([decl()]);
    expect(entries).toHaveLength(6);
    expect(entries.every((e) => e.run)).toBe(true);
  });

  it("honours the looks and the widths of a declaration", () => {
    const entries = expandScreens([
      decl({ looks: ["calm"], widths: ["wide", "narrow"] }),
    ]);
    expect(entries.map((e) => `${e.look}/${e.width}`)).toEqual([
      "calm/wide",
      "calm/narrow",
    ]);
  });

  it("does not run a seeded declaration, and still lists it", () => {
    const entries = expandScreens([decl({ seed: true })]);
    expect(entries).toHaveLength(6);
    expect(entries.every((e) => !e.run)).toBe(true);
  });

  it("names an entry the same way on every run", () => {
    const names = expandScreens([decl({ id: "admin" })]).map((e) => e.name);
    expect(names).toContain("admin/calm/wide");
    expect(names).toContain("admin/focus/narrow");
  });
});

describe("screenRow (R9, R11)", () => {
  const images = ["images/a-reference.png", "images/a-app.png"];

  it("is a match within the limit", () => {
    const row = screenRow(
      "a/calm/wide",
      {
        sameSize: true,
        sizes: ["1x1", "1x1"],
        ratio: 0.02,
        box: null,
        diff: null,
      },
      0.02,
      images,
    );
    expect(row.status).toBe("match");
  });

  it("is a difference above the limit, with the box and the images", () => {
    const row = screenRow(
      "a/calm/wide",
      {
        sameSize: true,
        sizes: ["1x1", "1x1"],
        ratio: 0.5,
        box: [1, 2, 3, 4],
        diff: null,
      },
      0.02,
      images,
    );
    expect(row).toMatchObject({
      kind: "screen",
      name: "a/calm/wide",
      status: "differs",
      images,
    });
    expect(row.detail).toMatchObject({
      ratio: 0.5,
      limit: 0.02,
      box: [1, 2, 3, 4],
    });
  });

  it("says that the sizes differ", () => {
    const row = screenRow(
      "a/calm/wide",
      {
        sameSize: false,
        sizes: ["10x10", "12x10"],
        ratio: 1,
        box: null,
        diff: null,
      },
      0.02,
      images,
    );
    expect(row.status).toBe("differs");
    expect(row.detail).toMatchObject({
      sizes: "sizes differ: 10x10 and 12x10",
    });
  });
});

describe("flattenDeclarations (R5)", () => {
  const exportsOf = (file: string, exports: Record<string, unknown>) => ({
    file,
    exports,
  });

  it("takes a declaration, or an array of declarations, from each export", () => {
    const a = decl({ id: "a" });
    const b = decl({ id: "b" });
    const c = decl({ id: "c" });
    expect(
      flattenDeclarations([
        exportsOf("one.ts", { a, list: [b, c] }),
        exportsOf("two.ts", { other: decl({ id: "d" }) }),
      ]).map((d) => d.id),
    ).toEqual(["a", "b", "c", "d"]);
  });

  it("ignores a helper, a constant or a function exported next to a declaration", () => {
    expect(
      flattenDeclarations([
        exportsOf("one.ts", {
          ME: "00000000",
          stub: () => undefined,
          LIMIT: 3,
          nothing: null,
          a: decl({ id: "a" }),
        }),
      ]).map((d) => d.id),
    ).toEqual(["a"]);
  });

  it("names the file and the export of an object that is not a declaration", () => {
    expect(() =>
      flattenDeclarations([exportsOf("bad.ts", { oops: { id: "x" } })]),
    ).toThrow(/bad\.ts.*oops.*id, section and appRoute/);
  });

  it("refuses an id that is not safe in a file name", () => {
    expect(() =>
      flattenDeclarations([exportsOf("one.ts", { a: decl({ id: "a/b" }) })]),
    ).toThrow(/one\.ts.*a\/b/);
    expect(() =>
      flattenDeclarations([exportsOf("one.ts", { a: decl({ id: "A b" }) })]),
    ).toThrow(/A b/);
  });

  it("refuses an id that two declarations use, and names both files", () => {
    expect(() =>
      flattenDeclarations([
        exportsOf("one.ts", { a: decl({ id: "same" }) }),
        exportsOf("two.ts", { b: decl({ id: "same" }) }),
      ]),
    ).toThrow(/same.*one\.ts.*two\.ts/);
  });
});

describe("seededOnce (R12)", () => {
  it("gives one entry for each seeded declaration, not one for each look and width", () => {
    const entries = expandScreens([
      decl({ id: "seeded", seed: true }),
      decl({ id: "plain" }),
      decl({ id: "seeded-two", seed: true, looks: ["calm"], widths: ["wide"] }),
    ]);
    expect(seededOnce(entries).map((e) => e.decl.id)).toEqual([
      "seeded",
      "seeded-two",
    ]);
  });

  it("gives nothing when no declaration needs the seeded database", () => {
    expect(seededOnce(expandScreens([decl()]))).toEqual([]);
  });
});
