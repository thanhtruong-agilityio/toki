# Lint, format and package boundary rules design

Date: 2026-11-12 · Status: draft for review
Intent: docs/intents/lint-format-boundary-rules.md (Thanh Truong)
Ticket: TOKI-002

## Goal
The builder (Thanh and Claude) needs one code style, one format and an automatic check of the three agreed boundaries in the Toki monorepo.
Today nothing checks them, so a boundary can break unnoticed, for example `client-core` could start to depend on the browser and React Native could not reuse it in phase 3.
This work supplies the "lint blocks a package-boundary violation" part of Blueprint intent I01, and the lint step that CI (TOKI-007) runs.

## Scope
- In: ESLint and Prettier configuration at the repository root; root scripts to lint, check format and fix format; the three boundary rules as ESLint rules; one fixture per rule that proves the rule fires; a small check script that runs the fixtures; a short note on what lint cannot catch (file picking).
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
- R2. `pnpm format:check` at the root runs Prettier in check mode over every file that `.prettierignore` does not exclude and exits 0 on the clean repository; it exits non-zero and names the file when a covered file is badly formatted. `.prettierignore` excludes build output, the lock file, generated files, `docs/`, `.github/`, `.claude/` and `CLAUDE.md`.
- R3. `pnpm format` at the root rewrites badly formatted files, after which `pnpm format:check` exits 0.
- R4. ESLint and Prettier do not disagree: a file that `pnpm format` has just written produces no formatting error from `pnpm lint`.
- R5. A file in `packages/client-core`, `packages/shared`, `packages/i18n` or `packages/tokens` that uses a global outside the allow list in Design (for example `window`, `document`, `localStorage`, `navigator`, `location`, `matchMedia`), as a bare name or through `window`, `globalThis` or `self` (for example `globalThis.document`), makes `pnpm lint` exit non-zero with an error that names the file and the boundary rule.
- R6. A file in `packages/client-core` that imports `react-dom` or one of its subpaths (for example `react-dom/client`), `@toki/ui-web` or one of its subpaths, or a relative path that resolves into `packages/ui-web`, makes `pnpm lint` exit non-zero with an error that names the file and the boundary rule. The ban on the web implementation of `platform` is added by TOKI-018, which creates it (concern 9).
- R7. A file in one server module that imports a file inside another server module, other than that module's public entry file, makes `pnpm lint` exit non-zero with an error that names the file and the boundary rule. The rule decides on the resolved file path, not on the text of the import: an import inside the same module passes at any depth, and a nested `index.ts` of another module (for example `modules/b/db/index.ts`) is not its public entry and fails.
- R8. A file in one server module that imports another module's public entry file passes `pnpm lint`, in every import form that resolves to that file (`../b`, `../b/index`, `../b/index.js`).
- R9. A file in `packages/ui-web` that uses the notification, storage, service worker or audio API directly (the globals listed in Design), as a bare name or through `window`, `globalThis` or `self` (for example `window.localStorage`, `window.navigator.serviceWorker`), makes `pnpm lint` exit non-zero with an error that names the file and the boundary rule.
- R10. A file in `packages/ui-web` that reaches the same features by importing from `platform` passes `pnpm lint`.
- R11. Each boundary rule has a fixture with a violating file and an allowed file. The violating file holds one violating line for each banned item or sub-rule (each banned global and each access form in R5 and R9, each import target in R6, each case in R7), and each line is marked with the rule id expected there. `pnpm lint:boundaries` runs the check script, which lints the fixtures and exits 0 only when every marked line is reported by its expected rule id, a violating file has no other report, and every allowed file has no report; it exits non-zero and names the fixture and the line when a boundary rule, or one banned item of it, is removed or switched off.
- R12. The fixtures are excluded from `pnpm lint`, so R1 holds while the fixtures exist.
- R13. Every boundary violation is reported at severity `error`, never `warn`; `pnpm lint` also exits non-zero when any warning exists.
- R14. The ESLint configuration file carries a comment stating that file picking in `ui-web` is not checked by lint and relies on review.
- R15. The check script also proves that the rules reach the real paths: the ESLint configuration computed for `packages/client-core/src/index.ts`, `packages/shared/src/index.ts`, `packages/i18n/src/index.ts`, `packages/tokens/src/index.ts`, `packages/ui-web/src/index.ts` and `apps/server/src/modules/example/index.ts` (the file need not exist) holds the boundary rules of its block at severity `error`. Otherwise `pnpm lint:boundaries` exits non-zero and names the path.

