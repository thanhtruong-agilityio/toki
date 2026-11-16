# Lint, format and package boundary rules design

Date: 2026-11-12 · Status: draft for review
Intent: docs/intents/lint-format-boundary-rules.md (Thanh Truong)
Ticket: TOKI-002

## Goal
The builder (Thanh and Claude) needs one code style, one format and an automatic check of the three agreed boundaries in the Toki monorepo.
Today nothing checks them, so a boundary can break unnoticed, for example `client-core` could start to depend on the browser and React Native could not reuse it in phase 3.
This work supplies the "lint blocks a package-boundary violation" part of Blueprint intent I01, and the lint step that CI (TOKI-007) runs.

## Scope
- In: ESLint and Prettier configuration at the repository root; root scripts to lint, check format and fix format; the three boundary rules as ESLint rules; one fixture per rule that proves the rule fires; a small check script that runs the fixtures; one formatting pass over the files that already exist; a short note on what lint cannot catch (file picking).
- Out (not now):
  - Creating the packages, apps and shared TypeScript config: TOKI-001.
  - Running lint in CI, type check, tests, build, bundle size: TOKI-007. Its lint check runs all three scripts of this work: `pnpm lint`, `pnpm lint:boundaries` and `pnpm format:check` (decision of 2026-11-12).
  - The server skeleton and the `apps/server/src/modules/` folder: TOKI-004. The first table, placed inside `apps/server/src/modules/workspace/`: TOKI-005. Later tickets add the other modules.
  - The `platform` interface and its web implementation: TOKI-018.
  - The test harness (Vitest, Playwright): TOKI-008.
  - Writing the boundary rules into `CLAUDE.md`, hooks and permissions: TOKI-095.
  - Rules for `apps/mobile`, `apps/desktop` and `ui-native`: added in their own phases.
  - A lint check for file picking: not possible by lint; it relies on review.
  - Git pre-commit hooks: the intent does not ask for them.

