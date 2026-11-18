// The missing-translation check as a function of the catalogs (R13 to R18). It reads no file and
// uses no Node API; scripts/check.ts passes it the committed catalogs and prints the result.
import {
  PLURAL_FORM_NAMES,
  isPluralText,
  type Catalog,
  type PluralForms,
} from "./catalog";
import { LANGUAGES, type Language } from "./languages";

export type Problem = { language: Language; key: string; problem: string };

type Text = string | PluralForms;

const PLURAL_FORMS: readonly string[] = PLURAL_FORM_NAMES;
const PART = /^[a-z][A-Za-z0-9]*$/;
const NAME = PART; // a placeholder name follows the same rule as a key part

// Every text of a catalog by key; a text with plural forms is one key.
function flatten(
  catalog: Catalog,
  prefix = "",
  into = new Map<string, Text>(),
): Map<string, Text> {
  for (const [name, value] of Object.entries(catalog)) {
    const key = prefix === "" ? name : `${prefix}.${name}`;
    if (typeof value === "string" || isPluralText(value)) into.set(key, value);
    else flatten(value as Catalog, key, into);
  }
  return into;
}

export function countKeys(catalog: Catalog): number {
  return flatten(catalog).size;
}

function forms(text: Text): Array<[string, string]> {
  if (typeof text === "string") return [["", text]];
  return Object.entries(text).map(([form, value]) => [form, value ?? ""]);
}

function placeholders(text: Text): string[] {
  const names = new Set<string>();
  for (const [, value] of forms(text)) {
    for (const match of value.matchAll(/\{([^{}]*)\}/g))
      names.add(match[1] ?? "");
  }
  return [...names].sort();
}

function namingProblem(key: string): string | undefined {
  const parts = key.split(".");
  if (parts.length < 2 || parts.length > 4) return "needs 2 to 4 parts";
  const bad = parts.find((part) => !PART.test(part));
  if (bad !== undefined) return `part "${bad}" is not lowerCamelCase`;
  const plural = parts.find((part) => PLURAL_FORMS.includes(part));
  if (plural !== undefined) return `part "${plural}" is a plural form name`;
  return undefined;
}

function textProblems(language: Language, key: string, text: Text): Problem[] {
  const found: Problem[] = [];
  if (typeof text !== "string") {
    const names = Object.keys(text);
    if (!names.includes("other"))
      found.push({ language, key, problem: "plural forms lack other" });
    if (
      language === "en" &&
      names.includes("other") &&
      !names.includes("one")
    ) {
      found.push({
        language,
        key,
        problem: "plural forms lack one in English",
      });
    }
    const allowed = language === "en" ? ["one", "other"] : ["other"];
    for (const name of names) {
      if (!allowed.includes(name)) {
        found.push({
          language,
          key,
          problem: `form ${name} is not used in ${language}`,
        });
      }
    }
  }
  for (const [, value] of forms(text)) {
    for (const match of value.matchAll(/\{([^{}]*)\}/g)) {
      if (!NAME.test(match[1] ?? "")) {
        found.push({
          language,
          key,
          problem: `invalid placeholder ${match[0]}`,
        });
      }
    }
    if (/[{}]/.test(value.replace(/\{[^{}]*\}/g, ""))) {
      found.push({ language, key, problem: "stray brace" });
    }
  }
  for (const [form, value] of forms(text)) {
    if (value.trim() === "") {
      found.push({
        language,
        key,
        problem: form === "" ? "empty text" : `empty text in form ${form}`,
      });
    }
  }
  return found;
}

export function checkCatalogs(catalogs: Record<Language, Catalog>): Problem[] {
  const en = flatten(catalogs.en);
  const vi = flatten(catalogs.vi);
  const problems: Problem[] = [];

  for (const [key, text] of en) {
    const rule = namingProblem(key);
    if (rule)
      problems.push({
        language: "en",
        key,
        problem: `breaks the naming rule: ${rule}`,
      });
    problems.push(...textProblems("en", key, text));
    const other = vi.get(key);
    if (other === undefined) {
      problems.push({ language: "vi", key, problem: "missing" });
      continue;
    }
    problems.push(...textProblems("vi", key, other));
    const a = placeholders(text).join(", ");
    const b = placeholders(other).join(", ");
    if (a !== b) {
      problems.push({
        language: "vi",
        key,
        problem: `placeholders differ (en: ${a || "none"}; vi: ${b || "none"})`,
      });
    }
  }

  for (const [key, text] of vi) {
    if (en.has(key)) continue;
    problems.push({ language: "en", key, problem: "missing" });
    const rule = namingProblem(key);
    if (rule)
      problems.push({
        language: "vi",
        key,
        problem: `breaks the naming rule: ${rule}`,
      });
    problems.push(...textProblems("vi", key, text));
  }
  return problems;
}

// R13: a namespace file in a messages/<language> folder that its index.ts does not list.
export function checkNamespaceFiles(
  files: Record<Language, string[]>,
  catalogs: Record<Language, Catalog>,
): Problem[] {
  const problems: Problem[] = [];
  for (const language of LANGUAGES) {
    const listed = Object.keys(catalogs[language]);
    for (const namespace of files[language]) {
      if (!listed.includes(namespace)) {
        problems.push({
          language,
          key: `messages/${language}/${namespace}.ts`,
          problem: "not listed in index.ts",
        });
      }
    }
  }
  return problems;
}

export function formatProblem({ language, key, problem }: Problem): string {
  return `${language} ${key}: ${problem}`;
}
