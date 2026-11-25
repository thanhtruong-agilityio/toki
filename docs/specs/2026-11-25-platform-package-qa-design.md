# QA of the platform package design

Date: 2026-11-25 · Status: draft for review
Intent: docs/intents/platform-package-qa.md (Thanh Truong)
Ticket: TOKI-130

## Goal
The builder, the QA and the BA need to know whether TOKI-018 (the platform package) does what its spec says. It was closed as Done on merge and nobody tested it. After this work TOKI-018 has a QA record that tests each requirement of its spec at a named commit, with the result and the evidence of each row. It is one of the twelve QA tickets for the Blueprint outcome I02 design-system; the acceptance of I02 is a later ticket. The records use the flow of `docs/specs/2026-11-24-ba-qa-acceptance-design.md`; this work adds records and changes no format and no script. The pattern is the QA of TOKI-008 (`docs/specs/2026-11-25-test-harness-qa-design.md`), which also drives a browser and servers.

## Scope
- In:
  - The QA record `docs/qa/TOKI-018.md`, its checks script `docs/qa/TOKI-018.checks.sh` and its evidence file `docs/qa/TOKI-018.evidence.txt` (R1 to R6).
  - The regenerated `docs/traceability.md` (R8).
- Out (not now):
  - The QA of the other tickets of I02 and the acceptance record of I02.
  - Any change to the scripts of the flow, the record formats, the intent and spec of TOKI-018, or any file the checks read. A defect or an out-of-date requirement found here is reported in the record, not fixed (R9).
  - Reopening TOKI-018 on the tracker; the flow is visible and not binding, and the BA decides (R10).
  - New automated tests for TOKI-018; a row may point to a check that already runs.
  - The eight browser versions of NFR-14: TOKI-018 accepted that none is set up (its concern 5).

## Requirements
- R1. `docs/qa/TOKI-018.md` is a QA record in the format of the parent spec (R1 to R4): header `Ticket: TOKI-018`, `Spec: docs/specs/2026-11-16-platform-package-design.md`, `Version:` and `Environment:`; a test matrix with the columns `ID`, `Requirement`, `Layer`, `Steps`, `Expected`, `Evidence`, `Priority`, `Approved`, `Result`, `Run`. Check: `bash .github/scripts/qa-ready.sh TOKI-018` reports no gap other than rows that are Fail or Blocked.
- R2. Every requirement of the spec of TOKI-018 (R1 to R28) has at least one row, or an entry under `## Not covered` with the reason. A row names one requirement and one behavior, and a requirement with several behaviors is split into several rows. `Expected` is a concrete value. Check: `qa-ready.sh TOKI-018` reports no requirement without a row or a reason.
- R3. The command rows use the layer `command`: each runs `V=<commit> bash docs/qa/TOKI-018.checks.sh <ID>` and compares its one output line with `Expected`. The script reads files of the commit `V` with `git show`; a row that needs a tool, a browser or a server runs it in a temporary worktree of `V` outside the repository, which the script removes before it ends (R5). It prints counts, names, exit codes and words, never a secret. Its output is kept in `docs/qa/TOKI-018.evidence.txt` and the `Evidence` of a Pass row points to the line. A row that loops prints how many items it checked and its `Expected` requires at least one. Check: a reader runs the script and gets the same lines; `git status --porcelain` of the repository is the same before and after.
- R4. The rows are drafted by Claude and approved by the QA before any row is run; `Approved` carries the QA's name and the date. A row that cannot be run is `Blocked` with the reason in the result notes, never `Pass`. A check that proves wrong is corrected and rerun with both runs kept in the evidence file; a changed `Expected` needs the QA's approval again. Check: no `Result` without `Approved`, as `qa-ready.sh` reports.
- R5. The checks script uses only a temporary worktree of the commit with its own `pnpm install --frozen-lockfile`, the Chromium that Playwright has cached (or installs in the worktree), and the dev server of `apps/web` started on a free port. It prints no secret, reads no `.env` file and creates none, adds no file to the repository, and removes every worktree, folder, process and port it started, even when a row fails. Check: after the script, `git worktree list` shows no new entry and no process of the script remains.
- R6. The record's `Version:` is the merge commit of the pull request that delivered TOKI-018, `f9aa289` (#144) (concerns 1 and 3), and every row is judged at it. The result notes say, for a row that would give a different answer on the current `main`, what changed since and which later ticket changed it (for example the member `tabs` that TOKI-099 added to `Platform`), without judging it. Check: `Version:` is that commit, and every row's evidence line names it.
- R7. The browser rows are of two kinds. A requirement that a script can decide in Chromium (storage areas across tabs and after a restart, the permission value, the file dialog, the sound) is a `command` row: the script drives Chromium with Playwright against the dev app of the temporary worktree, which loads the web implementation of the package, and prints the values it saw. A requirement that is only a by-eye or by-ear comparison, or that needs Safari or Firefox (the checks by hand of its Testing section), is a `manual` row for the QA: it is `Blocked` until the QA pastes the result, never `Pass`. Check: every `manual` row has a result by the QA or the result `Blocked`, and no browser row is `Pass` without a printed value.
- R8. `bash .github/scripts/trace.sh` is run after the record exists and `docs/traceability.md` is committed with it. Check: the TOKI-018 row shows the requirements covered and the rows passed over the rows, and no other row changes except where a spec merged since the last run adds one.
- R9. This work edits no existing file except `docs/traceability.md` (regenerated). The intent and spec of TOKI-018, the files that TOKI-018 delivered, the three scripts of the flow and their tests are not changed. Check: `git diff` of the pull request shows added files and the regenerated table only.
- R10. The tracker is not changed by this work beyond the ticket's own status. TOKI-018 stays Done; if a row fails the record says so and the BA decides whether to reopen it or to amend its spec. Evidence holds no secret, token or personal data. Check: review of the pull request.

