import type { Page } from "@playwright/test";

// The token check of the UI parity check (TOKI-109 R3, R4): the design values of the app compared
// with the same values of the prototype.

export type TokenKind = "colour" | "length" | "percent" | "shadow";

// R4: the names come from the CSS that `@toki/tokens` generates (exported as `./tokens.css`), the
// custom properties of its first block, `:root, :root[data-eff="calm"]`. There is no second list.
export function parseTokenNames(css: string): string[] {
  const start = css.search(/:root,\s*:root\[data-eff="calm"\]\s*\{/);
  if (start < 0) {
    throw new Error(
      'tokens.css has no ":root, :root[data-eff="calm"]" block to read the token names from',
    );
  }
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  const block = css.slice(open + 1, close);
  return [...block.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]);
}

const LENGTHS = new Set(["--av", "--gap", "--row", "--radius", "--radius-sm"]);
const SHADOWS = new Set(["--shadow", "--pop"]);

// How the browser is asked for the computed form of a value (R3): a colour as RGB, a length in
// pixels, a percentage as the pixels of a 1000 px box, a shadow as `box-shadow`.
export function kindOf(name: string): TokenKind {
  if (SHADOWS.has(name)) return "shadow";
  if (LENGTHS.has(name)) return "length";
  if (name.startsWith("--av-")) return "percent";
  return "colour";
}

export interface TokenDifference {
  property: string;
  prototype: string;
  app: string;
}

// One row for each property whose value differs, in the order of the app's properties.
export function diffTokens(
  prototype: Record<string, string>,
  app: Record<string, string>,
): TokenDifference[] {
  const names = [
    ...Object.keys(app),
    ...Object.keys(prototype).filter((name) => !(name in app)),
  ];
  const rows: TokenDifference[] = [];
  for (const property of names) {
    const p = prototype[property] ?? "";
    const a = app[property] ?? "";
    if (p === a && p !== "") continue;
    if (p === "" && a === "") continue;
    rows.push({
      property,
      prototype: p === "" ? "the prototype has no value" : p,
      app: a === "" ? "the app has no value" : a,
    });
  }
  return rows;
}

// Reads the computed value of each property on the open page. A property that the page does not
// define gives an empty string.
export async function readTokens(
  page: Page,
  names: string[],
): Promise<Record<string, string>> {
  const kinds = Object.fromEntries(names.map((name) => [name, kindOf(name)]));
  return page.evaluate(
    ({ names, kinds }) => {
      const root = document.documentElement;
      const rootStyle = getComputedStyle(root);
      const holder = document.createElement("div");
      // A page may animate `color` or `width` (the prototype does); with the date fixed the animation
      // never runs, and a read would give the value before the change. So no transition on the probe.
      const reset = "transition:none !important";
      holder.style.cssText = `position:absolute;visibility:hidden;width:1000px;${reset}`;
      const probe = document.createElement("div");
      holder.append(probe);
      root.append(holder);
      const out: Record<string, string> = {};
      for (const name of names) {
        if (rootStyle.getPropertyValue(name).trim() === "") {
          out[name] = "";
          continue;
        }
        probe.style.cssText = reset;
        const kind = kinds[name];
        if (kind === "colour") {
          probe.style.color = `var(${name})`;
          out[name] = getComputedStyle(probe).color;
        } else if (kind === "shadow") {
          probe.style.boxShadow = `var(${name})`;
          out[name] = getComputedStyle(probe).boxShadow;
        } else {
          probe.style.width = `var(${name})`;
          out[name] = getComputedStyle(probe).width;
        }
      }
      holder.remove();
      return out;
    },
    { names, kinds },
  );
}