## Requirements
- R1. `pnpm lint` at the repository root runs ESLint over the whole repository (apps, packages, root configuration files and any later folder such as `e2e/` or `infra/`) and exits 0 on the clean repository left by TOKI-001. The ESLint configuration ignores build output (`dist/`, `build/`, `coverage/`), generated files and the fixture folders under `tools/lint-fixtures/` (R12); `check.mjs` itself is linted.
- R2. `pnpm format:check` at the root runs Prettier in check mode over every file that `.prettierignore` does not exclude and exits 0 on the clean repository; it exits non-zero and names the file when a covered file is badly formatted. `.prettierignore` excludes build output, the lock file, generated files, `docs/`, `.github/`, `.claude/` and `CLAUDE.md`. To reach exit 0, this work runs `pnpm format` once over the files that already exist (for example `package.json`, the `tsconfig.json` files, `README.md`) and commits the result.
- R3. `pnpm format` at the root rewrites badly formatted files, after which `pnpm format:check` exits 0.
- R4. ESLint and Prettier do not disagree: a file that `pnpm format` has just written produces no formatting error from `pnpm lint`.
- R5. A source file in `packages/client-core`, `packages/shared`, `packages/i18n` or `packages/tokens` that uses a global outside the allow list in Design (for example `window`, `document`, `localStorage`, `navigator`, `location`, `matchMedia`) makes `pnpm lint` exit non-zero with an error that names the file and the boundary rule. This holds for a bare name, for access through `window`, `globalThis` or `self` (for example `globalThis.document`), and for destructuring one of those objects. It also holds for a type reference to `Window`, `Document`, `Element` or a type whose name starts with `HTML` or `SVG` (for example `HTMLElement`). A source file is a file under the package's `src/` folder that is not a test file (`*.test.ts`, `*.test.tsx`).
- R6. A source file in one of the four packages of R5 that imports `react-dom` or one of its subpaths (for example `react-dom/client`), `@toki/ui-web` or one of its subpaths, or a relative path that resolves into `packages/ui-web`, makes `pnpm lint` exit non-zero with an error that names the file and the boundary rule. The ban on the web implementation of `platform` is added by TOKI-018, which creates it (concern 9).
- R7. A file in one server module that imports a file inside another server module, other than that module's public entry file, makes `pnpm lint` exit non-zero with an error that names the file and the boundary rule. The rule decides on the resolved file path, not on the text of the import: an import inside the same module passes at any depth, and a nested `index.ts` of another module (for example `modules/b/db/index.ts`) is not its public entry and fails.
- R8. A file in one server module that imports another module's public entry file passes `pnpm lint`, in every import form that resolves to that file (`../b`, `../b/index`, `../b/index.js`).
- R9. A source file in `packages/ui-web` that uses the notification, storage, service worker or audio API directly (the globals listed in Design), or that renders an `<audio>` element in JSX, makes `pnpm lint` exit non-zero with an error that names the file and the boundary rule. This holds for a bare name, for access through `window`, `globalThis` or `self` (for example `window.localStorage`, `window.navigator.serviceWorker`), and for destructuring one of those objects (for example `const { localStorage } = window`). "Source file" has the meaning given in R5.
- R10. A file in `packages/ui-web` that reaches the same features by importing from `platform` passes `pnpm lint`.
- R11. Each boundary rule has a fixture with a violating file and an allowed file. The violating file holds one violating line for each banned item or sub-rule (each banned global and each access form in R5 and R9, each import target in R6, each case in R7 and R17), and each line is marked with the rule id expected there. `pnpm lint:boundaries` runs the check script, which lints the fixtures and exits 0 only when every marked line is reported by its expected rule id, a violating file has no other report, and every allowed file has no report; it exits non-zero and names the fixture and the line when a boundary rule, or one banned item of it, is removed or switched off. One more fixture file holds a violating line under an `eslint-disable-next-line` comment; the check passes only when that line is still reported and the comment itself is reported (R16).
- R12. The fixtures are excluded from `pnpm lint`, so R1 holds while the fixtures exist.
- R13. Every boundary violation is reported at severity `error`, never `warn`; `pnpm lint` also exits non-zero when any warning exists.
- R14. The ESLint configuration file carries a comment stating that file picking in `ui-web` is not checked by lint and relies on review.
- R15. The check script also proves that the rules reach the real paths: the ESLint configuration computed for `packages/client-core/src/index.ts`, `packages/shared/src/index.ts`, `packages/i18n/src/index.ts`, `packages/tokens/src/index.ts`, `packages/ui-web/src/index.ts`, `apps/server/src/modules/example/index.ts` and `apps/server/src/app.ts` (a file need not exist) holds the boundary rules of its block at severity `error` and has inline configuration switched off (R16). For the four packages of R5 the globals computed for that path are exactly the allow list. Otherwise `pnpm lint:boundaries` exits non-zero and names the path.
- R16. In every path a boundary rule covers, inline configuration comments have no effect: `eslint-disable`, `eslint-disable-line`, `eslint-disable-next-line`, `/* eslint <rule>: off */` and `/* global <name> */`. Such a comment makes `pnpm lint` exit non-zero with a message that names the file and the line, and the violation it tried to hide is still reported. A boundary is changed only by editing `eslint.config.js`.
- R17. A file in `apps/server/src` outside `modules/` that imports a file inside a module, other than that module's `index.ts`, makes `pnpm lint` exit non-zero with an error that names the file and the boundary rule. So no shared file (for example the database client) can import a table definition and pass it on to another module.

