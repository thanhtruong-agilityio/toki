import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const FEATURES = join(import.meta.dirname, "../../src/features");

// "The own files" of TOKI-034 R1: the four files at the root of `features`, then
// `channels/` and `people/`. Other tickets keep folders of their own beside them.
const ROOT_FILES = [
  "deps.ts",
  "ConversationStarters.tsx",
  "useMoreOnScroll.ts",
  "rows.css",
];

export function ownSources(): Array<{ name: string; text: string }> {
  const out: Array<{ name: string; text: string }> = [];
  for (const name of ROOT_FILES) {
    const path = join(FEATURES, name);
    if (existsSync(path)) {
      out.push({ name, text: readFileSync(path, "utf8") });
    }
  }
  for (const dir of ["channels", "people"]) {
    const path = join(FEATURES, dir);
    if (!existsSync(path)) continue;
    for (const name of readdirSync(path)) {
      if (/\.(ts|tsx|css)$/.test(name)) {
        out.push({
          name: `${dir}/${name}`,
          text: readFileSync(join(path, name), "utf8"),
        });
      }
    }
  }
  return out;
}

const PROPS = ["label", "placeholder", "title", "aria-label", "closeLabel"];

// The visible words a source file holds in a JSX text or a string prop (R3): every text must come
// from `t(...)`.
export function words(source: string): string[] {
  const found: string[] = [];
  for (const m of source.matchAll(
    />([^<>{}=;()?:,|&]*[A-Za-z][^<>{}=;()?:,|&]*)</g,
  )) {
    if (/^\s*$/.test(m[1]!)) continue;
    found.push(m[1]!.trim());
  }
  for (const prop of PROPS) {
    for (const m of source.matchAll(new RegExp(`\\b${prop}="([^"]*)"`, "g"))) {
      found.push(`${prop}=${m[1]}`);
    }
  }
  return found;
}
