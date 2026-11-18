# Lint, format and package boundary rules design

Date: 2026-11-12 · Status: draft for review
Intent: docs/intents/lint-format-boundary-rules.md (Thanh Truong)
Ticket: TOKI-002

## Goal
The builder (Thanh and Claude) needs one code style, one format and an automatic check of the three agreed boundaries in the Toki monorepo.
Today nothing checks them, so a boundary can break unnoticed, for example `client-core` could start to depend on the browser and React Native could not reuse it in phase 3.
This work supplies the "lint blocks a package-boundary violation" part of Blueprint intent I01, and the lint step that CI (TOKI-007) runs.

## Scope
- In: ESLint and Prettier configuration at the repository root; root scripts to lint, check format and fix format; the three boundary rules as ESLint rules; one formatting pass over the files that already exist; a short note on what lint cannot catch (file picking).
- Out (not now):
  - Creating the packages, apps and shared TypeScript config: TOKI-001.
  - Running lint in CI, type check, tests, build, bundle size: TOKI-007. Its lint check runs two scripts of this work: `pnpm lint` and `pnpm format:check` (decision of 2026-11-17, concern 13).
  - The server skeleton and the `apps/server/src/modules/` folder: TOKI-004. The first table, placed inside `apps/server/src/modules/workspace/`: TOKI-005. Later tickets add the other modules.
  - The `platform` interface and its web implementation: TOKI-018.
  - The test harness (Vitest, Playwright): TOKI-008.
  - Writing the boundary rules into `CLAUDE.md`, hooks and permissions: TOKI-095.
  - Rules for `apps/mobile`, `apps/desktop` and `ui-native`: added in their own phases.
  - A lint check for file picking: not possible by lint; it relies on review.
  - Git pre-commit hooks: the intent does not ask for them.
  - A permanent test that each boundary rule still fires (fixture files and a check script, `pnpm lint:boundaries`): not now, see concern 13. Each rule is shown to fire by hand once, when it is built (R11).

