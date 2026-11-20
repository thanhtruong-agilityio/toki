import { useTranslation } from "@toki/i18n/react";
import type { FormatContext } from "@toki/shared";
import { clock } from "../clock";

// What `formatDate` and `formatDateTime` need (TOKI-025 R30): the browser's time zone, the clock of
// TOKI-008, the person's language and the three day words. A local hook of this page: TOKI-035 builds
// the same context inline in its own code and no shared hook exists, so this is a third copy; a later
// ticket may move the three to one. `timeZone` is for tests.
export function useDateContext(timeZone?: string): FormatContext {
  const { language, t } = useTranslation();
  return {
    timeZone: timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    now: clock.now(),
    language,
    dayWords: {
      today: t("common.today"),
      tomorrow: t("common.tomorrow"),
      yesterday: t("common.yesterday"),
    },
  };
}