## Design
### Layout
```
toki/
├─ eslint.config.js          one root config: ignores + base style + the three boundary blocks
├─ .prettierrc               format settings
├─ .prettierignore           build output, lock file, generated files, docs/, .github/, .claude/, CLAUDE.md
├─ package.json              scripts: lint, lint:boundaries, format, format:check
└─ tools/lint-fixtures/
   ├─ check.mjs              lints the fixtures and compares each reported line and rule id with the expected ones (R11); checks the config of the real paths (R15)
   ├─ client-core/           violates.ts (one line per banned item), allowed.ts
   ├─ server-modules/        module-a/, module-b/ with violates.ts, allowed.ts, a same-module deep import and a nested index.ts
   └─ ui-web/                violates.tsx (one line per banned item), allowed.tsx
```
- Assumption: the script names (`lint`, `lint:boundaries`, `format`, `format:check`) and the paths above are proposals; the Blueprint names none. TOKI-007 calls `lint`, `lint:boundaries` and `format:check` in its lint check (decision of 2026-11-12).
- Assumption: Prettier does not format the documents written by the cl workflow (`docs/`, `.github/`, `.claude/`, `CLAUDE.md`), so R2 can exit 0 without reformatting them.
- Assumption: one root ESLint config, not one per package, so all three rules live in one reviewed file.
- Rule 1 (`client-core`): a block scoped to `packages/client-core/**`, `packages/shared/**`, `packages/i18n/**` and `packages/tokens/**` declares an allow list of globals (the language built-ins and the globals that Node and React Native share, for example `fetch`, `WebSocket`, timers, `console`, `URL`, `AbortController`) and reports every other global as an error, so a browser global that nobody thought to list still fails. Access through `window`, `globalThis` or `self` is reported the same way. For `packages/client-core/**` the block also bans the imports in R6. The exact allow list is concern 3; `packages/platform` is not covered, see concerns 9 and 10.
- Rule 2 (server modules): a block scoped to `apps/server/src/modules/<name>/**` bans any import that crosses into another module other than through that module's `index.ts`. "Never each other's tables" is met the same way: a table definition lives inside its module folder (the first one is `modules/workspace/`, TOKI-005) and is not exported from `index.ts`. The rule uses a mechanism that works on resolved file paths (for example `eslint-plugin-boundaries`), because the core `no-restricted-imports` rule matches the import text only; the plugin is the builder's choice and the fixture cases of R7 and R8 prove it. See concerns 1 and 2.
- Rule 3 (`ui-web`): a block scoped to `packages/ui-web/**` bans direct use of `Notification`, `localStorage`, `sessionStorage`, `indexedDB`, `navigator.serviceWorker`, `Audio` and `AudioContext`, as bare names and through `window`, `globalThis` or `self`. See concern 4 for the exact list.
- Fixtures are linted with the same config through a path override that maps each fixture folder to the block it tests, so the fixture tests the real rule, not a copy. The override does not prove that the real globs match the real packages; R15 checks that separately.

### Errors
- Boundary violation -> ESLint error naming the file, the line and the rule; `pnpm lint` exits non-zero.
- Badly formatted file -> `pnpm format:check` lists the file and exits non-zero.
- A marked line of a fixture is not reported by its expected rule, or a fixture has an unexpected report -> `pnpm lint:boundaries` exits non-zero and names the fixture and the line.
- A real path no longer holds a boundary rule at `error` -> `pnpm lint:boundaries` exits non-zero and names the path (R15).
- An inline `eslint-disable` for a boundary rule is not blocked by tooling; it relies on review (concern 6).