## Design
### Layout
```
toki/
├─ eslint.config.js          one root config: ignores + base style + the three boundary blocks
├─ .prettierrc               empty object: Prettier defaults
├─ .prettierignore           build output, lock file, generated files, docs/, .github/, .claude/, CLAUDE.md
├─ package.json              scripts: lint, lint:boundaries, format, format:check
└─ tools/lint-fixtures/
   ├─ check.mjs              lints the fixtures and compares each reported line and rule id with the expected ones (R11); checks the config of the real paths (R15)
   ├─ client-core/           violates.ts (one line per banned item), allowed.ts, disabled.ts (a violation under a disable comment)
   ├─ server-modules/        module-a/, module-b/ with violates.ts, allowed.ts, a same-module deep import and a nested index.ts; outside.ts (a file outside the modules)
   └─ ui-web/                violates.tsx (one line per banned item), allowed.tsx
```
- Assumption: the script names (`lint`, `lint:boundaries`, `format`, `format:check`) and the paths above are proposals; the Blueprint names none. TOKI-007 calls `lint`, `lint:boundaries` and `format:check` in its lint check (decision of 2026-11-12).
- Assumption: Prettier does not format the documents written by the cl workflow (`docs/`, `.github/`, `.claude/`, `CLAUDE.md`), so R2 can exit 0 without reformatting them.
- Assumption: one root ESLint config, not one per package, so all three rules live in one reviewed file.
- ESLint and Prettier are the stable releases in use when this work is built, each pinned to an exact version in the root `devDependencies`. The style preset is the recommended set of ESLint and of `typescript-eslint`, plus `eslint-config-prettier` so that no lint rule fights the formatter (R4). Prettier runs with its defaults; `.prettierrc` holds an empty object. See concern 7.
- Rule 1 (`client-core`): a block scoped to the source files (`src/**`, test files excepted) of `packages/client-core`, `packages/shared`, `packages/i18n` and `packages/tokens` declares an allow list of globals and reports every other global as an error, so a browser global that nobody thought to list still fails. The allow list is: the language built-ins, `console`, the timers (`setTimeout`, `clearTimeout`, `setInterval`, `clearInterval`), `queueMicrotask`, `fetch`, `Headers`, `Request`, `Response`, `WebSocket`, `URL`, `URLSearchParams`, `AbortController` and `AbortSignal`. A global is added only by editing this list. The block switches the undefined-global check (`no-undef`) on explicitly, because the recommended `typescript-eslint` preset switches it off for TypeScript files. Access through `window`, `globalThis` or `self`, and destructuring of them, is reported the same way. The DOM type names in R5 are banned by name; other DOM types rely on review (concern 12). The block also bans the imports in R6. Configuration files at the package root and test files are outside the block, so they may use Node or test globals. `packages/platform` is not covered, see concerns 9 and 10.
- Rule 2 (server modules): a block scoped to `apps/server/src/modules/<name>/**` bans any import that crosses into another module other than through that module's `index.ts`. "Never each other's tables" is met the same way: a table definition lives inside its module folder (the first one is `modules/workspace/`, TOKI-005) and is not exported from `index.ts`. The rule uses a mechanism that works on resolved file paths (for example `eslint-plugin-boundaries`), because the core `no-restricted-imports` rule matches the import text only; the plugin is the builder's choice and the fixture cases of R7 and R8 prove it. A second block covers the rest of `apps/server/src`: a file outside `modules/` may import a module only through its `index.ts` (R17). The database client is therefore built without importing the table definitions; each module imports its own tables (concern 11). See concerns 1 and 2.
- Rule 3 (`ui-web`): a block scoped to the source files (`src/**`, test files excepted) of `packages/ui-web` bans direct use of `Notification`, `localStorage`, `sessionStorage`, `indexedDB`, `navigator.serviceWorker`, `Audio`, `AudioContext`, `document.cookie` and `caches` (the Cache API), as bare names, through `window`, `globalThis` or `self`, and by destructuring those objects, and bans the `<audio>` element in JSX. Reaching an API through a renamed copy of `window` (`const w = window; w.localStorage`) is not caught and relies on review (concern 12). The rule applies to `packages/ui-web` only, not to `apps/web` (concern 5).
- Fixtures are linted with the same config through a path override that maps each fixture folder to the block it tests, so the fixture tests the real rule, not a copy. The override does not prove that the real globs match the real packages; R15 checks that separately.
- Inline configuration is switched off (`linterOptions.noInlineConfig`) in every boundary block, so no comment in a file can switch a rule off or declare an extra global (R16). ESLint reports each such comment as a warning, and `pnpm lint` fails on any warning (R13).