## Requirements
- R1. `pnpm lint` at the repository root runs ESLint over the whole repository (apps, packages, root configuration files and any later folder such as `e2e/` or `infra/`) and exits 0 on the clean repository left by TOKI-001. The ESLint configuration ignores build output (`dist/`, `build/`, `coverage/`) and generated files.
- R2. `pnpm format:check` at the root runs Prettier in check mode over every file that `.prettierignore` does not exclude and exits 0 on the clean repository; it exits non-zero and names the file when a covered file is badly formatted. `.prettierignore` excludes build output, the lock file, generated files, `docs/`, `.github/`, `.claude/` and `CLAUDE.md`. To reach exit 0, this work runs `pnpm format` once over the files that already exist (for example `package.json`, the `tsconfig.json` files, `README.md`) and commits the result.
- R3. `pnpm format` at the root rewrites badly formatted files, after which `pnpm format:check` exits 0.
- R4. ESLint and Prettier do not disagree: a file that `pnpm format` has just written produces no formatting error from `pnpm lint`.
- R5. A source file in `packages/client-core`, `packages/shared`, `packages/i18n`, `packages/tokens` or `packages/platform` outside `src/web/` (added by TOKI-018) that uses a global outside the allow list in Design (for example `window`, `document`, `localStorage`, `navigator`, `location`, `matchMedia`) makes `pnpm lint` exit non-zero with an error that names the file and the boundary rule. This holds for a bare name, for access through `window`, `globalThis` or `self` (for example `globalThis.document`), and for destructuring one of those objects. It also holds for a type reference to `Window`, `Document`, `Element` or a type whose name starts with `HTML` or `SVG` (for example `HTMLElement`). A source file is a file under the package's `src/` folder that is not a test file (`*.test.ts`, `*.test.tsx`).
- R6. A source file in one of the packages of R5 that imports `react-dom` or one of its subpaths (for example `react-dom/client`), `@toki/ui-web` or one of its subpaths, or a relative path that resolves into `packages/ui-web`, makes `pnpm lint` exit non-zero with an error that names the file and the boundary rule. It also holds for `@toki/platform/web`, its subpaths and a relative path that resolves into `packages/platform/src/web`, the web implementation of `platform` (added by TOKI-018, concern 9).
- R7. A file in one server module that imports a file inside another server module, other than that module's public entry file, makes `pnpm lint` exit non-zero with an error that names the file and the boundary rule. The rule decides on the resolved file path, not on the text of the import: an import inside the same module passes at any depth, and a nested `index.ts` of another module (for example `modules/b/db/index.ts`) is not its public entry and fails.
- R8. A file in one server module that imports another module's public entry file passes `pnpm lint`, in every import form that resolves to that file (`../b`, `../b/index`, `../b/index.js`).
- R9. A source file in `packages/ui-web` that uses the notification, storage, service worker or audio API directly (the globals listed in Design), or that renders an `<audio>` element in JSX, makes `pnpm lint` exit non-zero with an error that names the file and the boundary rule. This holds for a bare name, for access through `window`, `globalThis` or `self` (for example `window.localStorage`, `window.navigator.serviceWorker`), and for destructuring one of those objects (for example `const { localStorage } = window`). "Source file" has the meaning given in R5.
- R10. A file in `packages/ui-web` that reaches the same features by importing from `platform` passes `pnpm lint`.
- R11. Each boundary rule is shown to fire once, by hand, when it is built: a temporary violating line for each banned item or sub-rule (each banned global and each access form in R5 and R9, each import target in R6, each case in R7 and R17) makes `pnpm lint` exit non-zero with an error that names the boundary rule, and the pull request records the commands and results. No fixture file and no check script is kept (concern 13).
- R12. Dropped: it covered the fixture folders, which this work no longer has (concern 13). The number is kept so that other documents do not shift.
- R13. Every boundary violation is reported at severity `error`, never `warn`; `pnpm lint` also exits non-zero when any warning exists.
- R14. The ESLint configuration file carries a comment stating that file picking in `ui-web` is not checked by lint and relies on review.
- R15. The rules reach the real paths. Checked by hand once: the ESLint configuration computed (`eslint --print-config <path>`) for `packages/client-core/src/index.ts`, `packages/shared/src/index.ts`, `packages/i18n/src/index.ts`, `packages/tokens/src/index.ts`, `packages/ui-web/src/index.ts`, `apps/server/src/modules/example/index.ts` and `apps/server/src/app.ts` (a file need not exist) holds the boundary rules of its block at severity `error` and has inline configuration switched off (R16). For the packages of R5 the globals computed for that path are exactly the allow list. TOKI-018 adds `packages/platform/src/index.ts` to the paths and replaces this hand check for `platform` with the lint test `tools/lint-rules/platform-boundary.test.mjs`.
- R16. In every path a boundary rule covers, inline configuration comments have no effect: `eslint-disable`, `eslint-disable-line`, `eslint-disable-next-line`, `/* eslint <rule>: off */` and `/* global <name> */`. Such a comment makes `pnpm lint` exit non-zero with a message that names the file and the line, and the violation it tried to hide is still reported. A boundary is changed only by editing `eslint.config.js`.
- R17. A file in `apps/server/src` outside `modules/` that imports a file inside a module, other than that module's `index.ts`, makes `pnpm lint` exit non-zero with an error that names the file and the boundary rule. So no shared file (for example the database client) can import a table definition and pass it on to another module.