## Testing
- The fixtures are the tests. Write each fixture first, see `pnpm lint:boundaries` fail, then add the rule and see it pass.
- Check each rule by hand once: switch the rule off, confirm `pnpm lint:boundaries` exits non-zero, switch it back on.
- Run `pnpm lint` and `pnpm format:check` on the clean repository and confirm both exit 0.
- R2 and R3 are checked once by hand: add a badly formatted file under `packages/shared/src/`, confirm `pnpm format:check` exits non-zero and names it, run `pnpm format`, confirm `pnpm format:check` exits 0.
- R4 is checked on the same file: run `pnpm lint` right after `pnpm format` and confirm it reports no formatting error. Then remove the file.
- R13 is checked once by hand: set one rule to `warn` on a temporary file that triggers it, confirm `pnpm lint` exits non-zero, then undo both.
- R14 is checked with `grep` for the file-picking comment in `eslint.config.js`.
- R15 is checked once by hand: narrow the `files` glob of one block so it misses its package, confirm `pnpm lint:boundaries` exits non-zero and names the path, then undo it.
- No runtime tests and no test data: this work adds configuration and one small check script (`tools/lint-fixtures/check.mjs`), because plain ESLint cannot assert that an expected violation was reported. Fixtures hold no real names, keys or addresses.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Belongs to Blueprint intent I01 repo-foundation, alongside TOKI-001 to TOKI-008 | Scope: neighbouring tickets are listed under Out; R5 to R11 supply I01's "lint blocks a package-boundary violation" |
| Milestone: M1, Foundation and design system | Planning fact; no design impact |
| Size: M, about one working session with Claude | Scope: configuration, fixtures and one check script; no CI, no hooks, no runtime code |
| Needs: TOKI-001 | R1 runs on the packages and apps TOKI-001 creates; nothing here creates a package |
| Needed by: TOKI-007 | R1, R2 and R11 give CI three root scripts with clear exit codes; TOKI-007 runs all three (decision of 2026-11-12) |
| Agreed scope: ESLint and Prettier, and all three boundary rules | R1 to R4 (ESLint and Prettier); R5 to R10 (the three rules) |
| `client-core` imports no DOM or browser API | R5, R6 |
| Server modules do not import each other's internals | R7, R8 |
| `ui-web` does not call platform APIs directly (notifications, storage, service worker, audio) and goes through `platform` | R9, R10 |
| File picking cannot be caught by lint and relies on review | R14; Scope Out |
| Three boundary rules are fixed and enforced by lint | R5 to R13 and R15; R15 proves that each real path holds its rules at `error` |
| Server modules call each other only through public interfaces, never each other's tables | R7, R8; Design rule 2; depends on concerns 1 and 2 |
| `client-core` touches no DOM or browser API, so React Native can reuse it | R5, R6; R5 also covers `shared`, `i18n` and `tokens`, which `client-core` may import; depends on concerns 3, 9 and 10 |
| Components reach platform features only through `platform`; lint bans direct use of the notification, storage, service worker and audio APIs in `ui-web` | R9, R10; depends on concern 4 |
| Phase 1 acceptance criterion: `client-core` imports nothing from the browser | R5, R6, checked on every run by R11 and R15 |
| M1 exit check includes "CI is green" | R1, R2 and R11 exit 0 on a clean repository; CI itself is TOKI-007 |