## Design
### How each requirement of TOKI-018 is tested
The checks read files of one commit `V`; rows that run a tool use a temporary worktree of `V` (R5). `Expected` is what the spec of TOKI-018 states, in the wording of the spec at `V` (concern 3). Requirements are grouped by the way they are checked; the plan of the ticket turns each group into rows, one for each behavior.

| TOKI-018 | Row and what it compares | Layer | Needs |
| :---- | :---- | :---- | :---- |
| R1, R3, R25 | the exports of `@toki/platform` (five types, `setPlatform`, `getPlatform`), the four members and their methods, and the result of `createWebPlatform()` assignable to `Platform` (a type check of a made-up file in the worktree); `package.json` has exactly the `exports` entries `.` and `./web`, and no `dependencies`; no file of the package imports `@toki/i18n` | command | install, files |
| R2, R4 | `getPlatform()` before `setPlatform` throws with `setPlatform` in the message; after `setPlatform(p)` it returns `p`, and `setPlatform(q)` replaces it; importing `@toki/platform` in the `node` environment does not throw | command | install |
| R5 | `createWebPlatform()` in Chromium asks for no permission, writes no key to `localStorage` or `sessionStorage`, requests no audio file and adds no element | command | install, Chromium, dev server |
| R6, R8, R9 | storage in Chromium: `set` then `get` returns the value, an unset or removed key gives `null`, keys are stored as `toki:<key>`, `clear()` leaves a key without the prefix, and a refused storage (blocked, or over quota) gives `null`, `false` and no throw | command | install, Chromium, dev server |
| R7 | `device` is read by a second `createWebPlatform()`, in another tab and after the browser context is closed and opened again; `tab` survives a reload and is not read from another tab | command | install, Chromium, dev server |
| R10, R11, R12 | `permission()` is one of the four values and `unsupported` without a `Notification` object; `requestPermission()` resolves after the answer (Chromium's permission granted or denied by the script), is the only call that asks, and never rejects when the request throws or rejects | command | install, Chromium, dev server |
| R13, R14, R15, R16, R17 | `pick` opens the file dialog, returns the picked files in order as `{ name, size, mimeType, handle }`, honors `multiple` and `accept`, returns an empty list when the dialog is cancelled, resolves an earlier waiting call with an empty list, applies no limit (a made-up large file) and leaves no element once resolved | command | install, Chromium, dev server |
| R18, R19, R20 | `play("notification")` plays the given address once and resolves `true`; resolves `false` for a blocked, missing or unloadable file and for an unknown address; no file is requested before the first `play`; a second `play` restarts the same sound | command | install, Chromium, dev server |
| R21, R22, R23, R24, R28 | `pnpm test:lint-rules` runs `tools/lint-rules/platform-boundary.test.mjs` and exits 0; with the ban removed from a copy of `eslint.config.js` in the worktree the test fails and names the case; `pnpm lint` on a made-up file with each banned import in the four packages, in `platform` outside `src/web/` and in `ui-web` exits non-zero and names the rule, and an import of `@toki/platform` passes | command | install |
| R26 | `apps/web/src/main.tsx` calls `setPlatform(createWebPlatform())` before the app is mounted; `@toki/web` declares `@toki/platform` as `workspace:*`; a search for `@toki/platform/web` finds only `main.tsx`, `packages/platform` and the lint-rule tests | command | files |
| R27 | `pnpm typecheck`, `pnpm lint`, `pnpm test:lint-rules`, `pnpm format:check` and `pnpm test` exit 0 at the root of the worktree | command | install, temporary Postgres if a test needs it |
| R7, R10, R13, R18, R19 in Chrome, Safari and Firefox | a person opens the real dialog, prompt and sound and compares them with the spec: the dialog opens and a pick and a cancel behave as R13 and R15, the prompt appears only after a press, `play` is heard from a press and gives `false` before any interaction, a second `play` from a timer in Safari, a `device` value after the browser is closed. Chromium is run by command above; Safari and Firefox are run by the QA | manual | the QA, the three browsers |

Requirements that describe the repository when the ticket closed may no longer hold on `main`; the commit at which the rows are judged decides (concern 1). Nothing of the spec is left without a row, so `## Not covered` is expected to be empty; a row that cannot run for lack of a tool is `Blocked`, not left out.

### Layout
```
docs/
  qa/TOKI-018.md  TOKI-018.checks.sh  TOKI-018.evidence.txt
  traceability.md          (regenerated)
```

## Testing
- The scripts of the flow have their tests (`qa-ready.test.sh`, `acceptance-ready.test.sh`, `trace.test.sh`); this work runs them before and after and changes none.
- The checks script is run twice on the same commit: the lines are identical. A mutated copy of a file (a `localStorage` use added to the interface entry, the ban removed from the lint configuration, the `toki:` prefix dropped) makes the matching row fail, so a row is not vacuous.
- The worked run is the test: `qa-ready.sh TOKI-018` and `trace.sh` are run on the real files and what they print is read, not assumed. A row that fails stays in the record.

## Data safety
- Evidence quotes counts, names and exit codes only. No `.env` file is read or created, and no secret, token or personal data is kept; tool output is not kept except the first error line of a refusal. The made-up files and storage values of the browser rows are fictitious and the browser profile is a temporary one that the script removes.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| The flow and formats are those of the merged spec; no script or format changes | R1, R9 |
| Some requirements describe the repository at the close of the ticket, the spec was revised after the code, and later tickets changed the package, so the commit matters | R6, concerns 1 and 3 |
| Rows need an install, a browser, a dev server and free ports, and must not change the repository; `.env` is not read | R3, R5, R7, concerns 2 and 4 |
| A row is Pass only with evidence at a named commit; a row that cannot be run is Blocked; no secret or personal data | R3, R4, R7, R10, Data safety |
| The merged intent and spec of TOKI-018 are not edited; nothing merges or pushes to `main` | R9, R10, Scope |

## Open questions from the intent
- At which commit are the rows judged: the merge commit of the pull request of TOKI-018, or the current `main`? Answered: the merge commit, `f9aa289` (#144) (R6). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 1.
- May the checks use a temporary worktree and the local tools, browser and ports that the rows need, isolated from the repository? Answered: yes, isolated (R5). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 2.
- The spec of TOKI-018 was revised on 2026-11-23 and 2026-11-25, after its code was merged. Which commit is the delivery, and what if the revised spec asks for more than the code did? Answered: the delivery is the merge commit of PR #144, `f9aa289`; a requirement of the revised text that this commit does not meet is a Fail with the note, and the BA decides. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 3.
- The dialog, the permission prompt and the sound need a real browser, and the spec says they are checked by hand in Chrome, Safari and Firefox. Which of these do the rows run by command, and which stay for the QA? Answered: Chromium by command with Playwright; a requirement that is only a by-eye or by-ear comparison, and Safari and Firefox, are `manual` rows for the QA, `Blocked` until the QA pastes the result (R7). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 4.

## Areas of concern
1. The commit at which the rows are judged. Requirements of the spec of TOKI-018 describe the repository when the ticket closed, and later tickets changed it: TOKI-099 added the member `tabs` to `Platform` (R1 says exactly four members) and TOKI-015 moved the unit tests into a tests folder. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the rows are judged at the merge commit of the pull request that delivered the ticket, `f9aa289` (#144), so the record proves the ticket as delivered; the repository as it stands is judged by the acceptance ticket of I02. Owner: Thanh Truong (QA).
2. Temporary worktree and local resources. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the script may create a temporary worktree and use the local tools, the cached Chromium and Playwright, free local ports and its own `pnpm install` there, isolated from the repository, and removes them at the end (R5); a row that cannot run for lack of a tool or a free port is `Blocked`. Owner: Thanh Truong (QA).
3. The delivery and the revised spec. The code of TOKI-018 was delivered by PR #144, merged on 2026-11-18 as `f9aa289`. Its spec was revised afterwards: on 2026-11-23 (`7f6a159`, change requests from later specs, and `4772f8c`, no lint change for `files.upload`) and by PR #249 on 2026-11-25 (`c5c7daa`, a spec PR and not the delivery). Of the 28 requirements only the text of R1 changed (it now names the later additions `files.upload`, `clipboard` and `tabs`); the Design and Scope text changed too. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the rows are judged at `f9aa289` (PR #144) and `Expected` is taken from the spec text at that commit where the two differ; a requirement of the revised spec that the code of that commit does not meet fails with a note in the result notes, and the BA decides whether to reopen or to amend the spec. Owner: Thanh Truong (QA).
4. Browser rows and the by-hand checks. The spec of TOKI-018 accepted that the dialog, the prompt and blocked sound are checked by hand in Chrome, Safari and Firefox (its concern 5). Decided by Thanh Truong (lead, as product owner) on 2026-11-25: a check that a script can decide in Chromium is a `command` row driving Chromium with Playwright against the dev app of the temporary worktree; a requirement that is only a by-eye comparison, or that needs Safari or Firefox, is a `manual` row for the QA, `Blocked` until the QA pastes the result, never `Pass` (R7). Owner: Thanh Truong (QA).
