# Lint, format and package boundary rules design

Date: 2026-11-12 · Status: draft for review
Intent: docs/intents/lint-format-boundary-rules.md (Thanh Truong)
Ticket: TOKI-002

## Goal
The builder (Thanh and Claude) needs one code style, one format and an automatic check of the three agreed boundaries in the Toki monorepo.
Today nothing checks them, so a boundary can break unnoticed, for example `client-core` could start to depend on the browser and React Native could not reuse it in phase 3.
This work supplies the "lint blocks a package-boundary violation" part of Blueprint intent I01, and the lint step that CI (TOKI-007) runs.

## Scope
- In: ESLint and Prettier configuration at the repository root; root scripts to lint, check format and fix format; the three boundary rules as ESLint rules; one fixture per rule that proves the rule fires; a short note on what lint cannot catch (file picking).
- Out (not now):
  - Creating the packages, apps and shared TypeScript config: TOKI-001.
  - Running lint in CI, type check, tests, build, bundle size: TOKI-007.
  - The server skeleton and its real modules: TOKI-004. The first table: TOKI-005.
  - The `platform` interface and its web implementation: TOKI-018.
  - The test harness (Vitest, Playwright): TOKI-008.
  - Writing the boundary rules into `CLAUDE.md`, hooks and permissions: TOKI-095.
  - Rules for `apps/mobile`, `apps/desktop` and `ui-native`: added in their own phases.
  - A lint check for file picking: not possible by lint; it relies on review.
  - Git pre-commit hooks: the intent does not ask for them.

## Requirements
- R1. `pnpm lint` at the repository root runs ESLint over every app and package and exits 0 on the clean repository left by TOKI-001.
- R2. `pnpm format:check` at the root runs Prettier in check mode over the repository and exits 0 on the clean repository; it exits non-zero and names the file when a file is badly formatted.
- R3. `pnpm format` at the root rewrites badly formatted files, after which `pnpm format:check` exits 0.
- R4. ESLint and Prettier do not disagree: a file that `pnpm format` has just written produces no formatting error from `pnpm lint`.
- R5. A file in `packages/client-core` that uses a DOM or browser global (for example `window`, `document`, `localStorage`, `navigator`) makes `pnpm lint` exit non-zero with an error that names the file and the boundary rule.
- R6. A file in `packages/client-core` that imports `react-dom`, `packages/ui-web` or the web implementation of `platform` makes `pnpm lint` exit non-zero with an error that names the file and the boundary rule.
- R7. A file in one server module that imports a file inside another server module, other than that module's public entry file, makes `pnpm lint` exit non-zero with an error that names the file and the boundary rule.
- R8. A file in one server module that imports another module's public entry file passes `pnpm lint`.
- R9. A file in `packages/ui-web` that uses the notification, storage, service worker or audio API directly (the globals listed in Design) makes `pnpm lint` exit non-zero with an error that names the file and the boundary rule.
- R10. A file in `packages/ui-web` that reaches the same features by importing from `platform` passes `pnpm lint`.
- R11. Each boundary rule has a fixture with one violating file and one allowed file. `pnpm lint:boundaries` lints the fixtures and exits 0 only when every violating file is reported and every allowed file is clean; it exits non-zero when a boundary rule is removed or switched off.
- R12. The fixtures are excluded from `pnpm lint`, so R1 holds while the fixtures exist.
- R13. Every boundary violation is reported at severity `error`, never `warn`; `pnpm lint` also exits non-zero when any warning exists.
- R14. The ESLint configuration file carries a comment stating that file picking in `ui-web` is not checked by lint and relies on review.

## Design
### Layout
```
toki/
├─ eslint.config.js          one root config: base style + the three boundary blocks
├─ .prettierrc               format settings
├─ .prettierignore           build output, lock file, generated files
├─ package.json              scripts: lint, lint:boundaries, format, format:check
└─ tools/lint-fixtures/
   ├─ client-core/           violates.ts, allowed.ts
   ├─ server-modules/        module-a/, module-b/ with violates.ts, allowed.ts
   └─ ui-web/                violates.tsx, allowed.tsx
```
- Assumption: the script names (`lint`, `lint:boundaries`, `format`, `format:check`) and the paths above are proposals; the Blueprint names none. TOKI-007 calls these scripts.
- Assumption: one root ESLint config, not one per package, so all three rules live in one reviewed file.
- Rule 1 (`client-core`): a block scoped to `packages/client-core/**` bans browser globals and bans imports of DOM-only packages. Node and React Native shared globals stay allowed. See concern 3 for globals that exist on both.
- Rule 2 (server modules): a block scoped to the server module folders bans any import that crosses into another module below its public entry file. "Never each other's tables" is met the same way: a table definition lives inside its module and is not exported from the entry file. See concerns 1 and 2.
- Rule 3 (`ui-web`): a block scoped to `packages/ui-web/**` bans direct use of `Notification`, `localStorage`, `sessionStorage`, `indexedDB`, `navigator.serviceWorker`, `Audio` and `AudioContext`. See concern 4 for the exact list.
- Fixtures are linted with the same config through a path override that maps each fixture folder to the block it tests, so the fixture tests the real rule, not a copy.

### Errors
- Boundary violation -> ESLint error naming the file, the line and the rule; `pnpm lint` exits non-zero.
- Badly formatted file -> `pnpm format:check` lists the file and exits non-zero.
- A fixture's violating file is not reported -> `pnpm lint:boundaries` exits non-zero and names the fixture.
- An inline `eslint-disable` for a boundary rule is not blocked by tooling; it relies on review (concern 6).

