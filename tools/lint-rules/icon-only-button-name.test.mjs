// Proof of the rule toki/icon-only-button-name (TOKI-012, R22 to R25). The 36
// cases are Table K of docs/specs/2026-11-16-base-components-1-design.md: 21
// that the rule reports (V) and 15 that it does not (A). They run through the
// real eslint.config.js, on a path under packages/ui-web/src, so a removed or
// narrowed block fails here too.
// Run: node --test tools/lint-rules/icon-only-button-name.test.mjs
import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const RULE = "toki/icon-only-button-name";
const eslint = new ESLint({ cwd: root });

const UI =
  'import { XIcon, CheckIcon, Icon, Button, IconButton } from "@toki/ui-web";\n';
// Each case: id, the code, and whether the rule reports it.
const cases = [
  ["V1", `${UI}export const a = <button><XIcon /></button>;`, true],
  ["V2", `${UI}export const a = <Button><XIcon /></Button>;`, true],
  ["V3", `${UI}export const a = <button><Icon name="x" /></button>;`, true],
  ["V4", `${UI}export const a = <IconButton icon="x" />;`, true],
  ["V5", `${UI}export const a = <IconButton icon="x" label="" />;`, true],
  [
    "V6",
    `${UI}export const a = <button aria-label=""><XIcon /></button>;`,
    true,
  ],
  [
    "V7",
    `${UI}export const a = <button title="Close"><XIcon /></button>;`,
    true,
  ],
  [
    "V8",
    `import { XIcon as Close } from "@toki/ui-web";\nexport const a = <button><Close /></button>;`,
    true,
  ],
  [
    "V9",
    `${UI}export const a = (open) => <button>{open ? <XIcon /> : <CheckIcon />}</button>;`,
    true,
  ],
  [
    "V10",
    `import * as Icons from "@toki/ui-web";\nexport const a = <button><Icons.XIcon /></button>;`,
    true,
  ],
  [
    "V11",
    `${UI}export const a = <button><span><XIcon /></span></button>;`,
    true,
  ],
  [
    "V12",
    `${UI}export const a = <button><XIcon /><CheckIcon /></button>;`,
    true,
  ],
  [
    "V13",
    `import { XIcon } from "../../icons/XIcon";\nexport const a = <button><XIcon /></button>;`,
    true,
  ],
  [
    "V14",
    `${UI}export const a = <button aria-label="   "><XIcon /></button>;`,
    true,
  ],
  [
    "V15",
    `${UI}export const a = <button aria-labelledby=""><XIcon /></button>;`,
    true,
  ],
  ["V16", `${UI}export const a = <button><><XIcon /></></button>;`, true],
  [
    "V17",
    `import { Button as Btn, XIcon } from "@toki/ui-web";\nexport const a = <Btn><XIcon /></Btn>;`,
    true,
  ],
  [
    "V18",
    `${UI}export const a = (cond) => <button>{cond && <XIcon />}</button>;`,
    true,
  ],
  [
    "V19",
    `${UI}export const a = (cond) => <button>{cond ? <XIcon /> : null}</button>;`,
    true,
  ],
  ["V20", `${UI}export const a = <IconButton icon="x" label="   " />;`, true],
  [
    "V21",
    `import { IconButton } from "../IconButton";\nexport const a = <IconButton icon="x" />;`,
    true,
  ],
  [
    "A1",
    `${UI}export const a = <button aria-label="Close"><XIcon /></button>;`,
    false,
  ],
  [
    "A2",
    `${UI}export const a = <button aria-labelledby="t"><XIcon /></button>;`,
    false,
  ],
  [
    "A3",
    `${UI}export const a = (t) => <button aria-label={t("x")}><XIcon /></button>;`,
    false,
  ],
  ["A4", `${UI}export const a = <button><XIcon />Close</button>;`, false],
  [
    "A5",
    `${UI}export const a = (label) => <button><XIcon />{label}</button>;`,
    false,
  ],
  [
    "A6",
    `${UI}export const a = <button><XIcon /><span className="sr">Close</span></button>;`,
    false,
  ],
  ["A7", `${UI}export const a = <IconButton icon="x" label="Close" />;`, false],
  [
    "A8",
    `${UI}export const a = (t) => <IconButton icon="x" label={t("x")} />;`,
    false,
  ],
  [
    "A9",
    `${UI}export const a = (props) => <button {...props}><XIcon /></button>;`,
    false,
  ],
  [
    "A10",
    `import { MyIcon } from "other-lib";\nexport const a = <button><MyIcon /></button>;`,
    false,
  ],
  ["A11", `export const a = <button type="button" />;`, false],
  [
    "A12",
    `${UI}export const a = (props) => <IconButton icon="x" {...props} />;`,
    false,
  ],
  [
    "A13",
    `${UI}export const a = (cond) => <button>{cond || <XIcon />}</button>;`,
    false,
  ],
  [
    "A14",
    `${UI}export const a = (cond) => <button><XIcon />{cond && "Close"}</button>;`,
    false,
  ],
  [
    "A15",
    `import { Button } from "other-lib";\nimport { XIcon } from "@toki/ui-web";\nexport const a = <Button><XIcon /></Button>;`,
    false,
  ],
];

