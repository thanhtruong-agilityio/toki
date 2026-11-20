import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// TOKI-025 R28: every word of the page goes through `useTranslation`. A search of apps/web/src/admin
// finds no sentence in a string and no text in JSX; what is left is class names, test ids, keys and the
// glyph "—". Two words that are both made of letters, side by side, is a sentence.
const ADMIN = join(__dirname, "..", "..", "src", "admin");
const SENTENCE = /\p{L}{2,}\s+\p{L}{2,}/u;
// Props whose value is read by a person: a literal string there is a text that skipped the catalog.
const TEXT_PROPS = new Set([
  "aria-label",
  "aria-description",
  "title",
  "placeholder",
  "alt",
  "label",
  "description",
  "closeLabel",
  "confirmLabel",
  "cancelLabel",
  "text",
]);

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function findings(file: string): string[] {
  const text = readFileSync(file, "utf8");
  const tree = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const found: string[] = [];
  const at = (node: ts.Node) =>
    `${relative(ADMIN, file)}:${tree.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;

  // A thrown Error is for a developer, not a person; imports and class names are not texts.
  const exempt = (node: ts.Node): boolean => {
    for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
      if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) return true;
      if (ts.isNewExpression(n) && n.expression.getText() === "Error")
        return true;
      if (ts.isJsxAttribute(n) && n.name.getText() === "className") return true;
    }
    return false;
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node) && /\p{L}/u.test(node.text)) {
      found.push(`${at(node)} text in JSX: ${node.text.trim()}`);
    }
    if (ts.isJsxAttribute(node) && TEXT_PROPS.has(node.name.getText())) {
      const value = node.initializer;
      if (value && ts.isStringLiteral(value) && /\p{L}/u.test(value.text)) {
        found.push(`${at(node)} ${node.name.getText()}="${value.text}"`);
      }
    }
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      SENTENCE.test(node.text) &&
      !exempt(node)
    ) {
      found.push(`${at(node)} sentence in a string: ${node.text}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return found;
}

describe("the texts of the page (TOKI-025 R28)", () => {
  it("holds no sentence in a string and no text in JSX in any file of src/admin", () => {
    const all = sources(ADMIN).flatMap(findings);
    expect(all).toEqual([]);
  });

  it("finds the files it is meant to scan", () => {
    const names = sources(ADMIN).map((file) => relative(ADMIN, file));
    expect(names).toEqual(
      expect.arrayContaining([
        "AdminPage.tsx",
        "InviteDialog.tsx",
        "MembersSection.tsx",
        "RowMenu.tsx",
      ]),
    );
  });

  it("would catch a sentence in a string and a text in JSX", () => {
    const tree = (code: string) => {
      const file = join(ADMIN, "__probe__.tsx");
      return ts.createSourceFile(
        file,
        code,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
    };
    const jsx = tree("const a = <p>Hello world</p>;");
    const hasText = (n: ts.Node): boolean =>
      (ts.isJsxText(n) && /\p{L}/u.test(n.text)) ||
      n.getChildren().some(hasText);
    expect(hasText(jsx)).toBe(true);
    expect(SENTENCE.test("That did not work")).toBe(true);
    expect(SENTENCE.test("0px 0px 48px 0px")).toBe(false);
    expect(SENTENCE.test("Idempotency-Key")).toBe(false);
    expect(SENTENCE.test("admin.invite.title")).toBe(false);
  });
});
