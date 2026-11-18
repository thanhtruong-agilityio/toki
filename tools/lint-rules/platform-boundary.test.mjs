// Proof of the import ban on the web implementation of platform and of the
// coverage of rule 1 over the interface files (TOKI-018, R21 to R24, R28).
// The code is made up and linted through the real eslint.config.js on paths
// under each package, so a removed or narrowed block fails here.
// Run: node --test tools/lint-rules/platform-boundary.test.mjs
import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const eslint = new ESLint({ cwd: root });

const IMPORT_RULE = "@typescript-eslint/no-restricted-imports";
const SYNTAX_RULE = "no-restricted-syntax";
const GLOBALS_RULE = "toki/client-core-globals";
const BOUNDARY_RULES = new Set([IMPORT_RULE, SYNTAX_RULE, GLOBALS_RULE]);

async function boundaryMessages(code, file) {
  const [result] = await eslint.lintText(code, {
    filePath: path.join(root, file),
  });
  return result.messages.filter((m) => BOUNDARY_RULES.has(m.ruleId));
}

// The banned forms. `relative` is written from a file directly under src/ of
// a sibling package, so it resolves into packages/platform/src/web.
const banned = [
  ["the package", 'import "@toki/platform/web";', IMPORT_RULE],
  ["a subpath", 'import "@toki/platform/web/storage";', IMPORT_RULE],
  [
    "a relative path into src/web",
    'import "../../platform/src/web/index";',
    IMPORT_RULE,
  ],
  [
    "import() of the package",
    'export const a = import("@toki/platform/web");',
    SYNTAX_RULE,
  ],
  [
    "import() with a template literal",
    "export const a = import(`@toki/platform/web`);",
    SYNTAX_RULE,
  ],
];
const allowed =
  'import { getPlatform } from "@toki/platform";\nexport const a = getPlatform;\n';

// R21, R22: the four packages of rule 1.
for (const pkg of ["client-core", "shared", "i18n", "tokens"]) {
  const file = `packages/${pkg}/src/case.ts`;
  for (const [name, code, rule] of banned) {
    test(`${pkg}: ${name} is reported (R21)`, async () => {
      const hits = await boundaryMessages(code, file);
      assert.ok(
        hits.some(
          (m) => m.ruleId === rule && /client-core boundary/.test(m.message),
        ),
        JSON.stringify(hits),
      );
    });
  }
  test(`${pkg}: an import of @toki/platform has no boundary message (R22)`, async () => {
    assert.deepEqual(await boundaryMessages(allowed, file), []);
  });
}

// R24: rule 1 covers the interface files of platform, not src/web, not tests.
for (const file of [
  "packages/platform/src/index.ts",
  "packages/platform/src/other.ts",
]) {
  test(`${file}: browser globals and the web import are reported (R24)`, async () => {
    const globalHits = await boundaryMessages(
      "export const a = localStorage;\nexport const b = window;\n",
      file,
    );
    assert.equal(
      globalHits.filter((m) => m.ruleId === GLOBALS_RULE).length,
      2,
      JSON.stringify(globalHits),
    );
    const importHits = await boundaryMessages(
      'import "@toki/platform/web";',
      file,
    );
    assert.ok(importHits.some((m) => m.ruleId === IMPORT_RULE));
  });
  test(`${file}: a plain type and function pass (R24)`, async () => {
    const code =
      "export type A = { n: number };\nexport function f(a: A): number { return a.n; }\n";
    assert.deepEqual(await boundaryMessages(code, file), []);
  });
}

test("packages/platform/src/web is outside rule 1 (R24)", async () => {
  const hits = await boundaryMessages(
    "export const a = localStorage;",
    "packages/platform/src/web/storage.ts",
  );
  assert.deepEqual(hits, []);
});

test("a test file of platform is outside rule 1 (R24)", async () => {
  const hits = await boundaryMessages(
    "export const a = localStorage;",
    "packages/platform/src/index.test.ts",
  );
  assert.deepEqual(hits, []);
});

// R28: rule 3, ui-web.
for (const [name, code, rule] of banned) {
  test(`ui-web: ${name} is reported (R28)`, async () => {
    const code2 = code;
    const hits = await boundaryMessages(code2, "packages/ui-web/src/case.ts");
    assert.ok(
      hits.some((m) => m.ruleId === rule && /ui-web boundary/.test(m.message)),
      JSON.stringify(hits),
    );
  });
}

test("ui-web: an import of @toki/platform has no boundary message (R28)", async () => {
  assert.deepEqual(
    await boundaryMessages(allowed, "packages/ui-web/src/case.ts"),
    [],
  );
});

test("a test file of ui-web is outside rule 3 (R28)", async () => {
  const hits = await boundaryMessages(
    'import "@toki/platform/web";',
    "packages/ui-web/src/case.test.ts",
  );
  assert.deepEqual(hits, []);
});
