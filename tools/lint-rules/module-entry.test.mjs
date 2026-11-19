// Proof of the rule `toki/module-entry` and of its exception for the entries under src/cli/ (TOKI-026
// R23). The code is made up and linted through the real eslint.config.js on paths under apps/server/src.
// Run: node --test tools/lint-rules/module-entry.test.mjs
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

async function reports(code, file) {
  const [result] = await eslint.lintText(code, {
    filePath: path.join(root, file),
  });
  return result.messages.filter((m) => m.ruleId === "toki/module-entry");
}

test("a file under src/cli/ may import the entry of a module", async () => {
  const hits = await reports(
    'import { findAccountByEmail } from "../modules/members/index.js";\nexport const a = findAccountByEmail;\n',
    "apps/server/src/cli/case.ts",
  );
  assert.deepEqual(hits, []);
});

test("a file under src/cli/ may import the cli entry of a module", async () => {
  for (const spec of [
    "../modules/auth/cli.js",
    "../modules/auth/cli.ts",
    "../modules/auth/cli",
  ]) {
    const hits = await reports(
      `import { x } from "${spec}";\nexport const a = x;\n`,
      "apps/server/src/cli/case.ts",
    );
    assert.deepEqual(hits, [], spec);
  }
});

test("a file under src/cli/ may not import another file of a module", async () => {
  const hits = await reports(
    'import { x } from "../modules/auth/sessions.js";\nexport const a = x;\n',
    "apps/server/src/cli/case.ts",
  );
  assert.equal(hits.length, 1);
});

test("a file of another module may not import the cli entry of a module", async () => {
  const hits = await reports(
    'import { x } from "../auth/cli.js";\nexport const a = x;\n',
    "apps/server/src/modules/members/case.ts",
  );
  assert.equal(hits.length, 1);
});

test("a file outside src/cli/ and outside modules/ may not import the cli entry", async () => {
  const hits = await reports(
    'import { x } from "./modules/auth/cli.js";\nexport const a = x;\n',
    "apps/server/src/case.ts",
  );
  assert.equal(hits.length, 1);
});

test("the index of a module is still allowed from anywhere", async () => {
  const hits = await reports(
    'import { x } from "../auth/index.js";\nexport const a = x;\n',
    "apps/server/src/modules/members/case.ts",
  );
  assert.deepEqual(hits, []);
});