## Design
### Layout
```
toki/
├─ eslint.config.js          one root config: ignores + base style + the three boundary blocks
├─ .prettierrc               empty object: Prettier defaults
├─ .prettierignore           build output, lock file, generated files, docs/, .github/, .claude/, CLAUDE.md
└─ package.json              scripts: lint, format, format:check
```
- Assumption: the script names (`lint`, `format`, `format:check`) and the paths above are proposals; the Blueprint names none. TOKI-007 calls `lint` and `format:check` in its lint check (decision of 2026-11-17).
- Assumption: Prettier does not format the documents written by the cl workflow (`docs/`, `.github/`, `.claude/`, `CLAUDE.md`), so R2 can exit 0 without reformatting them.
- Assumption: one root ESLint config, not one per package, so all three rules live in one reviewed file.
- ESLint and Prettier are the stable releases in use when this work is built, each pinned to an exact version in the root `devDependencies`. The style preset is the recommended set of ESLint and of `typescript-eslint`, plus `eslint-config-prettier` so that no lint rule fights the formatter (R4). Prettier runs with its defaults; `.prettierrc` holds an empty object. See concern 7.
- Rule 1 (`client-core`): a block scoped to the source files (`src/**`, test files excepted) of `packages/client-core`, `packages/shared`, `packages/i18n` and `packages/tokens` declares an allow list of globals and reports every other global as an error, so a browser global that nobody thought to list still fails. The allow list is: the language built-ins, `console`, the timers (`setTimeout`, `clearTimeout`, `setInterval`, `clearInterval`), `queueMicrotask`, `fetch`, `Headers`, `Request`, `Response`, `WebSocket`, `URL`, `URLSearchParams`, `AbortController` and `AbortSignal`. A global is added only by editing this list. The block switches the undefined-global check (`no-undef`) on explicitly, because the recommended `typescript-eslint` preset switches it off for TypeScript files. Access through `window`, `globalThis` or `self`, and destructuring of them, is reported the same way. The DOM type names in R5 are banned by name; other DOM types rely on review (concern 12). The block also bans the imports in R6. Configuration files at the package root and test files are outside the block, so they may use Node or test globals. The source files of `packages/platform` outside `src/web/` are covered too, and the block bans `@toki/platform/web` (TOKI-018, concerns 9 and 10).
- Rule 2 (server modules): a block scoped to `apps/server/src/modules/<name>/**` bans any import that crosses into another module other than through that module's `index.ts`. "Never each other's tables" is met the same way: a table definition lives inside its module folder (the first one is `modules/workspace/`, TOKI-005) and is not exported from `index.ts`. The rule uses a mechanism that works on resolved file paths (for example `eslint-plugin-boundaries`), because the core `no-restricted-imports` rule matches the import text only; the plugin is the builder's choice and the by-hand checks of R7 and R8 show it. A second block covers the rest of `apps/server/src`: a file outside `modules/` may import a module only through its `index.ts` (R17). The database client is therefore built without importing the table definitions; each module imports its own tables (concern 11). See concerns 1 and 2.
- Rule 3 (`ui-web`): a block scoped to the source files (`src/**`, test files excepted) of `packages/ui-web` bans direct use of `Notification`, `localStorage`, `sessionStorage`, `indexedDB`, `navigator.serviceWorker`, `Audio`, `AudioContext`, `document.cookie` and `caches` (the Cache API), as bare names, through `window`, `globalThis` or `self`, and by destructuring those objects, and bans the `<audio>` element in JSX. Reaching an API through a renamed copy of `window` (`const w = window; w.localStorage`) is not caught and relies on review (concern 12). The rule applies to `packages/ui-web` only, not to `apps/web` (concern 5).
- Inline configuration is switched off (`linterOptions.noInlineConfig`) in every boundary block, so no comment in a file can switch a rule off or declare an extra global (R16). ESLint reports each such comment as a warning, and `pnpm lint` fails on any warning (R13).

### Errors
- Boundary violation -> ESLint error naming the file, the line and the rule; `pnpm lint` exits non-zero.
- Badly formatted file -> `pnpm format:check` lists the file and exits non-zero.
- An inline configuration comment in a path a boundary rule covers -> a message naming the file and the line; the comment has no effect and `pnpm lint` exits non-zero (R16).

