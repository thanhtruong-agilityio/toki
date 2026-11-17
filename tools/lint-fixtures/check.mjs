// Proves the three boundary rules of eslint.config.js on every run
// (pnpm lint:boundaries). Plain ESLint cannot assert that an expected
// violation was reported, so this script does:
//
// 1. It lints the fixture folders next to this file with the real config and
//    compares what ESLint reports with the markers in the fixture files.
//      // expect: <rule id>[, <rule id>]       a report on this line
//      // expect-next: <rule id>[, <rule id>]  a report on the next line
//    The id "inline-config" stands for ESLint's "has no effect because you
//    have 'noInlineConfig'" message, which has no rule id.
//    A file with no marker must have no report.
//    A line holds one violation, so one marker is one report.
// 2. It checks that the real paths, in each of the eight source file
//    extensions, hold the same rules as the fixtures, at severity error, with
//    inline configuration switched off, and that a violating line linted
//    under each real path is reported. A test file path must not hold them.
//
// Exit 0 when everything matches, 1 otherwise.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import globals from "globals";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const relative = (file) => path.relative(root, file);

// Fixture folder -> the rules its block must hold, and the files it must have.
const FIXTURES = {
  "client-core": {
    rules: [
      "toki/client-core-globals",
      "@typescript-eslint/no-restricted-imports",
      "no-restricted-syntax",
    ],
    files: ["violates.ts", "allowed.ts", "disabled.ts"],
  },
  "server-modules": {
    rules: ["toki/module-entry"],
    files: [
      "modules/module-a/violates.ts",
      "modules/module-a/allowed.ts",
      "outside.ts",
      "outside-allowed.ts",
    ],
  },
  "ui-web": {
    rules: [
      "no-restricted-globals",
      "no-restricted-properties",
      "no-restricted-syntax",
    ],
    files: ["violates.tsx", "allowed.tsx"],
  },
};

// The real paths each block must reach (R15), without their extension: each
// is checked with every source extension. A file need not exist. `probe` is
// one violating line, linted as if it were that file; `rule` must report it.
const globalProbe = {
  fixture: "client-core",
  probe: "export const probe = window;\n",
  rule: "toki/client-core-globals",
};
const platformProbe = {
  fixture: "ui-web",
  probe: "export const probe = localStorage;\n",
  rule: "no-restricted-globals",
};
const moduleProbe = {
  fixture: "server-modules",
  probe: 'import "../other/db/tables";\n',
  rule: "toki/module-entry",
};
// A source file is any non-test file under src/ with one of these extensions.
// The list is written out a second time on purpose, like the allow list below.
const SOURCE_EXTENSIONS = [
  "ts",
  "tsx",
  "mts",
  "cts",
  "js",
  "jsx",
  "mjs",
  "cjs",
];
const REAL_STEMS = {
  "packages/client-core/src/index": globalProbe,
  "packages/client-core/src/sync/socket": globalProbe,
  "packages/shared/src/index": globalProbe,
  "packages/shared/src/time/zone": globalProbe,
  "packages/i18n/src/index": globalProbe,
  "packages/i18n/src/locale/format": globalProbe,
  "packages/tokens/src/index": globalProbe,
  "packages/tokens/src/color/scale": globalProbe,
  "packages/ui-web/src/index": platformProbe,
  "packages/ui-web/src/button/button": platformProbe,
  "apps/server/src/modules/example/index": moduleProbe,
  "apps/server/src/modules/example/db/query": {
    ...moduleProbe,
    probe: 'import "../../other/db/tables";\n',
  },
  "apps/server/src/app": {
    ...moduleProbe,
    probe: 'import "./modules/example/db/tables";\n',
  },
};
const withExtensions = (stems) =>
  stems.flatMap((stem) => SOURCE_EXTENSIONS.map((ext) => `${stem}.${ext}`));
const REAL_PATHS = Object.fromEntries(
  withExtensions(Object.keys(REAL_STEMS)).map((file) => [
    file,
    REAL_STEMS[file.slice(0, file.lastIndexOf("."))],
  ]),
);

// Test files are outside rules 1 and 3 (spec concern 12): these paths must
// not hold the rules of their group.
const TEST_PATHS = Object.fromEntries(
  withExtensions([
    "packages/client-core/src/index.test",
    "packages/shared/src/time/zone.test",
    "packages/i18n/src/index.test",
    "packages/tokens/src/index.test",
  ])
    .map((file) => [file, "client-core"])
    .concat(
      withExtensions(["packages/ui-web/src/button/button.test"]).map((file) => [
        file,
        "ui-web",
      ]),
    ),
);

// The allow list of globals for client-core, shared, i18n and tokens, written
// out a second time on purpose: a global added in eslint.config.js alone
// fails this check. The language built-ins are ES2022 without globalThis.
const ALLOWED_GLOBALS = new Set([
  ...Object.keys(globals.es2022).filter((name) => name !== "globalThis"),
  "console",
  "setTimeout",
  "clearTimeout",
  "setInterval",
  "clearInterval",
  "queueMicrotask",
  "fetch",
  "Headers",
  "Request",
  "Response",
  "WebSocket",
  "URL",
  "URLSearchParams",
  "AbortController",
  "AbortSignal",
]);

