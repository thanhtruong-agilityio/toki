# TOKI-017 The i18n package: plan

Ticket: TOKI-017 (issue 24). Branch: `feat/toki-017-i18n-package`. Tier: M.
Spec (the source of truth, with the decisions of 2026-11-18): `docs/specs/2026-11-16-i18n-package-design.md`.
Requirements are named `R1` to `R24`, concerns `1` to `8`, as in the spec; this plan does not copy them, the tests type their values in from the spec.

## Design

The spec is the design (Public API, Catalogs, Key naming rule, The check and CI, Layout). This plan adds only what the repository and the order of work change.

- TOKI-001, TOKI-002, TOKI-007 and TOKI-008 are on `main`: `ci.yml` exists, so R20 is built in this ticket; `pnpm lint` has the rules of TOKI-002, so R22 is fully checked; the root `vitest.config.ts` lists `packages/*` as projects, so the tests of this package also run in root `pnpm test` (R23).
- Concern 4 (needs): this plan records that TOKI-017 needs TOKI-007 (R20) and TOKI-002 (R22). Adding TOKI-017 to the needs of the other tickets is done in those tickets, not here.
- Exact pins come from the repository (R23, Layout): `vitest` 5.1.0, `tsx` 4.23.15, `@types/node` 22.20.5, `react` and `react-dom` 19.3.1, `@types/react` 19.3.0, `@types/react-dom` 19.3.0 (same versions as `packages/tokens` and `packages/ui-web`). `pnpm-lock.yaml` changes with them.
- `ci.yml` today holds six jobs (lint, type check, tests, end-to-end, build, bundle size). The `i18n` job is the seventh; the header comment of the file that says "Six independent checks" changes to seven.
- The Vitest environment of `packages/i18n` is `node` (default). R10 and R11 render with `react-dom/server`, so no DOM is needed.

Build order (each step ends green, in this order):
1. languages (R1 to R3) 2. internal lookup, `translate`, `createTranslator`, plurals (R4 to R9, R24 `format.ts`) 3. catalogs and `MessageKey` (R8, R13, R15) 4. the check and its script, root script (R14, R16 to R19) 5. React provider and hook (R10, R11, R21) 6. boundary tests and `package.json` / `tsconfig.json` (R12, R21 to R23) 7. CI job (R20) 8. a short naming-rule note in the package (see "Docs").

## AC to step to test

AC-121 (new account in English, change applies at once) and D-064 (CI fails on a missing text) are the acceptance criteria this ticket serves; the rows follow the requirements of the spec.

| Requirement | Step | Test (written first, seen to fail) |
| :---- | :---- | :---- |
| R1 to R3 | 1 | `languages.test.ts`: values; the six inputs of R2 |
| R4, R15 | 3 | `translate.test.ts`: copy of the "First texts" table, both languages |
| R5 to R7, R9 | 2 | `translate.test.ts` with small test catalogs: examples of R5 and R6, missing and extra parameter, `count` 0, 1, 2, 1.5 in both languages, missing and string `count`, missing key in one and in both languages, `toString` and `constructor`; same cases through `createTranslator`; identity of `createTranslator('en')`; `// @ts-expect-error` on `count: '1'` |
| R8 | 3 | `types.test.ts`: `// @ts-expect-error` on `translate('en', 'nav.nope')` and on a wrong `Record<…, MessageKey>` entry; `pnpm typecheck` |
| R10, R11 | 5 | `react.test.tsx` (or `.ts` with `createElement`): `renderToString` under `vi`, no property, no provider; then `en` and `vi` in turn |
| R12, R21, R22 | 6 | `boundary.test.ts`: allow-list over `src` without comments (`Intl` only in `format.ts`, explicit first argument; no `toLocale*String`, no `navigator`; `react` imported only by `react.ts`), `package.json` exports, `peerDependencies`, no `dependencies`; `pnpm lint` |
| R24 | 2 | `format.test.ts`: 1204, 1234567.5, `vi` against `Intl.NumberFormat('vi')`, no throw for 0, negative, 1.5, `Intl.NumberFormat` stubbed to undefined and to throw, default locale changed in the process |
| R13, R14, R17, R18 | 4 | `check.test.ts`: one test catalog per kind (a) to (f), exactly one problem each; three problems at once; equal wording is fine; English-only namespace reports every key; plural placeholder union cases; an unlisted file in a `messages/<language>` folder (the function that lists files gets a fake file list) |
| R16, R19 | 4 | by hand once and by CI: `pnpm --filter @toki/i18n check` and `pnpm i18n:check`, output and exit code; delete `home` from `messages/vi/nav.ts`, see exit 1 and `vi nav.home: missing`, undo |
| R20 | 7 | by hand on GitHub: a throwaway pull request that removes one Vietnamese text must show the `i18n` job red; the real PR shows it green |
| R23 | 6 | `pnpm --filter @toki/i18n test`, root `pnpm test`, root `pnpm typecheck` exit 0 |

