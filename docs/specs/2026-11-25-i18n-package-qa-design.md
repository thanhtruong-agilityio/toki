# QA of the i18n package design

Date: 2026-11-25 · Status: draft for review
Intent: docs/intents/i18n-package-qa.md (Thanh Truong)
Ticket: TOKI-129

## Goal
The builder, the QA and the BA need to know whether TOKI-017 (the i18n package) does what its spec says. It was closed as Done on merge and nobody tested it. After this work TOKI-017 has a QA record that tests each requirement of its spec at a named commit, with the result and the evidence of each row. It is one of the QA tickets for the Blueprint outcome I02 design-system; the acceptance of I02 is a later ticket. The records use the flow of `docs/specs/2026-11-24-ba-qa-acceptance-design.md`; this work adds records and changes no format and no script. The pattern is the QA of the test harness (`docs/specs/2026-11-25-test-harness-qa-design.md`).

## Scope
- In:
  - The QA record `docs/qa/TOKI-017.md`, its checks script `docs/qa/TOKI-017.checks.sh` and its evidence file `docs/qa/TOKI-017.evidence.txt` (R1 to R6).
  - The regenerated `docs/traceability.md` (R8).
- Out (not now):
  - The QA of the other tickets of I02 and the acceptance record of I02.
  - Any change to the scripts of the flow, the record formats, the intent and spec of TOKI-017, or any file the checks read. A defect or an out-of-date requirement found here is reported in the record, not fixed (R9).
  - Reopening TOKI-017 on the tracker; the flow is visible and not binding, and the BA decides (R10).
  - New automated tests for TOKI-017; a row may point to a check that already runs.

## Requirements
- R1. `docs/qa/TOKI-017.md` is a QA record in the format of the parent spec (R1 to R4): header `Ticket: TOKI-017`, `Spec: docs/specs/2026-11-16-i18n-package-design.md`, `Version:` and `Environment:`; a test matrix with the columns `ID`, `Requirement`, `Layer`, `Steps`, `Expected`, `Evidence`, `Priority`, `Approved`, `Result`, `Run`. Check: `bash .github/scripts/qa-ready.sh TOKI-017` reports no gap other than rows that are Fail or Blocked.
- R2. Every requirement of the spec of TOKI-017 (R1 to R24) has at least one row, or an entry under `## Not covered` with the reason. A row names one requirement and one behavior, and a requirement with several behaviors is split into several rows. `Expected` is a concrete value. Check: `qa-ready.sh TOKI-017` reports no requirement without a row or a reason.
- R3. The command rows use the layer `command`: each runs `V=<commit> bash docs/qa/TOKI-017.checks.sh <ID>` and compares its one output line with `Expected`. The script reads files of the commit `V` with `git show`; a row that needs a tool (the TypeScript compiler, the linter, Vitest, `tsx`) runs it in a temporary worktree of `V` outside the repository, which the script removes before it ends (R5). It prints counts, names, exit codes and words, never a secret. Its output is kept in `docs/qa/TOKI-017.evidence.txt` and the `Evidence` of a Pass row points to the line. A row that loops prints how many items it checked and its `Expected` requires at least one. Check: a reader runs the script and gets the same lines; `git status --porcelain` of the repository is the same before and after.
- R4. The rows are drafted by Claude and approved by the QA before any row is run; `Approved` carries the QA's name and the date. A row that cannot be run is `Blocked` with the reason in the result notes, never `Pass`. A check that proves wrong is corrected and rerun with both runs kept in the evidence file; a changed `Expected` needs the QA's approval again. A requirement that only a person can judge by eye is a row with the layer `manual`, `Blocked` until the QA pastes the result, never `Pass`. Check: no `Result` without `Approved`, as `qa-ready.sh` reports.
- R5. The checks script uses only a temporary worktree of the commit with an install made there (`pnpm install`), and the tools of the package run from it: `pnpm --filter @toki/i18n test`, the check command, `tsc`, ESLint, and `tsx` for small probe scripts that call the package. A row that changes a catalog or adds a file (a missing Vietnamese text, an unlisted namespace, a wrong key) does so in the temporary worktree only. The script needs no browser, no database and no port: the provider is rendered to a string by the package's own tests and by a probe. It prints no secret, reads no `.env` file and creates none, adds no file to the repository, and removes every worktree, folder and process it started, even when a row fails. Check: after the script, `git worktree list` shows no new entry and no process of the script remains.
- R6. The record's `Version:` is the merge commit of the pull request that delivered TOKI-017, `081dcdc9` (#147) (concern 1), and every row is judged at it. PR #147 delivered it: it merged the branch `feat/toki-017-i18n-package` on 2026-11-18 and added `packages/i18n/src` (the commit `8835d6ae`), the root script `i18n:check` and the `i18n` job of `ci.yml`; no later commit re-landed it. The result notes say, for a row that would give a different answer on the current `main`, what changed since and which later ticket changed it (for example the namespaces added to the catalogs and the keys added to `nav`, which make R15's "exactly 13 keys" different on `main`), without judging it. Check: `Version:` is that commit, and every row's evidence line names it.
- R7. The ticket holds no acceptance record and no verdict for I02. The record carries a result note that says which Success Criterion of I02 each row will feed, as the acceptance ticket of I02 lists them, without judging it. Check: `docs/acceptance/` gains no file.
- R8. `bash .github/scripts/trace.sh` is run after the record exists and `docs/traceability.md` is committed with it. Check: the TOKI-017 row shows the requirements covered and the rows passed over the rows, and no other row changes except where a spec merged since the last run adds one.
- R9. This work edits no existing file except `docs/traceability.md` (regenerated). The intent and spec of TOKI-017, the files that TOKI-017 delivered, the three scripts of the flow and their tests are not changed. Check: `git diff` of the pull request shows added files and the regenerated table only.
- R10. The tracker is not changed by this work beyond the ticket's own status. TOKI-017 stays Done; if a row fails the record says so and the BA decides whether to reopen it or to amend its spec. Evidence holds no secret, token or personal data. Check: review of the pull request.

