// Joins class names: false, null, undefined and empty strings are dropped.
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part)).join(" ");
}
