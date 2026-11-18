import { describe, expect, test } from "vitest";
import { computeMenuPosition } from "./menuPlace";

const viewport = { width: 1000, height: 800 };
const menu = { width: 200, height: 100 };

describe("computeMenuPosition (R23)", () => {
  test("below the anchor, right edge aligned (end)", () => {
    expect(
      computeMenuPosition({
        anchor: { left: 500, top: 100, right: 600, bottom: 130 },
        menu,
        viewport,
        align: "end",
      }),
    ).toEqual({ left: 400, top: 134 });
  });

  test("left edge aligned (start)", () => {
    expect(
      computeMenuPosition({
        anchor: { left: 500, top: 100, right: 600, bottom: 130 },
        menu,
        viewport,
        align: "start",
      }),
    ).toEqual({ left: 500, top: 134 });
  });

  test("flipped above when it does not fit below", () => {
    expect(
      computeMenuPosition({
        anchor: { left: 500, top: 700, right: 600, bottom: 730 },
        menu,
        viewport,
        align: "end",
      }),
    ).toEqual({ left: 400, top: 596 });
  });

  test("clamped 8 px from the left edge", () => {
    expect(
      computeMenuPosition({
        anchor: { left: 0, top: 100, right: 50, bottom: 130 },
        menu,
        viewport,
        align: "end",
      }).left,
    ).toBe(8);
  });

  test("clamped 8 px from the right edge", () => {
    expect(
      computeMenuPosition({
        anchor: { left: 950, top: 100, right: 1000, bottom: 130 },
        menu,
        viewport,
        align: "start",
      }).left,
    ).toBe(792);
  });

  test("higher than the window: top is at least 8", () => {
    expect(
      computeMenuPosition({
        anchor: { left: 500, top: 20, right: 600, bottom: 50 },
        menu: { width: 200, height: 900 },
        viewport,
        align: "end",
      }).top,
    ).toBe(8);
  });

  test("a zero rectangle gives top 4 and left 8", () => {
    expect(
      computeMenuPosition({
        anchor: { left: 0, top: 0, right: 0, bottom: 0 },
        menu,
        viewport,
        align: "end",
      }),
    ).toEqual({ left: 8, top: 4 });
  });

  test("the edge of the rule: it fits when top plus height is at most the height less 8", () => {
    const at = (bottom: number) =>
      computeMenuPosition({
        anchor: { left: 500, top: 600, right: 600, bottom },
        menu,
        viewport,
        align: "end",
      }).top;
    expect(at(688)).toBe(692);
    expect(at(689)).toBe(496);
  });
});
