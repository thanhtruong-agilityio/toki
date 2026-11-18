export const LANGUAGES = ["en", "vi"] as const;

export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE = "en" satisfies Language;

// Shown in the language picker. These two names are not keys: each reads the same in both languages.
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  vi: "Tiếng Việt",
};

export function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "vi";
}

// For a value read from an account or a request: anything else is English.
export function resolveLanguage(value: unknown): Language {
  return isLanguage(value) ? value : DEFAULT_LANGUAGE;
}
