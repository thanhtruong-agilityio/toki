// The first code point of a string, as one string ('' for an empty one).
function firstCodePoint(text: string): string {
  const first = text.codePointAt(0);
  return first === undefined ? "" : String.fromCodePoint(first);
}

// The prototype's av() with four changes (R7): the name is normalised to NFC
// and trimmed, split on runs of white space, a letter is one code point, a
// one-word name gives one letter, and each letter is cut to one code point
// after toUpperCase() ('ß' gives 'S').
export function getInitials(name: string): string {
  const words = name.normalize("NFC").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const letter = (word: string) =>
    firstCodePoint(firstCodePoint(word).toUpperCase());
  const first = letter(words[0]!);
  if (words.length === 1) return first;
  return first + letter(words[words.length - 1]!);
}