## Testing
- The fixtures are the tests. Write each fixture first, see `pnpm lint:boundaries` fail, then add the rule and see it pass.
- Check each rule by hand once: switch the rule off, confirm `pnpm lint:boundaries` exits non-zero, switch it back on.
- Run `pnpm lint` and `pnpm format:check` on the clean repository and confirm both exit 0.
- No runtime tests and no test data: this work adds configuration only. Fixtures hold no real names, keys or addresses.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Belongs to Blueprint intent I01 repo-foundation, alongside TOKI-001 to TOKI-008 | Scope: neighbouring tickets are listed under Out; R5 to R11 supply I01's "lint blocks a package-boundary violation" |
| Milestone: M1, Foundation and design system | Planning fact; no design impact |
| Size: M, about one working session with Claude | Scope: configuration and fixtures only; no CI, no hooks, no runtime code |
| Needs: TOKI-001 | R1 runs on the packages and apps TOKI-001 creates; nothing here creates a package |
| Needed by: TOKI-007 | R1, R2 and R11 give CI three root scripts with clear exit codes |
| Agreed scope: ESLint and Prettier, and all three boundary rules | R1 to R4 (ESLint and Prettier); R5 to R10 (the three rules) |
| `client-core` imports no DOM or browser API | R5, R6 |
| Server modules do not import each other's internals | R7, R8 |
| `ui-web` does not call platform APIs directly (notifications, storage, service worker, audio) and goes through `platform` | R9, R10 |
| File picking cannot be caught by lint and relies on review | R14; Scope Out |
| Three boundary rules are fixed and enforced by lint | R5 to R13; the rules are not configurable per package |
| Server modules call each other only through public interfaces, never each other's tables | R7, R8; Design rule 2; depends on concerns 1 and 2 |
| `client-core` touches no DOM or browser API, so React Native can reuse it | R5, R6; depends on concern 3 |
| Components reach platform features only through `platform`; lint bans direct use of the notification, storage, service worker and audio APIs in `ui-web` | R9, R10; depends on concern 4 |
| Phase 1 acceptance criterion: `client-core` imports nothing from the browser | R5, R6, checked on every run by R11 |
| M1 exit check includes "CI is green" | R1, R2 and R11 exit 0 on a clean repository; CI itself is TOKI-007 |

## Open questions from the intent
- The intent lists none ("None."). The questions below come from the Clarify step.
- Where do server modules live and what is a module's public entry file? Not answered. Carried forward as concern 1.
- Does "never each other's tables" need a check beyond the import rule? Not answered. Carried forward as concern 2.
- Which globals count as "browser API" in `client-core` when React Native also has them? Not answered. Carried forward as concern 3.
- Which exact APIs fall under "notifications, storage, service worker, audio" in `ui-web`? Partly answered: the four groups are named (Blueprint, TOKI-002 scope and technical design rule 3); the exact globals are not. Carried forward as concern 4.
- Does rule 3 also apply to `apps/web`? Not answered. Carried forward as concern 5.
- Is file picking checked by lint? Answered: no, it relies on review (intent, Constraints; Blueprint, TOKI-002 scope).
- May a boundary rule be switched off inline? Not answered. Carried forward as concern 6.
- Which ESLint and Prettier versions, style preset and format settings? Not answered. Carried forward as concern 7.
- Where is a violation "blocked" before CI exists? Not answered. Carried forward as concern 8.

## Areas of concern
1. The Blueprint does not say where server modules live inside `apps/server` or what a module's public entry file is called, and TOKI-004 (the server skeleton) comes after this ticket. Assumption used here: `apps/server/src/modules/<name>/` with `index.ts` as the only public entry. If TOKI-004 chooses another layout, rule 2 must be re-scoped. Owner: Thanh Truong.
2. "Never each other's tables" is only met by the import rule if every table definition stays inside its module. A raw SQL query against another module's table cannot be caught by lint. No table exists until TOKI-005, so this cannot be proven now beyond the fixture. Owner: Thanh Truong.
3. Some globals exist in both the browser and React Native (for example `fetch`, `WebSocket`, timers). `client-core` holds the API client and WebSocket sync, so banning them would block its purpose. Assumption used here: only DOM and browser-only globals are banned. The exact allow list needs a decision. Owner: Thanh Truong.
4. The Blueprint names four API groups for `ui-web` but not the globals. The list in Design (including `sessionStorage`, `indexedDB`, `AudioContext`) is a proposal. Cookies, the Cache API and `<audio>` elements in JSX are not decided. Owner: Thanh Truong.
5. The Blueprint says "components" and names `ui-web` for rule 3. `apps/web` also holds React code and could call the same APIs directly. It is not stated whether the ban extends to `apps/web`; this spec applies it to `ui-web` only. Owner: Thanh Truong.
6. An inline `eslint-disable` comment can silence a boundary rule. The intent says violating code "is blocked" but does not say whether such comments are forbidden or allowed with a reason. This spec leaves it to review. Owner: Thanh Truong.
7. The Blueprint gives no ESLint or Prettier version, no style preset and no format settings (line width, quotes, semicolons). The builder chooses these during the build; changing them later reformats every file. Owner: Thanh Truong.
8. Until TOKI-007 lands, nothing runs lint automatically, so "blocked" means only "the command fails when run". The `platform` package is also empty until TOKI-018, so R10 is proven by a fixture, not by real code. Owner: Thanh Truong.
