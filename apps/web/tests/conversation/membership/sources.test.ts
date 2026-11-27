import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, test } from "vitest";
import * as index from "../../../src/conversation/membership";

const DIR = resolve(__dirname, "../../../src/conversation/membership");
const files = readdirSync(DIR);
const sources = files.filter((f) => /\.(ts|tsx)$/.test(f));
const read = (f: string) => readFileSync(resolve(DIR, f), "utf8");

describe("the folder (R1)", () => {
  test("holds the files of R1", () => {
    for (const f of [
      "MembershipControls.tsx",
      "AddPeopleDialog.tsx",
      "AddPeopleButton.tsx",
      "RemoveMemberButton.tsx",
      "RemoveMemberDialog.tsx",
      "useAddPeople.ts",
      "useRemoveMember.ts",
      "candidates.ts",
      "offers.ts",
      "deps.ts",
      "membership.css",
      "index.ts",
    ]) {
      expect(files).toContain(f);
    }
  });

  test("index.ts exports the names of R1", () => {
    for (const name of [
      "MembershipControls",
      "AddPeopleButton",
      "RemoveMemberButton",
      "RemoveMemberDialog",
      "AddPeopleDialog",
      "useRemoveMember",
      "candidatesFor",
      "membershipOffers",
    ]) {
      expect(index).toHaveProperty(name);
    }
  });
});

describe("the seam (R2, R19)", () => {
  test("only deps.ts imports the client or @toki/client-core", () => {
    for (const f of sources.filter((f) => f !== "deps.ts")) {
      const text = read(f);
      expect(text, f).not.toMatch(/from\s+["']@toki\/client-core["']/);
      expect(text, f).not.toMatch(/from\s+["'](\.\.\/)+client["']/);
      expect(text, f).not.toMatch(/use-conversations["']/);
    }
  });

  test("no browser storage, notification, service worker or audio, and no message request", () => {
    for (const f of sources) {
      const text = read(f);
      expect(text, f).not.toMatch(
        /localStorage|sessionStorage|Notification|serviceWorker|AudioContext|new Audio/,
      );
      expect(text, f).not.toMatch(/api\.messages|messages["']/);
    }
  });

  test("no role literal is compared", () => {
    const compared =
      /(===|!==|==|!=)\s*["'](admin|member)["']|["'](admin|member)["']\s*(===|!==|==|!=)|case\s+["'](admin|member)["']|\[[^\]]*["'](admin|member)["'][^\]]*\]\.includes/;
    for (const f of sources) expect(read(f), f).not.toMatch(compared);
  });
});

describe("texts (R3)", () => {
  test("no JSX text and no visible string prop holds a letter", () => {
    const visible = new Set([
      "aria-label",
      "title",
      "placeholder",
      "alt",
      "label",
    ]);
    for (const f of sources.filter((f) => f.endsWith(".tsx"))) {
      const sf = ts.createSourceFile(
        f,
        read(f),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      const bad: string[] = [];
      const walk = (node: ts.Node) => {
        if (ts.isJsxText(node) && /[A-Za-z]/.test(node.text))
          bad.push(node.text.trim());
        if (
          ts.isJsxAttribute(node) &&
          visible.has(node.name.getText(sf)) &&
          node.initializer &&
          ts.isStringLiteral(node.initializer) &&
          /[A-Za-z]/.test(node.initializer.text)
        ) {
          bad.push(node.initializer.text);
        }
        ts.forEachChild(node, walk);
      };
      walk(sf);
      expect(bad, f).toEqual([]);
    }
  });
});

describe("membership.css (R17)", () => {
  const css = read("membership.css");

  test("holds exactly the two rules of Table C", () => {
    const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map(
      ([, sel, body]) => [
        sel!.trim(),
        body!
          .split(";")
          .map((d) => d.trim().replace(/\s+/g, " "))
          .filter(Boolean),
      ],
    );
    expect(rules).toEqual([
      [".mbr-add", ["margin: 0 0 8px"]],
      [
        ".btn.sm.mbr-remove",
        ["margin-left: auto", "flex: none", "color: var(--danger)"],
      ],
    ]);
  });

  test("has no colour literal, motion, hover or look selector", () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/);
    expect(css).not.toMatch(
      /transition|animation|:hover|data-look|data-scheme|data-accent|data-density/,
    );
    expect(css).not.toMatch(/\.mrow|\.dp-|\.prow/);
  });
});
