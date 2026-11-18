import {
  isPluralText,
  type Catalog,
  type KeysOf,
  type PluralForms,
} from "./catalog";
import type { Language } from "./languages";
import { en } from "./messages/en";
import { vi } from "./messages/vi";

export type { Catalog, PluralForms } from "./catalog";

export type MessageKey = KeysOf<typeof en>;

export type Params = { count?: number } & Record<string, string | number>;

const catalogs: Record<Language, Catalog> = { en, vi };

// Looks the key up among own properties only, so "constructor" or "toString" is never found.
function find(catalog: Catalog, key: string): string | PluralForms | undefined {
  let current: unknown = catalog;
  for (const part of key.split(".")) {
    if (
      typeof current !== "object" ||
      current === null ||
      !Object.hasOwn(current, part)
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  if (typeof current === "string") return current;
  return isPluralText(current) ? current : undefined;
}

function pick(
  value: string | PluralForms,
  language: Language,
  params?: Params,
): string | undefined {
  if (typeof value === "string") return value;
  const count = params?.count;
  const wantsOne =
    language === "en" && typeof count === "number" && count === 1;
  return (wantsOne ? value.one : undefined) ?? value.other;
}

function fill(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(
    /\{([a-z][A-Za-z0-9]*)\}/g,
    (placeholder, name: string) =>
      Object.hasOwn(params, name) && params[name] !== undefined
        ? String(params[name])
        : placeholder,
  );
}

// The lookup, with the catalogs as an argument so the tests can use small ones.
export function translateWith(
  all: Record<Language, Catalog>,
  language: Language,
  key: string,
  params?: Params,
): string {
  try {
    const own = find(all[language], key);
    const text = own === undefined ? undefined : pick(own, language, params);
    if (text !== undefined) return fill(text, params);
    const english = find(all.en, key);
    const fallback =
      english === undefined ? undefined : pick(english, "en", params);
    return fallback === undefined ? key : fill(fallback, params);
  } catch {
    return key;
  }
}

export function translate(
  language: Language,
  key: MessageKey,
  params?: Params,
): string {
  return translateWith(catalogs, language, key, params);
}

export type Translator = (key: MessageKey, params?: Params) => string;

// A translator over the given catalogs; the tests use it with small ones.
export function createTranslatorWith(
  all: Record<Language, Catalog>,
  language: Language,
): Translator {
  return (key, params) => translateWith(all, language, key, params);
}

const translators = new Map<Language, Translator>();

// The same function for the same language, so a dependency list that holds it stays quiet.
export function createTranslator(language: Language): Translator {
  let bound = translators.get(language);
  if (!bound) {
    bound = createTranslatorWith(catalogs, language);
    translators.set(language, bound);
  }
  return bound;
}
