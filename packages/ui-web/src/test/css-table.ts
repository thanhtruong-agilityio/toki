import { expect } from "vitest";
import { parseDeclarations, readCss } from "./css";

// One row of a table of the spec: the selector and its declaration text.
export type Row = [selector: string, declarations: string];

const NARROW = "(max-width:719px)";

function normSelector(selector: string): string {
  return selector
    .split(",")
    .map((part) => part.replace(/\s+/g, " ").trim())
    .join(", ");
}

// Checks that a CSS file holds exactly the selectors of its table, with exactly
// the declarations listed, and nothing else except the narrow media block (R5).
// Each row is typed in from the spec; the table is not read from the file.
export function expectCssTable(
  path: string,
  table: Row[],
  narrow: Row[] = [],
): void {
  const rules = readCss(path);
  const top = rules.filter((rule) => rule.media === null);
  const media = rules.filter((rule) => rule.media !== null);

  expect(top.map((r) => normSelector(r.selector))).toEqual(
    table.map(([s]) => normSelector(s)),
  );
  table.forEach(([selector, declarations], i) => {
    expect(top[i]!.declarations, `selector ${selector}`).toEqual(
      parseDeclarations(declarations),
    );
  });

  expect(media.every((r) => r.media === NARROW)).toBe(true);
  expect(media.map((r) => normSelector(r.selector))).toEqual(
    narrow.map(([s]) => normSelector(s)),
  );
  narrow.forEach(([selector, declarations], i) => {
    expect(media[i]!.declarations, `narrow selector ${selector}`).toEqual(
      parseDeclarations(declarations),
    );
  });
}
