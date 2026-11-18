// Whether a form "has content" (R19, concern 5): typed text and chosen items
// count; a switch, a select, a number or a date do not. A screen may pass its own
// boolean instead.
function isContent(value: unknown): boolean {
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  if (value instanceof Set || value instanceof Map) return value.size > 0;
  return false;
}

export function hasFormContent(values: Record<string, unknown>): boolean {
  try {
    return Object.values(values).some(isContent);
  } catch {
    return false;
  }
}
