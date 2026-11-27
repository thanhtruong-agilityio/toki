import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import {
  appRootOf,
  compareImages,
  expandScreens,
  flattenDeclarations,
  frameDifferences,
  groupDifferences,
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

// A mask of w x h with a 1 at each of the given points.
function mask(w: number, h: number, dots: [number, number][]): Uint8Array {
  const m = new Uint8Array(w * h);
  for (const [x, y] of dots) m[y * w + x] = 1;
  return m;
}

describe("groupDifferences (TOKI-138 R2)", () => {
  it("two different pixels 6 apart are one group", () => {
    expect(
      groupDifferences(
        mask(60, 40, [
          [10, 20],
          [16, 20],
        ]),
        60,
        40,
      ),
    ).toHaveLength(1);
  });

  it("two different pixels 7 apart are two groups", () => {
    expect(
      groupDifferences(
        mask(60, 40, [
          [10, 20],
          [17, 20],
        ]),
        60,
        40,
      ),
    ).toHaveLength(2);
  });

  it("the square sense: 6 across and 6 down is one group, 6 across and 7 down is two", () => {
    expect(
      groupDifferences(
        mask(60, 40, [
          [10, 10],
          [16, 16],
        ]),
        60,
        40,
      ),
    ).toHaveLength(1);
    expect(
      groupDifferences(
        mask(60, 40, [
          [10, 10],
          [16, 17],
        ]),
        60,
        40,
      ),
    ).toHaveLength(2);
  });

  it("a chain of pixels, each 6 from the next, is one group", () => {
    const dots: [number, number][] = [
      [5, 20],
      [11, 20],
      [17, 20],
      [23, 20],
      [29, 20],
    ];
    expect(groupDifferences(mask(60, 40, dots), 60, 40)).toHaveLength(1);
  });

  it("the rectangle is the box of the pixels grown by 6, clipped to the image", () => {
    const [r] = groupDifferences(
      mask(60, 40, [
        [20, 20],
        [23, 22],
      ]),
      60,
      40,
    );
    expect(r).toEqual([14, 14, 29, 28]);
    const [edge] = groupDifferences(mask(60, 40, [[2, 1]]), 60, 40);
    expect(edge).toEqual([0, 0, 8, 7]);
  });

  it("the groups are in the order of the first pixel in reading order", () => {
    const rects = groupDifferences(
      mask(80, 40, [
        [50, 5],
        [10, 30],
      ]),
      80,
      40,
    );
    expect(rects[0]![0]).toBe(44); // the pixel of the top row first
    expect(rects[1]![0]).toBe(4);
  });

  it("no different pixel, no group", () => {
    expect(groupDifferences(mask(20, 20, []), 20, 20)).toEqual([]);
  });
});

describe("frameDifferences (TOKI-138 R1, R3)", () => {
  const grey = (w: number, h: number): PNG =>
    PNG.sync.read(png(w, h, [9, 9, 9]));
  const at = (img: PNG, x: number, y: number): number[] => [
    ...img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 3),
  ];
  const MAGENTA = [255, 0, 255];

  it("has the size of the image and leaves the pixels inside a frame and far from it as they were (R1)", () => {
    const out = frameDifferences(grey(60, 40), mask(60, 40, [[30, 20]]));
    expect([out.width, out.height]).toEqual([60, 40]);
    expect(at(out, 30, 20)).toEqual([9, 9, 9]); // inside the frame
    expect(at(out, 0, 0)).toEqual([9, 9, 9]); // far from it
    expect(at(out, 59, 39)).toEqual([9, 9, 9]);
  });

  it("draws a 2-pixel magenta frame inside the rectangle (R3)", () => {
    const out = frameDifferences(grey(60, 40), mask(60, 40, [[30, 20]])); // rectangle 24..36, 14..26
    expect(at(out, 24, 20)).toEqual(MAGENTA); // the left edge
    expect(at(out, 25, 20)).toEqual(MAGENTA); // the second pixel of the edge
    expect(at(out, 26, 20)).toEqual([9, 9, 9]); // inside the frame
    expect(at(out, 23, 20)).toEqual([9, 9, 9]); // next to it, outside
    expect(at(out, 36, 20)).toEqual(MAGENTA); // the right edge
    expect(at(out, 30, 14)).toEqual(MAGENTA); // the top edge
    expect(at(out, 30, 26)).toEqual(MAGENTA); // the bottom edge
  });

  it("a frame near the edge of the image is drawn on the edge row and column, inside the image", () => {
    const out = frameDifferences(grey(60, 40), mask(60, 40, [[1, 1]])); // rectangle 0..7, 0..7
    expect(at(out, 0, 3)).toEqual(MAGENTA);
    expect(at(out, 3, 0)).toEqual(MAGENTA);
    expect(at(out, 7, 3)).toEqual(MAGENTA);
  });

  it("the colour is magenta whatever the app draws", () => {
    const white = PNG.sync.read(png(60, 40, [255, 255, 255]));
    const out = frameDifferences(white, mask(60, 40, [[30, 20]]));
    expect(at(out, 24, 20)).toEqual(MAGENTA);
  });

  it("two frames far apart are both drawn", () => {
    const out = frameDifferences(
      grey(80, 40),
      mask(80, 40, [
        [10, 20],
        [60, 20],
      ]),
    );
    expect(at(out, 4, 20)).toEqual(MAGENTA);
    expect(at(out, 54, 20)).toEqual(MAGENTA);
  });
});

describe("compareImages draws the frames (TOKI-138)", () => {
  it("gives a picture of the size of the images, with the app unchanged far from the difference", () => {
    const r = compareImages(
      png(40, 40, [9, 9, 9]),
      png(40, 40, [9, 9, 9], [[20, 20]]),
    );
    const out = PNG.sync.read(r.diff!);
    expect([out.width, out.height]).toEqual([40, 40]);
    expect([...out.data.subarray(0, 3)]).toEqual([9, 9, 9]);
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

  it("gives each look its default scheme, and a declaration may name one (TOKI-143 R13)", () => {
    const entries = expandScreens([
      decl({ looks: ["calm", "focus", "classic"], widths: ["wide"] }),
    ]);
    expect(entries.map((e) => `${e.look}/${e.scheme}`)).toEqual([
      "calm/light",
      "focus/dark",
      "classic/dark",
    ]);
    const named = expandScreens([
      decl({ looks: ["focus"], widths: ["wide"], scheme: "light" }),
    ]);
    expect(named.map((e) => `${e.look}/${e.scheme}`)).toEqual(["focus/light"]);
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
