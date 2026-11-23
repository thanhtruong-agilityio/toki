// The rule of the people search (TOKI-034 R19): the trimmed text is contained in the name, ignoring
// case and diacritics. Both sides are decomposed (NFD), combining marks U+0300 to U+036F are removed,
// `đ` and `Đ` become `d`, and the result is lower-cased. One function, so a later shared fold changes
// it in one place.
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();
}

export function matchPeople<T extends { displayName: string }>(
  people: readonly T[],
  text: string,
): T[] {
  try {
    const needle = fold(text.trim());
    if (needle === "") return [...people];
    return people.filter((p) => fold(p.displayName).includes(needle));
  } catch {
    return [];
  }
}