### Errors
- Boundary violation -> ESLint error naming the file, the line and the rule; `pnpm lint` exits non-zero.
- Badly formatted file -> `pnpm format:check` lists the file and exits non-zero.
- A marked line of a fixture is not reported by its expected rule, or a fixture has an unexpected report -> `pnpm lint:boundaries` exits non-zero and names the fixture and the line.
- A real path no longer holds a boundary rule at `error` -> `pnpm lint:boundaries` exits non-zero and names the path (R15).
- An inline configuration comment in a path a boundary rule covers -> a message naming the file and the line; the comment has no effect and `pnpm lint` exits non-zero (R16).

## Testing
- The fixtures are the tests. Write each fixture first, see `pnpm lint:boundaries` fail, then add the rule and see it pass.
- Check each rule by hand once: switch the rule off, confirm `pnpm lint:boundaries` exits non-zero, switch it back on.
- Run `pnpm lint` and `pnpm format:check` on the clean repository and confirm both exit 0.
- R2 and R3 are checked once by hand: add a badly formatted file under `packages/shared/src/`, confirm `pnpm format:check` exits non-zero and names it, run `pnpm format`, confirm `pnpm format:check` exits 0.
- R4 is checked on the same file: run `pnpm lint` right after `pnpm format` and confirm it reports no formatting error. Then remove the file.
- R13 is checked once by hand: set one rule to `warn` on a temporary file that triggers it, confirm `pnpm lint` exits non-zero, then undo both.
- R14 is checked with `grep` for the file-picking comment in `eslint.config.js`.
- R15 is checked once by hand: narrow the `files` glob of one block so it misses its package, confirm `pnpm lint:boundaries` exits non-zero and names the path, then undo it.
- R16 and R17 are proven on every run by their fixture files (`disabled.ts`, `outside.ts`) and by R15; no separate hand check.
- After the single `pnpm format` pass over the existing files (R2), read the diff and confirm that it changes layout only.
- No runtime tests and no test data: this work adds configuration and one small check script (`tools/lint-fixtures/check.mjs`), because plain ESLint cannot assert that an expected violation was reported. Fixtures hold no real names, keys or addresses.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Belongs to Blueprint intent I01 repo-foundation, alongside TOKI-001 to TOKI-008 | This work delivers the part of that intent that says lint blocks a package-boundary violation |
| Milestone: M1, Foundation and design system | Planning fact; no design impact |
| Size: M, about one working session with Claude | The work is configuration, fixtures and one check script; no CI, no hooks, no runtime code |
| Needs: TOKI-001 | Lint runs on the packages and apps that already exist; this work creates no package |
| Needed by: TOKI-007 | Three root scripts with clear exit codes for CI to run: `pnpm lint`, `pnpm lint:boundaries` and `pnpm format:check` |
| Agreed scope: ESLint and Prettier, and all three boundary rules | ESLint and Prettier are set up (R1 to R4) and each of the three rules is a lint rule (R5 to R10) |
| `client-core` imports no DOM or browser API | Using a browser global or importing a DOM-only package there is a lint error (R5, R6) |
| Server modules do not import each other's internals | Importing a file of another module, other than its `index.ts`, is a lint error (R7, R8) |
| `ui-web` does not call platform APIs directly (notifications, storage, service worker, audio) and goes through `platform` | Direct use of those APIs is a lint error; going through `platform` passes (R9, R10) |
| File picking cannot be caught by lint and relies on review | Stated as a comment in the ESLint configuration (R14); there is no lint check |
| Three boundary rules are fixed and enforced by lint | Every violation is an error, the fixtures prove each rule on every run, and no comment in a file can switch a rule off (R11, R13, R15, R16) |
| Server modules call each other only through public interfaces, never each other's tables | Table definitions stay inside their module and no file outside a module may import them (R7, R17); raw SQL relies on review |
| `client-core` touches no DOM or browser API, so React Native can reuse it | The same two checks also cover the packages that `client-core` imports: `shared`, `i18n` and `tokens` (R5, R6). `platform` is handled when its web implementation is created |
| Components reach platform features only through `platform`; lint bans direct use of the notification, storage, service worker and audio APIs in `ui-web` | Same as the `ui-web` row above (R9, R10) |
| Phase 1 acceptance criterion: `client-core` imports nothing from the browser | The `client-core` checks (R5, R6), proven on every run by the fixtures (R11, R15) |
| M1 exit check includes "CI is green" | The three scripts exit 0 on a clean repository, so this work gives CI nothing to fail on |

