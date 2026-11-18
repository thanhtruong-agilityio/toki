// The shapes a catalog can have, and the one predicate that tells a plural text from a group.
// No Node API, so the check can use it.
export const PLURAL_FORM_NAMES = [
  "zero",
  "one",
  "two",
  "few",
  "many",
  "other",
] as const;

export type PluralForms = Partial<
  Record<"zero" | "one" | "two" | "few" | "many" | "other", string>
>;

export type Catalog = { [name: string]: string | PluralForms | Catalog };

type Leaves<T, Path extends string = ""> = T extends string
  ? Path
  : T extends { other: string }
    ? Path
    : {
        [K in keyof T & string]: Leaves<
          T[K],
          Path extends "" ? K : `${Path}.${K}`
        >;
      }[keyof T & string];

// A text with plural forms: a non-empty object whose properties are all plural form names with
// text values. Used by `translate` and by the check, so the two agree on what such a text is.
export function isPluralText(value: unknown): value is PluralForms {
  if (typeof value !== "object" || value === null) return false;
  const entries = Object.entries(value);
  return (
    entries.length > 0 &&
    entries.every(
      ([name, text]) =>
        (PLURAL_FORM_NAMES as readonly string[]).includes(name) &&
        typeof text === "string",
    )
  );
}

// Every key that has a text in the catalog T, as "namespace.part.part".
export type KeysOf<T> = Leaves<T>;
