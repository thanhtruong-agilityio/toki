// @vitest-environment jsdom
import { I18nProvider } from "@toki/i18n/react";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";
import { clock } from "../../src/clock";
import { useDateContext } from "../../src/account/use-date-context";

const wrap =
  (language: "en" | "vi") =>
  ({ children }: { children: ReactNode }) => (
    <I18nProvider language={language}>{children}</I18nProvider>
  );

describe("useDateContext (R15)", () => {
  test("holds the browser's zone, now from the clock, the language and the day words", () => {
    vi.spyOn(clock, "now").mockReturnValue(1_700_000_000_000);
    const en = renderHook(() => useDateContext(), { wrapper: wrap("en") });
    expect(en.result.current).toEqual({
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      now: 1_700_000_000_000,
      language: "en",
      dayWords: {
        today: "Today",
        tomorrow: "Tomorrow",
        yesterday: "Yesterday",
      },
    });
    const vi_ = renderHook(() => useDateContext(), { wrapper: wrap("vi") });
    expect(vi_.result.current.language).toBe("vi");
    expect(vi_.result.current.dayWords).toEqual({
      today: "Hôm nay",
      tomorrow: "Ngày mai",
      yesterday: "Hôm qua",
    });
  });
});