## Testing
- Each rule is checked by hand when it is built (R11): write a violating line, see `pnpm lint` fail with the boundary message, then add the rule and see it pass; the temporary lines are removed afterwards.
- Check each rule once more by hand: switch the rule off, confirm the temporary violating line passes `pnpm lint`, switch it back on.
- Run `pnpm lint` and `pnpm format:check` on the clean repository and confirm both exit 0.
- R2 and R3 are checked once by hand: add a badly formatted file under `packages/shared/src/`, confirm `pnpm format:check` exits non-zero and names it, run `pnpm format`, confirm `pnpm format:check` exits 0.
- R4 is checked on the same file: run `pnpm lint` right after `pnpm format` and confirm it reports no formatting error. Then remove the file.
- R13 is checked once by hand: set one rule to `warn` on a temporary file that triggers it, confirm `pnpm lint` exits non-zero, then undo both.
- R14 is checked with `grep` for the file-picking comment in `eslint.config.js`.
- R15 is checked once by hand with `eslint --print-config` on the seven paths of R15, and once with a temporary violating line placed under a real `src/` path of each of the three blocks.
- R16 and R17 are checked once by hand: a temporary file with a violation under an `eslint-disable-next-line` comment reports both the violation and the comment; a temporary file in `apps/server/src` outside `modules/` that imports a module table file is reported.
- After the single `pnpm format` pass over the existing files (R2), read the diff and confirm that it changes layout only.
- No runtime tests, no test data and no check script: this work adds configuration only. What this leaves open is concern 13.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Belongs to Blueprint intent I01 repo-foundation, alongside TOKI-001 to TOKI-008 | This work delivers the part of that intent that says lint blocks a package-boundary violation |
| Milestone: M1, Foundation and design system | Planning fact; no design impact |
| Size: M, about one working session with Claude | The work is configuration only; no CI, no hooks, no runtime code |
| Needs: TOKI-001 | Lint runs on the packages and apps that already exist; this work creates no package |
| Needed by: TOKI-007 | Two root scripts with clear exit codes for CI to run: `pnpm lint` and `pnpm format:check` |
| Agreed scope: ESLint and Prettier, and all three boundary rules | ESLint and Prettier are set up (R1 to R4) and each of the three rules is a lint rule (R5 to R10) |
| `client-core` imports no DOM or browser API | Using a browser global or importing a DOM-only package there is a lint error (R5, R6) |
| Server modules do not import each other's internals | Importing a file of another module, other than its `index.ts`, is a lint error (R7, R8) |
| `ui-web` does not call platform APIs directly (notifications, storage, service worker, audio) and goes through `platform` | Direct use of those APIs is a lint error; going through `platform` passes (R9, R10) |
| File picking cannot be caught by lint and relies on review | Stated as a comment in the ESLint configuration (R14); there is no lint check |
| Three boundary rules are fixed and enforced by lint | Every violation is an error and no comment in a file can switch a rule off (R13, R16); each rule is shown to fire by hand once (R11, R15), and a later change to the configuration relies on review (concern 13) |
| Server modules call each other only through public interfaces, never each other's tables | Table definitions stay inside their module and no file outside a module may import them (R7, R17); raw SQL relies on review |
| `client-core` touches no DOM or browser API, so React Native can reuse it | The same two checks also cover the packages that `client-core` imports: `shared`, `i18n` and `tokens` (R5, R6). The source files of `packages/platform` outside `src/web/` are covered too, and the import of its web implementation is banned (TOKI-018) |
| Components reach platform features only through `platform`; lint bans direct use of the notification, storage, service worker and audio APIs in `ui-web` | Same as the `ui-web` row above (R9, R10) |
| Phase 1 acceptance criterion: `client-core` imports nothing from the browser | The `client-core` checks (R5, R6), shown by hand once (R11, R15) |
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
- Review gap: what is the import path of the web implementation of `platform`? Answered: `@toki/platform/web`; the ban is in rule 1 (TOKI-018). See concern 9.
- Review gap: does rule 1 cover the packages that `client-core` imports? Answered: yes for `shared`, `i18n` and `tokens`; for `platform` the files outside `src/web/` (TOKI-018). See concern 10.
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
8. Until CI runs these scripts, nothing runs lint automatically, so "blocked" means only "the command fails when run". The `platform` package is also empty for now, so R10 is shown by a temporary line, not by real code. Decided: both are accepted for this work. Decided by Thanh Truong (lead, as product owner) on 2026-11-16. Owner: Thanh Truong.
9. The web implementation of `platform` does not exist until TOKI-018, so its import path is not known and R6 cannot ban it now without guessing. Decided: this ticket does not guess the path; TOKI-018 adds the ban to rule 1, when it creates the web implementation. Until then there is nothing to import. Decided by Thanh Truong (lead, as product owner) on 2026-11-13. The path itself is accepted as unknown until then and is no longer a question for this work. Decided by Thanh Truong (lead, as product owner) on 2026-11-16. Owner: Thanh Truong.
10. `client-core` can load browser code through a workspace package it imports, even when no file in `client-core` uses a browser global. Decided: the allow list of rule 1 also covers `packages/shared`, `packages/i18n` and `packages/tokens` (R5, R15). Decided by Thanh Truong (lead, as product owner) on 2026-11-13. `packages/platform` holds the web implementation, so it cannot be covered as a whole. Decided: `client-core` may import `@toki/platform` only, and rule 1 covers the source files of `packages/platform` outside `src/web/` (TOKI-018, R24). Decided by Thanh Truong (lead, as product owner) on 2026-11-16. Owner: Thanh Truong.
11. A file outside the modules (for example the database client) could import a module's table definitions and hand them to every module, which would get around rule 2. Decided: a file in `apps/server/src` outside `modules/` may import a module only through its `index.ts` (R17), so the database client is built without the table definitions and each module imports its own tables. Review fix of 2026-11-16. Owner: Thanh Truong.
12. Lint cannot catch every way around rules 1 and 3. Decided: rule 1 bans the DOM type names `Window`, `Document`, `Element`, `HTML*` and `SVG*`, and other DOM types rely on review; in `ui-web`, reaching a banned API through a renamed copy of `window` relies on review. Test files and package-root configuration files are outside rules 1 and 3. Review fix of 2026-11-16. Owner: Thanh Truong.
13. Without a permanent test, a later edit of `eslint.config.js` can remove a boundary rule, or one banned item of it, and `pnpm lint` stays green because the repository holds no violating code. Decided: this is accepted; the configuration file is reviewed like code, and the rules were shown to fire by hand once (R11, R15). No fixture files and no check script (`pnpm lint:boundaries`) are built, and TOKI-007 runs `pnpm lint` and `pnpm format:check` only. If a boundary breaks unnoticed later, a test is added then (for example with the harness of TOKI-008). Decided by Thanh Truong (lead, as product owner) on 2026-11-17. Owner: Thanh Truong.
