# TOKI-002 Lint, format and package boundary rules - implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use cl-dev:executing-plans to implement this plan task-by-task.

**Goal:** the repository gets one lint configuration, one formatter and three boundary rules that fail `pnpm lint`, each proven on every run by fixtures.

**Architecture:** configuration, one small local ESLint rule, fixtures and one check script. No runtime code.

**Tech stack:** ESLint 10.15.0, `@eslint/js` 10.0.1, `typescript-eslint` 8.72.2, `eslint-config-prettier` 10.1.8, `globals` 17.14.0, Prettier 3.10.1 (the stable releases on npm on 2026-11-17, pinned exactly; spec concern 7; `typescript-eslint` is one release behind, see Design). Node 22, pnpm 12.21.0, TypeScript 7.0.2 stay as TOKI-001 left them.

**Spec:** `docs/specs/2026-11-12-lint-format-boundary-rules-design.md` (R1 to R17). Tier M.

## Design

### TypeScript 6 API next to TypeScript 7

`typescript-eslint` stops with "typescript-eslint does not support TS 7.0": TypeScript 7.0 ships no programmatic API (checked in a scratch project on 2026-11-17). The TypeScript 7.0 announcement gives the way to run both, and this plan uses it unchanged:

```json
"devDependencies": {
  "@typescript/native": "npm:typescript@7.0.2",
  "typescript": "npm:@typescript/typescript6@6.0.2"
}
```

- `tsc` is still TypeScript 7.0.2 (the `tsc` binary comes from the `typescript@7.0.2` package under its alias), so `pnpm typecheck` is unchanged. Checked: `pnpm exec tsc --version` prints `Version 7.0.2`.
- The name `typescript` now resolves to the TypeScript 6.0.2 API, which only the lint tools import. It adds a `tsc6` binary that nothing calls.
- Both stay pinned to exact versions, one copy each, in the root `devDependencies`.
- `typescript-eslint` is 8.72.2, not the newest 8.73.0. 8.73.0 was published on 2026-11-16, inside pnpm's minimum release age; installing it made pnpm write eleven `minimumReleaseAgeExclude` entries into `pnpm-workspace.yaml`. 8.72.2 (2026-11-09) needs no exception to that supply-chain rule and leaves `pnpm peers check` clean.
- An editor that uses the workspace TypeScript version now picks 6.0.2 for its language service; `pnpm typecheck` is the reference. Said in the README.
- Rejected: scoped pnpm `overrides` (`typescript-eslint>typescript`). Tried; they do not change a peer dependency, lint still loads TypeScript 7.
- Rejected: linting without `typescript-eslint`. ESLint cannot parse TypeScript without it.

Lint is not type-aware (no `projectService`), so it needs no `tsconfig` and lints files that do not belong to any project (the fixtures, root configuration files).

### `eslint.config.js` (one root file)

In order:

1. Global ignores: `**/node_modules/`, `**/dist/`, `**/build/`, `**/coverage/`, and the fixture folders `tools/lint-fixtures/*/` (R1, R12). `tools/lint-fixtures/check.mjs` is a file, not a folder, so it stays linted.
2. Base style: `js.configs.recommended`, `tseslint.configs.recommended`; Node globals for `**/*.{js,mjs,cjs}` (root tooling); `eslint-config-prettier` last among the style entries (R4).
3. Rule 1 block. `files`: `packages/{client-core,shared,i18n,tokens}/src/**/*.{ts,tsx}` plus `tools/lint-fixtures/client-core/**`; `ignores`: `**/*.test.{ts,tsx}`.
   - `languageOptions.ecmaVersion: 2022` and `languageOptions.globals` = the ES2022 built-ins from the `globals` package, the fifteen names of the spec's allow list, and `globalThis: "off"` (it reaches every browser global).
   - `toki/client-core-globals: error`, a local rule in `tools/lint-rules/client-core-globals.js` (about 30 lines). It reports every reference that the file's global scope cannot resolve, which is how the core `no-undef` rule works, with two differences: the message starts with "client-core boundary:" (R5 asks that the error names the boundary rule, and `no-undef` only says "'window' is not defined"), and `typeof window` is reported too. Checked in the scratch project with `no-undef`: this reports `window`, `document`, `globalThis.document`, `const { location } = self`, and type references such as `HTMLElement` and `Element`, because `typescript-eslint`'s scope analysis knows only the ES library types. So the DOM type names of R5 need no separate rule, and DOM types outside the named list fail too (stricter than concern 12 asks, at no cost).
   - `@typescript-eslint/no-restricted-imports: error` with patterns for `react-dom`, `react-dom/*`, `@toki/ui-web`, `@toki/ui-web/*`, and `**/ui-web`, `**/ui-web/**` (R6). It covers `import`, `export ... from` and `import x = require()`. A relative path from one of the four packages into `packages/ui-web` always contains the `ui-web` segment, so a text pattern is enough here.
   - `no-restricted-syntax: error` with two selectors: `import("...")` as a call or as a type with the same sources (the import rule does not see them), and ambient declarations (`declare const window: any`, `declare global { ... }`, `declare function`), which would hide a browser global from the globals rule the way a `/* global */` comment would (R16 in spirit).
   - `linterOptions.noInlineConfig: true` (R16).
