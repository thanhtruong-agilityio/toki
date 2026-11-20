import { describe, expect, test } from "vitest";
import { folderSources } from "./support";

// R19: no visible English word in a JSX text or in a string prop; every text
// comes from t(...). The stand-in picker is read too: its texts are props.
const PROPS = ["label", "placeholder", "title", "aria-label", "closeLabel"];

export function words(source: string): string[] {
  const found: string[] = [];
  // JSX text: between a closing > and an opening <, with a letter in it.
  for (const m of source.matchAll(
    />([^<>{}=;()?:,|&]*[A-Za-z][^<>{}=;()?:,|&]*)</g,
  )) {
    if (/^\s*$/.test(m[1]!)) continue;
    // not an arrow or a generic: those have "=" or ")" before ">"
    found.push(m[1]!.trim());
  }
  for (const prop of PROPS) {
    for (const m of source.matchAll(new RegExp(`\\b${prop}="([^"]*)"`, "g"))) {
      found.push(`${prop}=${m[1]}`);
    }
  }
  return found;
}

describe("texts (R19)", () => {
  test("the scan sees a JSX text and a string prop (negative control)", () => {
    expect(words("<p>Create</p>")).toEqual(["Create"]);
    expect(words('<IconButton label="Close" />')).toEqual(["label=Close"]);
    expect(words("<p>{t('a')}</p>")).toEqual([]);
  });

  test("no file of the folder holds a visible English word", () => {
    for (const file of folderSources().filter((f) => f.name.endsWith(".tsx"))) {
      expect(words(file.text), file.name).toEqual([]);
    }
  });
});
