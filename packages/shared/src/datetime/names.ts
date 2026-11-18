// The weekday and month names are a fixed table, not the output of Intl, so
// the same text comes out on the server, in the browser and in React Native
// (spec, Design). Only English is listed until D-189 is decided; a language
// code that is not listed gets the English names.
export interface Names {
  /** Short weekday names, Sunday first. */
  readonly weekdays: readonly string[];
  /** Short month names, January first. */
  readonly months: readonly string[];
}

const en: Names = {
  weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  months: [
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
  ],
};

export const NAMES: Readonly<Record<string, Names>> = { en };

export function namesFor(language: string): Names {
  return NAMES[language] ?? en;
}
