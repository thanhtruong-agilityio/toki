import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (...parts: string[]) =>
  readFileSync(join(__dirname, "..", "..", "..", "..", ...parts), "utf8");

const css = readFileSync(
  join(__dirname, "..", "..", "src", "admin", "admin.css"),
  "utf8",
);

describe("admin.css (TOKI-025 R26, R31, Table B)", () => {
  it("styles the table as the prototype's .ctable with the decided padding", () => {
    expect(css).toMatch(/\.adm-table\s*{[^}]*border-collapse:\s*collapse/);
    expect(css).toMatch(/\.adm-table\s*{[^}]*width:\s*100%/);
    expect(css).toMatch(/\.adm-table\s*{[^}]*font-size:\s*12\.5px/);
    expect(css).toMatch(
      /\.adm-table th,\s*\.adm-table td\s*{[^}]*padding:\s*8px/,
    );
  });

  it("draws each row as a card at 719px or less, with the column name before each cell", () => {
    const narrow = css.slice(css.indexOf("@media (max-width: 719px)"));
    expect(narrow).toMatch(/\.adm-table tr\s*{[^}]*display:\s*block/);
    expect(narrow).toMatch(
      /\.adm-table td\[data-label\]::before\s*{[^}]*content:\s*attr\(data-label\)/,
    );
  });

  it("hides the header row visually and not from a screen reader", () => {
    const narrow = css.slice(css.indexOf("@media (max-width: 719px)"));
    expect(narrow).toMatch(/thead[^{]*{[^}]*(clip|position:\s*absolute)/);
    expect(narrow).not.toMatch(/thead[^{]*{[^}]*display:\s*none/);
  });

  it("uses token variables for every colour and names no look attribute", () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/);
    expect(css).not.toMatch(/data-(eff|look|accent|density)/);
  });

  it("relies on the base components for the 40px of a control on a narrow screen (R26)", () => {
    for (const file of [
      "Button/Button.css",
      "IconButton/IconButton.css",
      "Chip/Chip.css",
    ]) {
      const source = read("packages", "ui-web", "src", "components", file);
      const narrow = source.slice(source.indexOf("@media (max-width: 719px)"));
      expect(narrow, file).toMatch(/min-height:\s*40px/);
    }
  });
});
