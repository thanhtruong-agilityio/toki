import { readFileSync } from "node:fs";
import postcss from "postcss";

// Prettier writes `.5` as `0.5` and spaces `!important`; a CSS test must not
// care, so both sides are normalised before they are compared.
export function normValue(value: string): string {
  return value
    .trim()
    .replace(/(^|[^\d])\.(\d)/g, "$10.$2")
    .replace(/\s*!\s*important/g, "!important")
    .replace(/\s*,\s*/g, ",")
    .replace(/\s+/g, " ");
}

export type CssRule = {
  selector: string;
  // The text of the enclosing @media query, or null at the top level.
  media: string | null;
  // Property names as written, values trimmed.
  declarations: Record<string, string>;
};

// Parses a CSS file and returns its rules, so a test compares declarations and
// not text and Prettier may reformat the file (R27).
export function readCss(path: string): CssRule[] {
  const root = postcss.parse(readFileSync(path, "utf8"));
  const rules: CssRule[] = [];
  root.walkRules((rule) => {
    const declarations: Record<string, string> = {};
    rule.each((node) => {
      if (node.type === "decl")
        declarations[node.prop] = normValue(
          node.important ? `${node.value}!important` : node.value,
        );
    });
    const parent = rule.parent;
    const media =
      parent && parent.type === "atrule"
        ? (parent as postcss.AtRule).params.replace(/\s+/g, "")
        : null;
    rules.push({
      selector: rule.selector.replace(/\s+/g, " ").trim(),
      media,
      declarations,
    });
  });
  return rules;
}

// Splits a declaration list as written in a table of the spec
// ("a:b; c:d(e;f)") into an object, ignoring `;` inside parentheses and quotes.
export function parseDeclarations(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  let depth = 0;
  let quote = "";
  let current = "";
  const flush = () => {
    const i = current.indexOf(":");
    if (i > 0)
      out[current.slice(0, i).trim()] = normValue(current.slice(i + 1));
    current = "";
  };
  for (const ch of text) {
    if (quote) {
      if (ch === quote) quote = "";
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === ";" && depth === 0) {
      flush();
      continue;
    }
    current += ch;
  }
  flush();
  return out;
}