## Open questions from the intent
- The intent lists none ("None."). The questions below come from the Clarify step.
- Where do server modules live and what is a module's public entry file? Answered: `apps/server/src/modules/<name>/` with `index.ts`. See concern 1.
- Does "never each other's tables" need a check beyond the import rule? Answered in part. Carried forward as concern 2.
- Which globals count as "browser API" in `client-core` when React Native also has them? Answered in part: rule 1 is an allow list, so every global that is not listed is an error; the exact list is not decided. Carried forward as concern 3.
- Which exact APIs fall under "notifications, storage, service worker, audio" in `ui-web`? Partly answered: the four groups are named (Blueprint, TOKI-002 scope and technical design rule 3); the exact globals are not. Carried forward as concern 4.
- Does rule 3 also apply to `apps/web`? Not answered. Carried forward as concern 5.
- Is file picking checked by lint? Answered: no, it relies on review (intent, Constraints; Blueprint, TOKI-002 scope).
- May a boundary rule be switched off inline? Not answered. Carried forward as concern 6.
- Which ESLint and Prettier versions, style preset and format settings? Not answered. Carried forward as concern 7.
- Where is a violation "blocked" before CI exists? Not answered. Carried forward as concern 8.
- Review gap: what is the import path of the web implementation of `platform`? Not answered; TOKI-018 settles it. Carried forward as concern 9.
- Review gap: does rule 1 cover the packages that `client-core` imports? Answered in part: yes for `shared`, `i18n` and `tokens`; not for `platform`. See concern 10.

## Areas of concern
1. The Blueprint does not say where server modules live inside `apps/server` or what a module's public entry file is called, and TOKI-004 (the server skeleton) comes after this ticket. Decided: server modules live at `apps/server/src/modules/<name>/` and `index.ts` is the only public entry. TOKI-004 creates the `modules/` folder; TOKI-005 places the `workspaces` table in `modules/workspace/`. Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Owner: Thanh Truong.
2. "Never each other's tables" is only met by the import rule if every table definition stays inside its module. Answered in part: table definitions live inside their module folder, starting with `workspaces` in `modules/workspace/` (TOKI-005), so rule 2 covers them. Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Still open: a raw SQL query against another module's table cannot be caught by lint and relies on review. Owner: Thanh Truong.
3. Some globals exist in both the browser and React Native (for example `fetch`, `WebSocket`, timers). `client-core` holds the API client and WebSocket sync, so banning them would block its purpose. Decided: rule 1 is an allow list, not a ban list; only the listed globals may be used in the covered packages and every other global is an error (Design rule 1). Decided by Thanh Truong (lead, as product owner) on 2026-11-13. Still open: the exact allow list. Owner: Thanh Truong.
4. The Blueprint names four API groups for `ui-web` but not the globals. The list in Design (including `sessionStorage`, `indexedDB`, `AudioContext`) is a proposal. Cookies, the Cache API and `<audio>` elements in JSX are not decided. Owner: Thanh Truong.
5. The Blueprint says "components" and names `ui-web` for rule 3. `apps/web` also holds React code and could call the same APIs directly. It is not stated whether the ban extends to `apps/web`; this spec applies it to `ui-web` only. Owner: Thanh Truong.
6. An inline `eslint-disable` comment can silence a boundary rule. The intent says violating code "is blocked" but does not say whether such comments are forbidden or allowed with a reason. This spec leaves it to review. Owner: Thanh Truong.
7. The Blueprint gives no ESLint or Prettier version, no style preset and no format settings (line width, quotes, semicolons). The builder chooses these during the build; changing them later reformats every file. Owner: Thanh Truong.
8. Until TOKI-007 lands, nothing runs lint automatically, so "blocked" means only "the command fails when run". The `platform` package is also empty until TOKI-018, so R10 is proven by a fixture, not by real code. Owner: Thanh Truong.
9. The web implementation of `platform` does not exist until TOKI-018, so its import path is not known and R6 cannot ban it now without guessing. Decided: this ticket does not guess the path; TOKI-018 adds the ban to rule 1, with a fixture line, when it creates the web implementation. Until then there is nothing to import. Decided by Thanh Truong (lead, as product owner) on 2026-11-13. Still open: the path itself. Owner: Thanh Truong.
10. `client-core` can load browser code through a workspace package it imports, even when no file in `client-core` uses a browser global. Decided: the allow list of rule 1 also covers `packages/shared`, `packages/i18n` and `packages/tokens` (R5, R15). Decided by Thanh Truong (lead, as product owner) on 2026-11-13. Still open: `packages/platform` will hold the web implementation, so it cannot be covered as a whole; which part of it `client-core` may import is settled with TOKI-018 (concern 9). Owner: Thanh Truong.