## Design
### How each requirement of TOKI-017 is tested
The checks read files of one commit `V`; rows that run a tool use a temporary worktree of `V` (R5). `Expected` is what the spec of TOKI-017 states. The spec has 24 requirements; they are grouped by the way they are checked, 11 groups, and the plan of the ticket turns each group into rows, one for each behavior. Every requirement of TOKI-017 is in a group, so `## Not covered` is empty unless a row proves impossible (R4).

| TOKI-017 | Row and what it compares | Layer | Needs |
| :---- | :---- | :---- | :---- |
| R1, R2, R3 | a probe imports the package and prints `LANGUAGES` (`en`, `vi`, in that order), `DEFAULT_LANGUAGE` (`en`), `LANGUAGE_NAMES` (`English`, `Tiếng Việt`), and `resolveLanguage` for the six inputs `undefined`, `null`, `''`, `'fr'`, `'VI'`, `'vi-VN'` (all `en`) and for `'en'` and `'vi'` | command | install, tsx |
| R4, R5, R6, R7, R9 | a probe calls `translate` for `nav.home` in both languages; a placeholder replaced by a string and by a number, left in place when no parameter matches, ignored when no placeholder matches; plural forms for `count` 0, 1, 2 and 1.5 in English and Vietnamese, with `count` missing and with the string `'1'` giving `other`; a key missing in Vietnamese gives the English text and a key missing in both gives the key; `nav.toString` and `nav.constructor` do not throw and give the key; `createTranslator` equals `translate` on the same cases and returns the same function for the same language | command | install, tsx |
| R8 | in a temporary file of the worktree, `translate('en', 'nav.nope')` makes `tsc` fail and name the file; a `Record<…, MessageKey>` with a wrong entry fails the same way; `count: '1'` fails; the file is removed | command | install, tsc |
| R10, R11 | a probe renders a small component to a string with `react-dom/server`: under `I18nProvider language="vi"` it shows `vi` and `Trang chủ`; under a provider with no `language` and with no provider it shows `en` and `Home`; the same tree rendered with `en` then `vi` gives the two texts, with no reload and no copy of the language in the package; the context value is memoised on `language` (read in the source) and `t` is the same function across renders of one language | command | install, tsx, react |
| R12, R21, R22 | a scan over every file under `packages/i18n/src` except the test files, comments removed: `Intl` only in `format.ts` and each use with an explicit first argument; no `navigator` or `toLocale*String`; no browser or Node global; `react` imported only in `react.ts`; `exports` holds exactly `.` and `./react`; `react` is in `peerDependencies` and the file has no `dependencies`; ESLint passes on the package with the rules in force at `V` | command | install, files, eslint |
| R13, R14, R17, R18 | in the worktree: an English key removed from Vietnamese, a Vietnamese key with no English one, an empty text, a placeholder that differs, a key that breaks the naming rule, a plural form without `other` or with a form outside the language's set, and an unlisted file under `messages/en`: the check exits 1, names the language and the key (or the file) for each, and prints all problems in one run; a Vietnamese text equal to the English one is no problem | command | install, tsx |
| R15 | `translate` for the 13 keys of `nav` in both languages equals the table of "First texts" of the spec; the key count of `nav` is 13 at `V` | command | install, tsx |
| R16, R19 | `pnpm --filter @toki/i18n check` and `pnpm i18n:check` print the one line `i18n check: <n> keys, 2 languages, no problem` and exit 0; with `home` deleted from `messages/vi/nav.ts` in the worktree both exit 1 with `vi nav.home: missing` | command | install, tsx |
| R20 | `ci.yml` at `V` has a job named `i18n` that runs `pnpm i18n:check` and nothing else beyond checkout and setup; the pull request #147 and later runs of the workflow show the entry `i18n` (read with read-only `gh`; no throwaway pull request is opened) | command | files, gh history |
| R23 | `pnpm --filter @toki/i18n test` exits 0 and runs at least one test file; `pnpm typecheck` at the root exits 0; the type check of the package includes `src` and `scripts` | command | install, tsc |
| R24 | a probe prints `formatNumber('en', 1204)` (`1,204`), `formatNumber('en', 1234567.5)` (`1,234,567.5`), the `vi` result equal to `Intl.NumberFormat('vi')` for the same number, no throw for 0, a negative number and 1.5 in both languages, `1204` with `Intl.NumberFormat` removed and then made to throw, and the same result under another default locale of the process | command | install, tsx |

