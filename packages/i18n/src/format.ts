import type { Language } from "./languages";

// The only file that uses Intl. Every use names its language code; the language of the
// device is never read, so a browser set to Vietnamese still gets English by default (R12).
export function formatNumber(language: Language, value: number): string {
  try {
    if (language === "en") {
      return new Intl.NumberFormat("en-GB").format(value);
    }
    return new Intl.NumberFormat(language).format(value);
  } catch {
    // A runtime with no Intl, or no data for the language.
    return String(value);
  }
}
