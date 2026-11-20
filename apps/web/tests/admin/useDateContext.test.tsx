// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { formatDateTime } from "@toki/shared";
import { I18nProvider } from "@toki/i18n/react";
import type { Language } from "@toki/i18n";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDateContext } from "../../src/admin/useDateContext";

afterEach(() => {
  vi.useRealTimers();
});

const wrapper = (language: Language) =>
  function Wrapper({ children }: { children?: ReactNode }) {
    return <I18nProvider language={language}>{children}</I18nProvider>;
  };

describe("useDateContext (TOKI-025 R30)", () => {
  it("gives the time zone, the clock, the language and the three day words in English", () => {
    vi.useFakeTimers({ now: Date.UTC(2026, 0, 10, 12) });
    const { result } = renderHook(() => useDateContext("UTC"), {
      wrapper: wrapper("en"),
    });
    expect(result.current).toEqual({
      timeZone: "UTC",
      now: Date.UTC(2026, 0, 10, 12),
      language: "en",
      dayWords: {
        today: "Today",
        tomorrow: "Tomorrow",
        yesterday: "Yesterday",
      },
    });
  });

  it("gives the Vietnamese day words", () => {
    vi.useFakeTimers({ now: Date.UTC(2026, 0, 10, 12) });
    const { result } = renderHook(() => useDateContext("UTC"), {
      wrapper: wrapper("vi"),
    });
    expect(result.current.language).toBe("vi");
    expect(result.current.dayWords).toEqual({
      today: "Hôm nay",
      tomorrow: "Ngày mai",
      yesterday: "Hôm qua",
    });
  });

  it("uses the browser's time zone when none is given", () => {
    const { result } = renderHook(() => useDateContext(), {
      wrapper: wrapper("en"),
    });
    expect(result.current.timeZone).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  });

  it("writes a time of today, then yesterday after midnight, then a date after a year end", () => {
    const at = Date.UTC(2026, 11, 31, 23, 30);
    const read = (now: number, language: Language) => {
      vi.useFakeTimers({ now });
      const { result } = renderHook(() => useDateContext("UTC"), {
        wrapper: wrapper(language),
      });
      return formatDateTime(at, result.current);
    };
    expect(read(Date.UTC(2026, 11, 31, 23, 59), "en")).toBe("Today 23:30");
    expect(read(Date.UTC(2027, 0, 1, 0, 1), "en")).toBe("Yesterday 23:30");
    expect(read(Date.UTC(2027, 0, 1, 0, 1), "vi")).toBe("Hôm qua 23:30");
    // Two days on, in the next year: the date with the year, since it is not the current year.
    expect(read(Date.UTC(2027, 0, 2, 12), "en")).toMatch(
      /^Thu 31 Dec 2026 23:30$/,
    );
  });
});