const failures = [];
const fail = (message) => failures.push(message);

const eslint = new ESLint({ cwd: root, ignore: false });

function fixtureFiles(dir) {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort();
}

// "line id" -> how many times, from the markers of a fixture file.
function expectedReports(file) {
  const expected = new Map();
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((text, index) => {
    const marker = /\/\/ expect(-next)?: (.+)$/.exec(text);
    if (!marker) return;
    const line = index + 1 + (marker[1] ? 1 : 0);
    for (const id of marker[2].split(",")) {
      const report = `${line} ${id.trim()}`;
      expected.set(report, (expected.get(report) ?? 0) + 1);
    }
  });
  return expected;
}

// "line id" -> how many times, from what ESLint reported.
function reportedReports(result) {
  const reported = new Map();
  for (const message of result.messages) {
    const where = `${relative(result.filePath)}:${message.line}`;
    let id = message.ruleId;
    if (id) {
      if (message.severity !== 2) {
        fail(`${where}: ${id} is reported as a warning, not an error`);
      }
    } else if (!message.fatal && message.message.includes("noInlineConfig")) {
      id = "inline-config";
    } else {
      fail(`${where}: ${message.message}`);
      continue;
    }
    const report = `${message.line} ${id}`;
    reported.set(report, (reported.get(report) ?? 0) + 1);
  }
  return reported;
}

async function checkFixtures() {
  for (const [folder, { files: required }] of Object.entries(FIXTURES)) {
    const dir = path.join(here, folder);
    const files = existsSync(dir) ? fixtureFiles(dir) : [];
    for (const file of required) {
      if (!files.includes(path.join(dir, file))) {
        fail(
          `tools/lint-fixtures/${folder}/${file}: the fixture file is missing`,
        );
      }
    }
    if (files.length === 0) continue;
    for (const result of await eslint.lintFiles(files)) {
      const name = relative(result.filePath);
      const expected = expectedReports(result.filePath);
      const reported = reportedReports(result);
      if (/violates\.tsx?$/.test(name) && expected.size === 0) {
        fail(`${name}: no violating line is marked`);
      }
      for (const report of new Set([...expected.keys(), ...reported.keys()])) {
        const [line, id] = report.split(" ");
        const want = expected.get(report) ?? 0;
        const got = reported.get(report) ?? 0;
        if (got < want) {
          fail(`${name}:${line}: expected ${id}, not reported`);
        } else if (got > want) {
          fail(`${name}:${line}: ${id} reported, not expected`);
        }
      }
    }
  }
}

function severityOf(entry) {
  return Array.isArray(entry) ? entry[0] : entry;
}

async function checkRealPaths() {
  for (const [file, { fixture: folder, probe, rule }] of Object.entries(
    REAL_PATHS,
  )) {
    const filePath = path.join(root, file);
    const config = await eslint.calculateConfigForFile(filePath);
    const fixture = await eslint.calculateConfigForFile(
      path.join(here, folder, "fixture.ts"),
    );
    if (!config) {
      fail(`${file}: ignored by the ESLint configuration`);
      continue;
    }
    for (const name of FIXTURES[folder].rules) {
      const entry = config.rules?.[name];
      if (severityOf(entry) !== 2) {
        fail(`${file}: ${name} is not at severity error`);
      } else if (
        JSON.stringify(entry) !== JSON.stringify(fixture?.rules?.[name])
      ) {
        fail(`${file}: ${name} has other options than the fixture ${folder}`);
      }
    }
    const [result] = await eslint.lintText(probe, { filePath });
    if (!result.messages.some((message) => message.ruleId === rule)) {
      fail(`${file}: a violating line is not reported by ${rule}`);
    }
    if (config.linterOptions?.noInlineConfig !== true) {
      fail(`${file}: inline configuration is not switched off`);
    }
    if (folder !== "client-core") continue;
    if (config.languageOptions?.ecmaVersion !== 2022) {
      fail(`${file}: the language built-ins are not those of ES2022`);
    }
    const enabled = new Set(
      Object.entries(config.languageOptions?.globals ?? {})
        .filter(([, value]) => value !== "off")
        .map(([name]) => name),
    );
    const extra = [...enabled].filter((name) => !ALLOWED_GLOBALS.has(name));
    const missing = [...ALLOWED_GLOBALS].filter((name) => !enabled.has(name));
    if (extra.length > 0) {
      fail(`${file}: globals outside the allow list: ${extra.join(", ")}`);
    }
    if (missing.length > 0) {
      fail(`${file}: globals of the allow list missing: ${missing.join(", ")}`);
    }
  }
}

async function checkTestPaths() {
  for (const [file, folder] of Object.entries(TEST_PATHS)) {
    const config = await eslint.calculateConfigForFile(path.join(root, file));
    for (const name of FIXTURES[folder].rules) {
      if (severityOf(config?.rules?.[name] ?? 0) !== 0) {
        fail(`${file}: a test file holds ${name}`);
      }
    }
  }
}

await checkFixtures();
await checkRealPaths();
await checkTestPaths();

if (failures.length > 0) {
  console.error(`lint:boundaries failed (${failures.length}):`);
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}
console.log("lint:boundaries: every boundary rule fires on its fixture");
