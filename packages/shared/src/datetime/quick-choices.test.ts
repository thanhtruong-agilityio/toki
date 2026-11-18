import { describe, expect, it } from "vitest";
import { quickTimeChoices } from "./quick-choices.js";

const HCM = "Asia/Ho_Chi_Minh";
const tomorrow0900 = Date.UTC(2026, 10, 11, 2, 0);

describe("quickTimeChoices", () => {
  it("offers 1 hour, 15:00 today and 09:00 tomorrow before 15:00", () => {
    const now = Date.UTC(2026, 10, 10, 3, 42); // 10:42
    expect(quickTimeChoices(now, HCM)).toEqual([
      { id: "in1Hour", at: now + 3_600_000 },
      { id: "today1500", at: Date.UTC(2026, 10, 10, 8, 0) },
      { id: "tomorrow0900", at: tomorrow0900 },
    ]);
  });

  it("keeps 15:00 until it is no longer later than now", () => {
    const now = Date.UTC(2026, 10, 10, 7, 59, 59); // 14:59:59
    expect(quickTimeChoices(now, HCM).map((choice) => choice.id)).toEqual(["in1Hour", "today1500", "tomorrow0900"]);
  });

  it("replaces 15:00 with 3 hours from 15:00 on", () => {
    for (const now of [Date.UTC(2026, 10, 10, 8, 0), Date.UTC(2026, 10, 10, 16, 30)]) {
      const choices = quickTimeChoices(now, HCM);
      expect(choices.map((choice) => choice.id)).toEqual(["in1Hour", "in3Hours", "tomorrow0900"]);
      expect(choices[1]?.at).toBe(now + 10_800_000);
    }
  });

  it("always has three entries, each later than now", () => {
    for (let minutes = 0; minutes < 24 * 60; minutes += 37) {
      const now = Date.UTC(2026, 10, 10, 0, minutes);
      const choices = quickTimeChoices(now, HCM);
      expect(choices).toHaveLength(3);
      for (const choice of choices) expect(choice.at).toBeGreaterThan(now);
    }
  });

  it("throws a RangeError for a bad now or an unknown zone", () => {
    expect(() => quickTimeChoices(NaN, HCM)).toThrow(RangeError);
    expect(() => quickTimeChoices(0, "Mars/Phobos")).toThrow(/Mars\/Phobos/);
  });
});