## Steps

1. `package.json`: add `exports["./react"]`, `peerDependencies.react`, scripts `check` (`tsx scripts/check.ts`) and `test` (`vitest run`), the pinned devDependencies; `tsconfig.json`: `include` `src` and `scripts`, `types` `["node"]`; run `pnpm install`.
2. Tests first, then `languages.ts`, then `translate.ts` (internal lookup taking catalogs; own-property lookup; plural rules; `createTranslator` cache per language), then `format.ts`.
3. `messages/en|vi/nav.ts` and `index.ts` (static imports); `MessageKey` derived from the English catalog.
4. `check.ts` (pure function) and `scripts/check.ts` (lists files, prints, sets the exit code); root `i18n:check`.
5. `react.ts` with `createElement`; `useMemo` on `language`.
6. Boundary test; run lint, typecheck, test.
7. `ci.yml`: job `i18n` (`name: i18n`) that runs `pnpm i18n:check` only; header comment says seven checks.
8. Naming rule: a `packages/i18n/README.md` that holds the key naming rule and "how to add the texts of a new screen" in the words of the spec, so the builder needs no help (intent outcome 4). No other docs file changes.

## What can break, and the riskiest step

- Riskiest step: 2, the typing of `MessageKey` and `params` together with the internal lookup that takes test catalogs. If `translate` is typed on the real catalogs, the unit tests cannot pass a test catalog; the internal function is generic over the catalog and `translate` fixes it to the real ones. The `ts-expect-error` tests keep this honest.
- TypeScript 7 native and TypeScript 6 are both in the repository (`typescript` and `@typescript/native`): `pnpm typecheck` runs the one the root script names; run it early in step 3, not at the end.
- `tsx` is only for `scripts/check.ts`; the pure check lives in `src/check.ts` and uses no Node API (R22), so the unit tests do not depend on `tsx`.
- Root ESLint rules of TOKI-002 (boundary rules for `packages/i18n`, `react-dom` ban) may reject `react-dom/server` in a test file. The spec says test files are outside the boundary rule; if lint still rejects it, the fix is in the lint config scope for test files, not in the test.
- `Intl` allow-list test (R12) strips comments with a regex; a string that contains `//` could fool it. The files are small and reviewed; the test strips block and line comments before searching and the catalogs contain no `Intl`.
- R20: `ci.yml` is edited by other tickets; a merge conflict on `jobs:` is possible. Keep the new job last.
- The 200 KB limit of the web app is not touched: no library, 13 short texts, the web app does not import the package yet.
- Roll back: delete the package contents added here and the `i18n` job; nothing else imports the package.

## Grilling (M, one round)

Questions asked of the plan, with the answers that changed it:

1. Does anything outside this ticket import `@toki/i18n` today? No (the package exports nothing), so the change cannot break a consumer.
2. Is `formatNumber('vi', …)` right? The spec says only that the code `'vi'` is passed; the test compares with `Intl.NumberFormat('vi')`, so it pins no wording of its own.
3. Does root `pnpm test` double-run these tests? The root runs `vitest run` over the projects once; the package `test` script is for `--filter` only.
4. Is the README in scope? It is the written naming rule the intent asks for (outcome 4); the spec's Layout does not list it, so it is the one addition of this plan and can be dropped without touching a requirement.