// A file that need not exist; its folder gives the relative imports of V13 and V21 their meaning.
const FILE = "packages/ui-web/src/components/Case/Case.tsx";
const ruleMessages = (messages) => messages.filter((m) => m.ruleId === RULE);

// Cases beyond Table K: Button and IconButton reached through a namespace import.
const extra = [
  [
    "E1",
    `import * as UI from "@toki/ui-web";\nexport const a = <UI.IconButton icon="x" />;`,
    true,
  ],
  [
    "E2",
    `import * as UI from "@toki/ui-web";\nexport const a = <UI.Button><UI.XIcon /></UI.Button>;`,
    true,
  ],
  [
    "E3",
    `import * as UI from "@toki/ui-web";\nexport const a = <UI.IconButton icon="x" label="Close" />;`,
    false,
  ],
  [
    "E4",
    `import * as UI from "other-lib";\nexport const a = <UI.Button><UI.XIcon /></UI.Button>;`,
    false,
  ],
];

test("Table K has 36 cases, 21 reported and 15 not", () => {
  assert.equal(cases.length, 36);
  assert.equal(cases.filter(([, , v]) => v).length, 21);
});

for (const [id, code, reported] of [...cases, ...extra]) {
  test(`${id} is ${reported ? "reported" : "not reported"}`, async () => {
    const [result] = await eslint.lintText(code, {
      filePath: path.join(root, FILE),
    });
    const hits = ruleMessages(result.messages);
    assert.equal(hits.length > 0, reported, JSON.stringify(result.messages));
    if (reported) {
      assert.match(hits[0].message, /icon-only-button-name/);
      assert.match(hits[0].message, /aria-label|label/);
    }
  });
}

test("the same case in apps/web/src is reported (R24)", async () => {
  const [result] = await eslint.lintText(
    `${UI}export const a = <button><XIcon /></button>;`,
    {
      filePath: path.join(root, "apps/web/src/Case.tsx"),
    },
  );
  assert.equal(ruleMessages(result.messages).length, 1);
});

test("an eslint-disable comment has no effect and is itself reported (R24)", async () => {
  const code = `${UI}// eslint-disable-next-line toki/icon-only-button-name\nexport const a = <button><XIcon /></button>;`;
  const [result] = await eslint.lintText(code, {
    filePath: path.join(root, FILE),
  });
  assert.equal(ruleMessages(result.messages).length, 1);
  assert.ok(
    result.messages.some(
      (m) => m.ruleId === null && /noInlineConfig|no effect/.test(m.message),
    ),
  );
});

for (const file of [
  "packages/ui-web/src/components/IconButton/IconButton.tsx",
  "apps/web/src/main.tsx",
]) {
  test(`the rule is at error with inline configuration off for ${file}`, async () => {
    const config = await eslint.calculateConfigForFile(path.join(root, file));
    assert.equal(config.rules[RULE][0], 2);
    assert.equal(config.linterOptions.noInlineConfig, true);
  });
}

test("a test file does not hold the rule", async () => {
  const config = await eslint.calculateConfigForFile(
    path.join(
      root,
      "packages/ui-web/src/components/IconButton/IconButton.test.tsx",
    ),
  );
  assert.equal(config.rules[RULE], undefined);
});
