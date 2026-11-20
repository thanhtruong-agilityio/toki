import { useTranslation } from "@toki/i18n/react";
import type { FormatContext } from "@toki/shared";
import { clock } from "../clock";

// What `formatDateTime` of TOKI-094 needs (R15): the browser's time zone, now
// from the one clock of the app, the person's language and the three day
// words. A local copy of the small hook that TOKI-025 and TOKI-035 also have;
// no shared one exists yet, and TOKI-042 or a later ticket may replace it.
export function useDateContext(): FormatContext {
  const { language, t } = useTranslation();
  return {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    now: clock.now(),
    language,
    dayWords: {
      today: t("common.today"),
      tomorrow: t("common.tomorrow"),
      yesterday: t("common.yesterday"),
    },
  };
}
