// The text a search compares (TOKI-032 R19): Unicode form NFD, the combining
// marks U+0300 to U+036F removed, đ and Đ turned into d (NFD does not
// decompose them), lower case. For matching only: the order of a list still
// keeps accents. Never throws.
export function foldSearchText(text: string): string {
  if (typeof text !== "string") return "";
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();
}

// Whether `name` contains `query`. The query is trimmed first, so a trailing
// space typed after a name does not hide it; an empty query keeps everything.
export function matches(name: string, query: string): boolean {
  const wanted = foldSearchText(query.trim());
  if (wanted === "") return true;
  return foldSearchText(name).includes(wanted);
}