4. Rule 2 block. `files`: `apps/server/src/**/*.{ts,tsx}` plus `tools/lint-fixtures/server-modules/**`. One block covers both the files inside `modules/` (R7, R8) and the files outside it (R17), because the rule is the same: an import that resolves into a module other than the importing file's own module must resolve to that module's entry file.
   - `toki/module-entry: error`, a local rule in `tools/lint-rules/module-entry.js` (about 70 lines). Option `modulesDirs`: the folders that hold modules (`apps/server/src/modules`, and the fixture folder). For every `import`, `export ... from`, `export *`, `import()`, `import("...")` type, `import x = require()` and `require()` with a relative specifier it resolves the specifier against the importing file's folder with `node:path` (no file system access, so a file need not exist). If the result is inside `<modulesDir>/<name>/` and the importing file is not inside that same module, the rest of the path must be empty, `index`, `index.ts` or `index.js`; anything else is reported with a message that starts with "server module boundary:" and names the module. Paths are compared without case, because macOS resolves `../MODULE-B/db`.
   - Why a local rule and not `eslint-plugin-boundaries` (the spec's example; "the plugin is the builder's choice"): the plugin needs an import resolver that maps `../b/index.js` to `index.ts` and needs the target files to exist; the resolver for TypeScript is one more package that depends on the TypeScript API, which is the weak point above. The rule needed here is one path comparison. The fixture cases of R7, R8 and R17 prove it either way.
   - Limit: a non-relative specifier (a `tsconfig` path alias, or the package's own name) is not resolved. Neither exists in `apps/server` today; the ticket that adds one must extend the rule. Recorded in the PR under Risk.
   - Limit: the block stops at `apps/server/src`, as R17 says. A file elsewhere in `apps/server` (a script folder) that re-exports a module's internals is not checked. Recorded in the PR under Risk.
   - `linterOptions.noInlineConfig: true`.
5. Rule 3 block. `files`: `packages/ui-web/src/**/*.{ts,tsx}` plus `tools/lint-fixtures/ui-web/**`; `ignores`: test files.
   - `no-restricted-globals: error` for `Notification`, `localStorage`, `sessionStorage`, `indexedDB`, `Audio`, `AudioContext`, `caches` (bare names; the rule respects shadowing).
   - `no-restricted-properties: error` for the same seven names on `window`, `globalThis` and `self`, for `navigator.serviceWorker`, and for `document.cookie`. This core rule also reports destructuring (`const { localStorage } = window`) and `window["localStorage"]`.
   - `no-restricted-syntax: error` for `<audio>` in JSX and, for `navigator.serviceWorker` and `document.cookie`, the forms the property rule does not see: the chain through `window`, `globalThis` or `self`, destructuring that chain (`const { serviceWorker } = window.navigator`) and nested destructuring (`const { navigator: { serviceWorker } } = window`).
   - `linterOptions.noInlineConfig: true`.
   - Not caught, relies on review (concern 12): a renamed copy of `window`.
6. A comment above rule 3: file picking in `ui-web` is not checked by lint and relies on review (R14).

Every message starts with the boundary's name ("client-core boundary: ...", "server module boundary: ...", "ui-web boundary: ..."), so the error names the boundary rule, not only the ESLint rule id.

### Fixtures and `check.mjs`

```
tools/
├─ lint-rules/        client-core-globals.js, module-entry.js
└─ lint-fixtures/
   ├─ check.mjs
   ├─ client-core/    violates.ts, allowed.ts, disabled.ts
   ├─ server-modules/ outside.ts, outside-allowed.ts,
   │                  modules/module-a/{violates.ts, allowed.ts, index.ts, db/tables.ts},
   │                  modules/module-b/{index.ts, db/index.ts, db/tables.ts}
   └─ ui-web/         violates.tsx, allowed.tsx
```

- Two deviations from the spec's proposed layout: the two local rules live in `tools/lint-rules/` (the spec expected a plugin from npm), and the two fixture modules sit under `server-modules/modules/`, so `outside.ts` is truly outside the modules folder, as in `apps/server/src`.
- Markers: `// expect: <rule id>[, <rule id>]` at the end of a violating line; `// expect-next: <id>` on the line above when the line itself cannot carry the marker. The id `inline-config` stands for ESLint's "has no effect because you have 'noInlineConfig'" message, which has no rule id. A line holds one violation.
- `check.mjs` (plain Node, no dependency beyond `eslint` and `globals`):
  1. Lints the fixture folders with `new ESLint({ ignore: false })` (checked: this lints a globally ignored folder with the real config).
  2. For every fixture file compares, per `(line, rule id)`, how many reports ESLint made with how many the markers expect. A marked line that is not reported, a report that is not marked, a rule reported at severity `warn`, or a parse error fails and prints `fixture:line` and the rule id. A file with no marker must have no report (the allowed files).
  3. Fails when one of the required fixture files is missing, or when a `violates` file has no marker (guards a deleted or emptied fixture).
  4. R15: for the seven real paths of the spec, plus one deeper `.tsx` path per package and one deeper module path, it calls `calculateConfigForFile` and checks that each rule of the path's block is at severity 2 with the same options as the fixture folder's, that `linterOptions.noInlineConfig` is true and, for the four packages, that `ecmaVersion` is 2022 and the enabled globals equal the expected allow list exactly. The expected list is written out again in `check.mjs`, so editing the list in `eslint.config.js` alone fails the check. It then lints one violating line as if it were that path (`lintText` with `filePath`) and requires the report, which exercises the real `files` globs and the real `modulesDirs`.
  5. Exit 0 when nothing failed, 1 otherwise.
- `allowed.tsx` in `ui-web` imports from `@toki/platform` (lint does not resolve it), proving R10.
- The ui-web and server fixtures each hold one `eslint-disable-next-line` case too; `client-core/disabled.ts` holds all five comment forms of R16.

### Scripts, Prettier, documents

- Root scripts: `lint`: `eslint . --max-warnings 0` (R1, R13); `lint:boundaries`: `node tools/lint-fixtures/check.mjs`; `format`: `prettier --write .`; `format:check`: `prettier --check .`.
- `.prettierrc`: `{}`. `.prettierignore`: `dist/`, `build/`, `coverage/`, `pnpm-lock.yaml`, `docs/`, `.github/`, `.claude/`, `CLAUDE.md`. `node_modules` is ignored by Prettier by default.
- One `pnpm format` pass over the existing files, in its own commit, layout only.
- `README.md` (Quick Start, Testing) and the Commands section of `CLAUDE.md` get the four commands.

## AC -> step -> test

No test runner yet (TOKI-008). The fixtures are the tests; the rest are commands run by hand under Node 22 in this worktree, as the spec's Testing section says.

| AC | Step | Test (command -> expected) |
| :-- | :-- | :-- |
| R1 | 1, 2 | `pnpm lint` -> exit 0 on the clean tree; a temporary `e2e/x.ts` with an unused variable -> non-zero, names it; `pnpm typecheck` -> still exit 0 with `tsc` 7.0.2 |
| R2 | 6 | `pnpm format:check` -> exit 0; badly formatted `packages/shared/src/tmp.ts` -> non-zero, names the file; a badly formatted file under `docs/` -> still exit 0 |
| R3 | 6 | `pnpm format` then `pnpm format:check` -> exit 0 |
| R4 | 6 | `pnpm lint` right after `pnpm format` on that file -> no formatting error |
| R5 | 3 | `client-core/violates.ts`: one marked line per form (bare `window`, `document`, `localStorage`, `navigator`, `location`, `matchMedia`; `window.x`, `globalThis.x`, `self.x`; destructuring of each; types `Window`, `Document`, `Element`, `HTMLElement`, `SVGElement`) -> `pnpm lint:boundaries` exit 0; `allowed.ts` uses every allow-list name -> no report |
| R6 | 3 | marked lines for `react-dom`, `react-dom/client`, `@toki/ui-web`, `@toki/ui-web/x`, `../../ui-web/src/index` |
| R7 | 4 | `module-a/violates.ts`: `../module-b/db/tables`, `../module-b/db/index`, `../module-b/db` (nested index), `export ... from`, `import()` -> all marked |
| R8 | 4 | `module-a/allowed.ts`: `../module-b`, `../module-b/index`, `../module-b/index.js`, `./db/tables`, `./db/index`, `../module-a/db/tables` -> no report |
| R9 | 5 | `ui-web/violates.tsx`: each of the nine banned items bare, through `window`, `globalThis`, `self`, by destructuring, `window.navigator.serviceWorker`, `<audio>` -> all marked |
| R10 | 5 | `ui-web/allowed.tsx` -> no report |
| R11 | 3, 4, 5 | each fixture written before its rule: `pnpm lint:boundaries` fails naming fixture and line, passes after the rule. Then, per rule: set it to `off` in the config -> non-zero; remove one banned item -> non-zero naming that line; undo |
| R12 | 2 | `pnpm lint` exit 0 while the violating fixtures exist |
| R13 | 2 | set `toki/client-core-globals` to `warn` in rule 1 with a temporary violating file in `packages/shared/src/` -> `pnpm lint` non-zero; `lint:boundaries` non-zero; undo |
| R14 | 5 | `grep -n "file picking" eslint.config.js` -> one line |
| R15 | 3, 4, 5 | narrow one block's `files` so it misses its package -> `pnpm lint:boundaries` non-zero naming the path; add a global to the allow list in the config only -> non-zero; undo |
| R16 | 3 | `client-core/disabled.ts`: the five comment forms, each marked `inline-config`, each violation still marked `toki/client-core-globals`; a temporary `packages/shared/src/tmp.ts` with a disabled violation -> `pnpm lint` non-zero with both messages |
| R17 | 4 | `server-modules/outside.ts`: `./modules/module-a/db/tables` marked; `outside-allowed.ts`: `./modules/module-a`, `./modules/module-a/index.js` -> no report |

## Steps

Commits follow Conventional Commits with a lowercase subject and `(TOKI-002)` at the end. Steps 2 to 5 land in one commit, because the check script, the rules and their fixtures only pass together.

1. **Dependencies and scripts.** Root `package.json`: the two TypeScript aliases, the six lint and format packages at the exact versions above, the four scripts; `.prettierrc`, `.prettierignore`; `pnpm install`; confirm `pnpm typecheck` exit 0 and `tsc --version` 7.0.2. Commit `chore(repo): add eslint and prettier next to the typescript 6 api`.
2. **Base lint and check script.** `eslint.config.js` with ignores and base style only; `check.mjs` complete, including the R15 part. `pnpm lint` exits 0; `pnpm lint:boundaries` fails (no fixtures, no blocks): the right failure.
3. **Rule 1.** Fixtures first (`violates.ts`, `allowed.ts`, `disabled.ts`), see `lint:boundaries` name the unreported lines; add `tools/lint-rules/client-core-globals.js` and the block; see the `client-core` part pass.
4. **Rule 2.** Fixtures first, see them fail; add `tools/lint-rules/module-entry.js` and the block.
5. **Rule 3.** Fixtures first, see them fail; add the block and the file-picking comment. `pnpm lint:boundaries` now exits 0. Commit `chore(lint): enforce the three package boundaries and prove them with fixtures`.
6. **Format pass.** See `format:check` fail on the existing files; run `pnpm format`; read the diff (layout only); `format:check`, `lint`, `lint:boundaries`, `typecheck` all exit 0. Commit `style: format the existing files with prettier`.
7. **Hand checks and documents.** The hand checks of the table (R1, R2 to R4, R11 switch-off, R13, R15, R16), each undone; `README.md` and `CLAUDE.md` commands. Commit `docs: describe the lint and format commands`.

## What can break

Riskiest step: 1 (one grilling round, done with the advisor on this plan). Everything else depends on `typescript-eslint` loading next to TypeScript 7, and the alias renames the `typescript` dependency that TOKI-001 pinned. Mitigation: done first, already proven in a scratch project, and `pnpm typecheck` plus `tsc --version` are checked before anything else is built.

- A later ticket (Vite, drizzle-kit) imports `typescript` and gets 6.0.2, not 7. That is what those tools need today for the same reason; said in the PR.
- Reporting DOM type names depends on `typescript-eslint` not knowing the DOM library. If a later change sets `parserOptions.lib` with `dom` for these packages, DOM types pass silently. Guard: the `violates.ts` lines for `HTMLElement` and the other four types fail `lint:boundaries` at once.
- A new legitimate global in `client-core` (for example `structuredClone`) fails lint until the allow list is edited in two places (config and `check.mjs`). That is the intended friction (concern 3).
- The single format pass touches files owned by TOKI-001 (`package.json`, the `tsconfig.json` files, `README.md`). Kept in its own commit so the review can skip it.
- Prettier could move a fixture marker onto another line. Fixture lines are kept short, and `format:check` plus `lint:boundaries` both run after the format pass.
- A fixture check that passes while a rule is broken. Raised by the advisor, closed in the design: reports are counted per line, required fixture files are listed, and a violating line is linted under every real path.
