# TOKI-129 QA of the i18n package - implementation plan

**Goal:** TOKI-017 (the i18n package) gets a QA record at the merge commit of the pull request that delivered it, with the results whatever they are.

**Spec:** `docs/specs/2026-11-25-i18n-package-qa-design.md` (R1 to R10). Tier M. Branch `docs/toki-129-i18n-package-qa`. Documents and one bash script; no existing file changes except `docs/traceability.md` (regenerated). `Version:` is `081dcdc9` (PR #147, 2026-11-18), decided in concern 1: R15's exact key count and any requirement that no longer holds on `main` are judged at that commit, and the result notes report the later change. Concern 2 decided: a temporary worktree of `081dcdc9` with `pnpm install` run in it, no browser, no database, no port. Concern 3 decided: no throwaway pull request; R20 is read from the `ci.yml` job, the check's exit codes on a changed worktree and the run history read with read-only `gh`; a row with no history is `Blocked`.

## Design

Same shape as the earlier QA tickets (TOKI-008, TOKI-012, TOKI-013), with the lessons built in: each part of a sentence of a requirement is a printed number; a row names one requirement; every check that must fail is paired with a run that must pass (a changed file of the temporary worktree restored with `git checkout`, or a changed copy of the source in the temporary folder for the scans); a row prints `Blocked` and never a Pass when it cannot be shown; one `BASE` folder made in the current shell holds every temporary file (exported as `TMPDIR` and given to every child through `env -i`); the last line shows no worktree under that folder, the repository status as it was, no process and the folder removed; `grep -q` is not used under `pipefail`; empty arrays use `${a[@]+"${a[@]}"}`; `perl -0pi` replaces `sed -i ''`.

- **One temporary worktree of `081dcdc9`** with `corepack pnpm install --frozen-lockfile` under Node 22 (the default Node 24 is refused by the repository). The `tsx` probes, the temporary type files and every catalog change are written inside it, used and deleted; nothing is added to the repository and no `.env` is read or created.
- **Probes** (`tsx` in `packages/i18n`) call `translate`, `createTranslator`, `translateWith` (on small test catalogs), `formatNumber` and the provider rendered to a string with `react-dom/server`, and print counts. A child process with the default locale set to Vietnamese shows that `formatNumber('en', ...)` does not follow the device (R12, R24).
- **Type rows** write a file into `src`, run `tsc --noEmit` through the package, and compare a valid file with a wrong one (R1 type, R6, R8).
- **Check rows** run `pnpm --filter @toki/i18n check` and `pnpm i18n:check` on the committed catalogs and on catalogs changed in the worktree, one problem kind per row (R13 to R19) and all at once.
- **Source scans** read `git archive` of `packages/i18n` with a small Node script that removes comments and counts `Intl` (and its first argument), `navigator`, `toLocale*String`, globals, Node imports, `react` importers and state hooks; each is paired with a changed copy (R11, R12, R21, R22).
- **History rows** (R20) read the job in `ci.yml` at the Version and the real runs of `ci.yml` from the first commit of PR #147 up to the fixed instant `2026-11-25T09:00:00Z`, with read-only `gh api`, a cache folder (`QA_CACHE`) and retries. T20C (a failed `i18n` run) is `Blocked` when the history holds none; no throwaway pull request is opened.
- **Manual rows:** none expected; the spec asks for no screen.
- Output is counts, exit codes and words. No tool output and no secret. Rows are drafted by Claude and approved by the QA before any row is run. Debug runs of the script are not evidence.

### Rows (ids follow the requirement numbers; a requirement with several behaviors is split with a letter)

| ID | TOKI-017 | Output compared with Expected |
| :-- | :-- | :-- |
| T1, T1B | R1 | `LANGUAGES`, `DEFAULT_LANGUAGE`; the type `Language` accepts `'en'`, `'vi'` and refuses `'fr'` |
| T2, T2B, T3 | R2, R3 | `isLanguage` over 2 true and 9 false values; `resolveLanguage` over the six inputs; the two language names |
| T4 | R4 | `translate` of `nav.home` in en and vi |
| T5, T5B | R5 | string and number placeholders, the example; a missing parameter stays, an extra one is ignored |
| T6, T6B, T6C, T6D | R6 | English forms for 0, 1, 2, 1.5; Vietnamese always `other`; missing, string and null `count`; `count: '1'` refused by `tsc` |
| T7, T7B, T7C | R7 | `toString` and `constructor` keys and no throw; English fallback; the key itself |
| T8, T8B | R8 | `nav.nope` and a wrong `Record<..., MessageKey>` entry fail `tsc` and name the file |
| T9 | R9 | 246 comparisons of `createTranslator` with `translate`; same function for the same language |
| T10, T10B, T11, T11B | R10, R11 | provider with `vi`, with no property, with no provider; `en` then `vi` then `en`; no state in `react.ts`; `useMemo` on `[language]`; `t` identity |
| T12, T12B | R12 | `Intl` only in `format.ts` and always with a language; no `navigator`, no `toLocale*String` |
| T13, T13B, T13C, T14, T14B | R13, R14 | unlisted file; namespace in one language only; new namespace with no code change; naming rule on bad and real keys |
| T15, T15B, T15C | R15 | the 13 texts against the table read from the spec; key count and namespaces; the test copy |
| T16, T17A to T17G, T18 | R16, R17, R18 | the success line; each problem kind (a) to (f) and all in one run; equal wording is no problem |
| T19, T19B | R19 | the root script against the package command, clean and with `home` deleted |
| T20, T20B, T20C, T20D | R20 | the job in `ci.yml`; `i18n` in PR #147 runs and later runs; a failed `i18n` run (Blocked when none); a green one |
| T21, T21B, T21C, T21D | R21 | `exports`; `peerDependencies` and no `dependencies`; `react` imported only in `react.ts`; the main entry loads with React unreachable |
| T22, T22B | R22 | no browser global or Node API in source files; ESLint exit codes |
| T23, T23B, T23C | R23 | package tests; root `typecheck`; `include` of `tsconfig.json` |
| T24, T24B, T24C, T24D | R24 | `1,204` and `1,234,567.5`; `vi` equals `Intl`; fallback and no throw; another default locale |

## AC -> step -> test

| Req | Step | Test |
| :---- | :---- | :---- |
| R3, R5 | 1. Write `TOKI-017.checks.sh` | run on a changed commit (languages, plural rule, fallback, `Intl` call, memo list, a missing text, the check message, the CI step, an extra export): the matching rows change; run twice: identical lines |
| R1, R2 | 2. Draft `docs/qa/TOKI-017.md` (unapproved, unrun) | `qa-ready.sh` reports only rows that have not been run |
| R4, R6 | 3. QA approves rows; Claude runs the rows | results and evidence in the record |
| R7, R8 | 4. Result notes (what changed since `081dcdc9`, which Success Criterion of I02 each row feeds), `trace.sh` | the TOKI-017 row of the table |
| R9, R10 | 5. Checks | `git diff` shows added files and `traceability.md` only; repository unchanged; no worktree or folder left; no write to GitHub |

## What can break (riskiest first)

1. A row that passes without measuring: every case that must fail is paired with one that must pass and the numbers are printed.
2. History reads: GitHub rate limits or a failed read of a job list make T20B to T20D `Blocked`; the cache, the retries and the fixed snapshot keep reruns identical. T20C has no failed `i18n` run to read, so it stays `Blocked` unless the QA accepts T19B as the red evidence.
3. Counts tied to the Version (246 comparisons, 481 later runs, 11 source files, 8 test files) change with the Version or the snapshot; `Expected` names them as at `081dcdc9`.
4. The first install of a new lockfile needs the network; a row that cannot install is `Blocked` with the reason.
