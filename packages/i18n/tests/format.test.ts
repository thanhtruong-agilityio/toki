import { afterEach, describe, expect, it, vi } from "vitest";
import { LANGUAGES } from "../src/languages";
import { formatNumber } from "../src/format";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("formatNumber (R24)", () => {
  it("en groups the British way", () => {
    expect(formatNumber("en", 1204)).toBe("1,204");
    expect(formatNumber("en", 1234567.5)).toBe("1,234,567.5");
  });

  it("vi gives what Intl gives for the code vi", () => {
    expect(formatNumber("vi", 1234567.5)).toBe(
      new Intl.NumberFormat("vi").format(1234567.5),
    );
  });

  it("does not throw for each language", () => {
    for (const language of LANGUAGES) {
      for (const value of [0, -1204, 1.5]) {
        expect(() => formatNumber(language, value)).not.toThrow();
      }
    }
  });

  it("always passes an explicit language code to Intl", () => {
    const spy = vi.spyOn(Intl, "NumberFormat");
    formatNumber("en", 1);
    formatNumber("vi", 1);
    const codes = spy.mock.calls.map((call) => call[0]);
    expect(codes).toEqual(["en-GB", "vi"]);
  });

  it("falls back to String(value) when Intl.NumberFormat is missing", () => {
    vi.stubGlobal("Intl", { NumberFormat: undefined });
    expect(formatNumber("en", 1204)).toBe("1204");
  });

  it("falls back to String(value) when Intl.NumberFormat throws", () => {
    vi.stubGlobal("Intl", {
      NumberFormat: function () {
        throw new RangeError("no data");
      },
    });
    expect(formatNumber("en", 1204)).toBe("1204");
  });
});
