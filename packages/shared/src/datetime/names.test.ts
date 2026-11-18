import { describe, expect, it } from "vitest";
import { NAMES, namesFor } from "./names.js";

describe("names", () => {
  it("lists exactly 7 weekday and 12 month names for every language", () => {
    for (const entry of Object.values(NAMES)) {
      expect(entry.weekdays).toHaveLength(7);
      expect(entry.months).toHaveLength(12);
    }
  });

  it("holds the English names of Table B, Sunday first", () => {
    expect(NAMES.en?.weekdays).toEqual([
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
    ]);
    expect(NAMES.en?.months).toEqual([
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ]);
  });

  it("gives the English names to a language it does not list", () => {
    expect(namesFor("vi")).toBe(namesFor("en"));
    expect(namesFor("fr")).toBe(namesFor("en"));
    expect(namesFor("")).toBe(namesFor("en"));
  });
});