No requirement of TOKI-017 asks for a screen, so no row drives a browser. If a row needs a by-eye comparison, it is a `manual` row for the QA, `Blocked` until the QA pastes the result, never `Pass` (R4). Requirements that describe the repository when the ticket closed may no longer hold on `main`; the commit at which the rows are judged decides (concern 1).

### Layout
```
docs/
  qa/TOKI-017.md  TOKI-017.checks.sh  TOKI-017.evidence.txt
  traceability.md          (regenerated)
```

## Testing
- The scripts of the flow have their tests (`qa-ready.test.sh`, `acceptance-ready.test.sh`, `trace.test.sh`); this work runs them before and after and changes none.
- The checks script is run twice on the same commit: the lines are identical. A mutated copy of a file makes the matching row fail, so a row is not vacuous; the rows of R8, R13 and R16 are themselves mutations made in the temporary worktree.
- The worked run is the test: `qa-ready.sh TOKI-017` and `trace.sh` are run on the real files and what they print is read, not assumed. A row that fails stays in the record.

## Data safety
- Evidence quotes counts, names, texts of the interface and exit codes only. No `.env` file is read or created, and no secret, token or personal data is kept; tool output is not kept except the first error line of a refusal.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| The flow and formats are those of the merged spec; no script or format changes | R1, R9 |
| Some requirements describe the repository at the close of the ticket, so the commit matters | R6, concern 1 |
| Rows need an install and local tools, and must not change the repository or the development data; no browser or database is needed | R3, R5, concern 2 |
| A row is Pass only with evidence at a named commit; a row that cannot be run is Blocked; no secret or personal data | R3, R4, R10, Data safety |
| The merged intent and spec of TOKI-017 are not edited; nothing merges or pushes to `main` | R9, R10, Scope |

## Open questions from the intent
- At which commit are the rows judged: the merge commit of the pull request of TOKI-017, or the current `main`? Answered: the merge commit, `081dcdc9` (#147) (R6). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 1.
- May the checks use a temporary worktree, local tools and an install there, isolated from the repository? Answered: yes, isolated (R5). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 2.
- The spec asks for a red run of the `i18n` job on a pull request that removes a Vietnamese text, and the QA may not open throwaway pull requests. What evidence do the rows use for it? Answered: the definition of the job in `ci.yml` at `V`, the check's own exit codes on a mutated worktree (R16), and the run history read with read-only `gh`; no throwaway pull request is opened. A row for which the history gives no evidence is `Blocked`, never `Pass`. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 3.

## Areas of concern
1. The commit at which the rows are judged. Requirements of the spec of TOKI-017 describe the repository when the ticket closed, and later tickets changed it (the catalogs now hold many more namespaces, and `nav` more than 13 keys). Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the rows are judged at the merge commit of the pull request that delivered the ticket, `081dcdc9` (#147), so the record proves the ticket as delivered; the repository as it stands is judged by the acceptance ticket of I02. Owner: Thanh Truong (QA).
2. Temporary worktree and local tools. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the script may create a temporary worktree, run `pnpm install` there and use local tools and free local ports if a row needs them, isolated from the repository and the development data, and removes them at the end (R5); a row that cannot run for lack of a tool or a port is `Blocked`. One person holds Dev, QA and BA, and the record names the role next to each name. Owner: Thanh Truong (QA).
3. Evidence for the CI job (R20 of TOKI-017). Decided by Thanh Truong (lead, as product owner) on 2026-11-25: no throwaway pull request is opened; the rows read the job in `ci.yml` at `V`, run the check on a mutated worktree and read the run history with read-only `gh` when CI evidence is needed. A failure stays in the record and the BA decides whether to reopen the ticket (R10). Claude cannot read or create `.env`, and no row needs it. Owner: Thanh Truong (QA).