## Open questions from the intent
- The intent lists none ("None."). The questions below come from the Clarify step.
- Where do server modules live and what is a module's public entry file? Answered: `apps/server/src/modules/<name>/` with `index.ts`. See concern 1.
- Does "never each other's tables" need a check beyond the import rule? Answered: no further check; table definitions stay inside their module and raw SQL relies on review. See concern 2.
- Which globals count as "browser API" in `client-core` when React Native also has them? Answered: every global outside the allow list in Design rule 1. See concern 3.
- Which exact APIs fall under "notifications, storage, service worker, audio" in `ui-web`? Answered: the list in Design rule 3. See concern 4.
- Does rule 3 also apply to `apps/web`? Answered: no, `packages/ui-web` only. See concern 5.
- Is file picking checked by lint? Answered: no, it relies on review (intent, Constraints; Blueprint, TOKI-002 scope).
- May a boundary rule be switched off inline? Answered: no, and lint checks it (R16). See concern 6.
- Which ESLint and Prettier versions, style preset and format settings? Answered: stable releases pinned exactly, the recommended presets, Prettier defaults. See concern 7.
- Where is a violation "blocked" before CI exists? Answered: the commands fail when run by hand until CI runs them. See concern 8.
- Review gap: what is the import path of the web implementation of `platform`? Answered: not fixed here; the ticket that creates it adds the ban. See concern 9.
- Review gap: does rule 1 cover the packages that `client-core` imports? Answered: yes for `shared`, `i18n` and `tokens`; `platform` is handled with its web implementation. See concern 10.
- Review gap: can a file outside the modules reach a module's tables? Answered: no, such a file may import a module only through its `index.ts` (R17). See concern 11.
- Review gap: which ways around the rules does lint not catch? Answered: DOM types outside the named list and a renamed copy of `window` in `ui-web`; both rely on review. See concern 12.

