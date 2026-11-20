import { describe, expect, it } from "vitest";
import { personHue } from "../../src/admin/personHue";

describe("personHue", () => {
  it("is the same number for the same seed and a hue from 0 to 359", () => {
    for (const seed of ["u-001", "sam@example.com", "", "Nguyễn"]) {
      const hue = personHue(seed);
      expect(hue).toBe(personHue(seed));
      expect(Number.isInteger(hue)).toBe(true);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });

  it("spreads different seeds over different hues", () => {
    const hues = new Set(
      Array.from({ length: 40 }, (_, i) => personHue(`u-${i}`)),
    );
    expect(hues.size).toBeGreaterThan(20);
  });
});
