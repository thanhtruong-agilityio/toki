import { readFileSync } from "node:fs";

// A small reader for the plain CSS of this app (rules, one level of @media, no nesting), so a CSS
// test compares declarations and Prettier may reformat the file. The ui-web tests use postcss; this
// app does not depend on it.
export type CssRule = {
  selector: string;
  // The condition of the enclosing @media with no spaces, or null at the top level.
  media: string | null;
  declarations: Record<string, string>;
};

const norm = (value: string) =>
  value
    .trim()
    .replace(/(^|[^\d])\.(\d)/g, "$10.$2")
    .replace(/\s*,\s*/g, ",")
    .replace(/\s+/g, " ");

function declarationsOf(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  let depth = 0;
  let current = "";
  const flush = () => {
    const at = current.indexOf(":");
    if (at > 0) out[current.slice(0, at).trim()] = norm(current.slice(at + 1));
    current = "";
  };
  for (const ch of body) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === ";" && depth === 0) flush();
    else current += ch;
  }
  flush();
  return out;
}

export function parseCss(source: string): CssRule[] {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: CssRule[] = [];
  const walk = (from: number, to: number, media: string | null) => {
    let i = from;
    while (i < to) {
      const open = text.indexOf("{", i);
      if (open < 0 || open >= to) return;
      const head = text.slice(i, open).trim();
      let depth = 1;
      let j = open + 1;
      while (j < to && depth > 0) {
        if (text[j] === "{") depth += 1;
        if (text[j] === "}") depth -= 1;
        j += 1;
      }
      const inner = text.slice(open + 1, j - 1);
      if (head.startsWith("@media")) {
        walk(open + 1, j - 1, head.slice(6).replace(/\s+/g, ""));
      } else {
        rules.push({
          selector: head.replace(/\s+/g, " "),
          media,
          declarations: declarationsOf(inner),
        });
      }
      i = j;
    }
  };
  walk(0, text.length, null);
  return rules;
}

export function readCss(path: string): CssRule[] {
  return parseCss(readFileSync(path, "utf8"));
}

// "a:b; c:d(e;f)" as a table of a spec writes it.
export function parseDeclarations(text: string): Record<string, string> {
  return declarationsOf(text);
}