## Areas of concern
1. The Blueprint does not say where server modules live inside `apps/server` or what a module's public entry file is called, and TOKI-004 (the server skeleton) comes after this ticket. Decided: server modules live at `apps/server/src/modules/<name>/` and `index.ts` is the only public entry. TOKI-004 creates the `modules/` folder; TOKI-005 places the `workspaces` table in `modules/workspace/`. Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Owner: Thanh Truong.
2. "Never each other's tables" is only met by the import rule if every table definition stays inside its module. Decided: table definitions live inside their module folder, starting with `workspaces` in `modules/workspace/` (TOKI-005), so rule 2 covers them. Decided by Thanh Truong (lead, as product owner) on 2026-11-12. A raw SQL query against another module's table cannot be caught by lint. Decided: this is accepted; it relies on review. Decided by Thanh Truong (lead, as product owner) on 2026-11-16. Owner: Thanh Truong.
3. Some globals exist in both the browser and React Native (for example `fetch`, `WebSocket`, timers). `client-core` holds the API client and WebSocket sync, so banning them would block its purpose. Decided: rule 1 is an allow list, not a ban list; only the listed globals may be used in the covered packages and every other global is an error (Design rule 1). Decided by Thanh Truong (lead, as product owner) on 2026-11-13. Decided: the allow list is the language built-ins, `console`, the timers (`setTimeout`, `clearTimeout`, `setInterval`, `clearInterval`), `queueMicrotask`, `fetch`, `Headers`, `Request`, `Response`, `WebSocket`, `URL`, `URLSearchParams`, `AbortController` and `AbortSignal`; a global is added only by editing the list in `eslint.config.js`. Decided by Thanh Truong (lead, as product owner) on 2026-11-16. Owner: Thanh Truong.
4. The Blueprint names four API groups for `ui-web` but not the globals. Decided: rule 3 bans `Notification`, `localStorage`, `sessionStorage`, `indexedDB`, `navigator.serviceWorker`, `Audio`, `AudioContext`, `document.cookie` and `caches` (the Cache API), and the `<audio>` element in JSX (R9, Design rule 3). Decided by Thanh Truong (lead, as product owner) on 2026-11-16. Owner: Thanh Truong.
5. The Blueprint says "components" and names `ui-web` for rule 3. `apps/web` also holds React code and could call the same APIs directly. Decided: rule 3 applies to `packages/ui-web` only; `apps/web` wires the app together and direct use there relies on review. Decided by Thanh Truong (lead, as product owner) on 2026-11-16. Owner: Thanh Truong.
6. An inline `eslint-disable` comment can silence a boundary rule, and `/* global */` or `/* eslint <rule>: off */` comments can do the same. Decided: all inline configuration comments are without effect in the paths a boundary rule covers and are themselves a lint failure (R16); a boundary is changed only by editing `eslint.config.js`, which goes through review. Decided by Thanh Truong (lead, as product owner) on 2026-11-16. Owner: Thanh Truong.
7. The Blueprint gives no ESLint or Prettier version, no style preset and no format settings. Decided: both tools are the stable releases in use when this work is built, pinned to exact versions; the preset is the recommended set of ESLint and `typescript-eslint` with `eslint-config-prettier`; Prettier runs with its defaults (line width 80, double quotes, semicolons). Decided by Thanh Truong (lead, as product owner) on 2026-11-16. Owner: Thanh Truong.
8. Until CI runs these scripts, nothing runs lint automatically, so "blocked" means only "the command fails when run". The `platform` package is also empty for now, so R10 is proven by a fixture, not by real code. Decided: both are accepted for this work. Decided by Thanh Truong (lead, as product owner) on 2026-11-16. Owner: Thanh Truong.
9. The web implementation of `platform` does not exist until TOKI-018, so its import path is not known and R6 cannot ban it now without guessing. Decided: this ticket does not guess the path; TOKI-018 adds the ban to rule 1, with a fixture line, when it creates the web implementation. Until then there is nothing to import. Decided by Thanh Truong (lead, as product owner) on 2026-11-13. The path itself is accepted as unknown until then and is no longer a question for this work. Decided by Thanh Truong (lead, as product owner) on 2026-11-16. Owner: Thanh Truong.
10. `client-core` can load browser code through a workspace package it imports, even when no file in `client-core` uses a browser global. Decided: the allow list of rule 1 also covers `packages/shared`, `packages/i18n` and `packages/tokens` (R5, R15). Decided by Thanh Truong (lead, as product owner) on 2026-11-13. `packages/platform` will hold the web implementation, so it cannot be covered as a whole. Decided: this is accepted; which part of it `client-core` may import is settled together with concern 9. Decided by Thanh Truong (lead, as product owner) on 2026-11-16. Owner: Thanh Truong.
11. A file outside the modules (for example the database client) could import a module's table definitions and hand them to every module, which would get around rule 2. Decided: a file in `apps/server/src` outside `modules/` may import a module only through its `index.ts` (R17), so the database client is built without the table definitions and each module imports its own tables. Review fix of 2026-11-16. Owner: Thanh Truong.
12. Lint cannot catch every way around rules 1 and 3. Decided: rule 1 bans the DOM type names `Window`, `Document`, `Element`, `HTML*` and `SVG*`, and other DOM types rely on review; in `ui-web`, reaching a banned API through a renamed copy of `window` relies on review. Test files and package-root configuration files are outside rules 1 and 3. Review fix of 2026-11-16. Owner: Thanh Truong.
