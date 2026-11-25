# QA of the self-hosted fonts design

Date: 2026-11-25 · Status: draft for review
Intent: docs/intents/self-hosted-fonts-qa.md (Thanh Truong)
Ticket: TOKI-122

## Goal
The builder, the QA and the BA need to know whether TOKI-010 (self-hosted fonts) does what its spec says. It was closed as Done on merge and nobody tested it. After this work TOKI-010 has a QA record that tests each requirement of its spec at a named commit, with the result and the evidence of each row. It is the second of the twelve tickets of the Blueprint outcome I02 design-system; the acceptance of I02 is a later ticket. The records use the flow of `docs/specs/2026-11-24-ba-qa-acceptance-design.md`; this work adds records and changes no format and no script. The pattern is the QA of the web app skeleton (`docs/specs/2026-11-25-web-skeleton-qa-design.md`).

## Scope
- In:
  - The QA record `docs/qa/TOKI-010.md`, its checks script `docs/qa/TOKI-010.checks.sh` and its evidence file `docs/qa/TOKI-010.evidence.txt` (R1 to R6).
  - The regenerated `docs/traceability.md` (R8).
- Out (not now):
  - The QA of the other tickets of I02 and the acceptance record of I02.
  - Any change to the scripts of the flow, the record formats, the intent and spec of TOKI-010, or any file the checks read. A defect or an out-of-date requirement found here is reported in the record, not fixed (R9).
  - Reopening TOKI-010 on the tracker; the flow is visible and not binding, and the BA decides (R10).
  - New automated tests for TOKI-010; a row may point to a check that already runs (`check:fonts` and its tests).

## Requirements
- R1. `docs/qa/TOKI-010.md` is a QA record in the format of the parent spec (R1 to R4): header `Ticket: TOKI-010`, `Spec: docs/specs/2026-11-16-self-hosted-fonts-design.md`, `Version:` and `Environment:`; a test matrix with the columns `ID`, `Requirement`, `Layer`, `Steps`, `Expected`, `Evidence`, `Priority`, `Approved`, `Result`, `Run`. Check: `bash .github/scripts/qa-ready.sh TOKI-010` reports no gap other than rows that are Fail or Blocked.
- R2. Every requirement of the spec of TOKI-010 (R1 to R18) has at least one row, or an entry under `## Not covered` with the reason. A row names one requirement and one behavior, and a requirement with several behaviors is split into several rows. `Expected` is a concrete value. Check: `qa-ready.sh TOKI-010` reports no requirement without a row or a reason.
- R3. The command rows use the layer `command`: each runs `V=<commit> bash docs/qa/TOKI-010.checks.sh <ID>` and compares its one output line with `Expected`. The script reads files of the commit `V` with `git show`; a row that needs a tool, a built app, a server or a browser runs it in a temporary worktree of `V` outside the repository, which the script removes before it ends (R5). It prints counts, names, exit codes and words, never a secret. Its output is kept in `docs/qa/TOKI-010.evidence.txt` and the `Evidence` of a Pass row points to the line. A row that loops (over the seven files, the 241 code points, the files of `dist`) prints how many items it checked and its `Expected` requires the full count. Check: a reader runs the script and gets the same lines; `git status --porcelain` of the repository is the same before and after.
- R4. The rows are drafted by Claude and approved by the QA before any row is run; `Approved` carries the QA's name and the date. A row that cannot be run is `Blocked` with the reason in the result notes, never `Pass`. A check that proves wrong is corrected and rerun with both runs kept in the evidence file; a changed `Expected` needs the QA's approval again. A requirement that is only a by-eye comparison with the prototype (the shape of the Bricolage Grotesque title; the drawing in Safari) is a row of layer `manual`: it is `Blocked` until the QA pastes the result and the evidence, never `Pass`. Check: no `Result` without `Approved`, as `qa-ready.sh` reports.
- R5. The checks script uses only a temporary worktree of the commit with its own `pnpm install`, the production build of the web app and `vite preview` on a free port, a headless Chromium installed by Playwright in the temporary worktree for the rows that need a browser, and a font-reading tool already pinned in the worktree. It prints no secret, reads no `.env` file and creates none, adds no file to the repository, and removes every worktree, folder, process and port it started, even when a row fails. A row that cannot run for lack of a tool or a free port is `Blocked`. The mutations of R16 are made on a copy inside the temporary worktree, never on the repository. Check: after the script, `git worktree list` shows no new entry and no process of the script remains.
- R6. The record's `Version:` is the merge commit of the pull request that delivered TOKI-010, `5a8e7df` (#171) (concern 1), and every row is judged at it. PR #171 delivered it; no earlier pull request carried the code of the ticket, and it was not reverted. The result notes say, for a row that would give a different answer on the current `main`, what changed since and which later ticket changed it, without judging it. Check: `Version:` is that commit, and every row's evidence line names it.
- R7. The ticket holds no acceptance record and no verdict for I02. The record carries a result note that says which Success Criterion of I02 each row will feed (every base component matches the prototype; text is drawn in the prototype's fonts), without judging it. Check: `docs/acceptance/` gains no file.
- R8. `bash .github/scripts/trace.sh` is run after the record exists and `docs/traceability.md` is committed with it. Check: the TOKI-010 row shows the requirements covered and the rows passed over the rows, and no other row changes except where a spec merged since the last run adds one.
- R9. This work edits no existing file except `docs/traceability.md` (regenerated). The intent and spec of TOKI-010, the files that TOKI-010 delivered, the three scripts of the flow and their tests are not changed. Check: `git diff` of the pull request shows added files and the regenerated table only.
- R10. The tracker is not changed by this work beyond the ticket's own status. TOKI-010 stays Done; if a row fails the record says so and the BA decides whether to reopen it or to amend its spec. Evidence holds no secret, token or personal data. Check: review of the pull request.

## Design
### How each requirement of TOKI-010 is tested
The checks read files of one commit `V`; rows that run a tool use a temporary worktree of `V` (R5). `Expected` is what the spec of TOKI-010 states, with the paths as the spec writes them (`apps/web/src/fonts/`); where the delivered ticket differs, the row fails and the result note says where the files are (concern 4). The spec has 18 requirements; the plan of the ticket turns each group into rows, one for each behavior.

| TOKI-010 | Row and what it compares | Layer | Needs |
| :---- | :---- | :---- | :---- |
| R1, R3, R6 | the tracked font files under `apps/web` are seven, all WOFF2, with the names of Table A and no other font file; each is static, upright, with the weight of its row; each is at most 51,200 bytes and the seven together at most 307,200 bytes | command | install, files |
| R2, R7 | `fonts.css` holds seven `@font-face` rules with the family, `normal`, one weight, `swap`, one relative `woff2` `url()`, no `local()` and no `unicode-range`; and one `body` rule with the `font-family` list of the spec; `main.tsx` imports it and no other file under `apps/web/src` does | command | files |
| R4, R5, R14, R15 | for each of the seven files, each of the 241 code points of Table B has a glyph unless `sources.json` records it as missing under the rule of R4; no glyph outside Table C; `sources.json` has seven entries with every field, the SHA-256 of each file equals the record, and each family has its licence file | command | install, files |
| R8, R9, R10, R11 | one font preload link with `as="font"`, `type="font/woff2"` and `crossorigin` for the 400 file; after `pnpm --filter ./apps/web build`, `dist` holds seven hashed `.woff2` files, the built CSS names each by a path with no scheme and no host, no `data:font`, the preload `href` equals the CSS URL of the 400 file and exists; no `fonts.googleapis.com` or `fonts.gstatic.com` in the source or in `dist` | command | install, build |
| R12 | built app on `vite preview`, Chromium on `/no-such-page`: the not-found text is drawn in Be Vietnam Pro, one font request, the preloaded file, requested once, no request to another host | command | install, build, browser |
| R13 | a temporary page in the worktree shows the sample line of the spec in each of the three families; Chromium's rendered-font list (Chrome DevTools Protocol) for each line names no other font except the next font for a letter that Table D lists. Safari and a by-eye check of the Bricolage Grotesque title against the prototype are separate rows | command, manual | install, build, browser, the QA's eye |
| R16 | `pnpm --filter ./apps/web check:fonts` exits 0 on the built worktree; each mutation of the spec's Testing (remove a file, an uncut font, a changed `font-weight`, a second preload, a changed SHA-256, no `dist`) makes it exit non-zero and name the file and the requirement or the build command; the script passes `pnpm lint` and `pnpm format:check` and uses no global `process` | command | install, build |
| R17, R18 | `build` and `typecheck` exit 0 and the initial JavaScript stays under the limit of TOKI-006 R10; the list of files changed by the delivering pull request holds nothing outside `apps/web` but the lock file | command | install, git history |

Requirements that describe the repository when the ticket closed may no longer hold on `main`; the commit at which the rows are judged decides (concern 1). A by-eye requirement with no automatic equivalent is a `manual` row (concern 3).

### Layout
```
docs/
  qa/TOKI-010.md  TOKI-010.checks.sh  TOKI-010.evidence.txt
  traceability.md          (regenerated)
```

## Testing
- The scripts of the flow have their tests (`qa-ready.test.sh`, `acceptance-ready.test.sh`, `trace.test.sh`); this work runs them before and after and changes none.
- The checks script is run twice on the same commit: the lines are identical. A mutated copy of a file in the temporary worktree makes the matching row fail, so a row is not vacuous.
- The worked run is the test: `qa-ready.sh TOKI-010` and `trace.sh` are run on the real files and what they print is read, not assumed. A row that fails stays in the record.
- The browser rows are command rows that drive Chromium with Playwright against the built app of the temporary worktree. The by-eye rows stay `Blocked` until the QA pastes the result.

## Data safety
- Evidence quotes counts, names, sizes, hashes of public font files and exit codes only. No `.env` file is read or created, and no secret, token or personal data is kept; tool output is not kept except the first error line of a refusal. The font files, the sample line and `sources.json` hold no personal data.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| The flow and formats are those of the merged spec; no script or format changes | R1, R9 |
| Some requirements describe the repository at the close of the ticket, so the commit matters | R6, concerns 1 and 4 |
| Rows need an install, a built app, a server or a browser, and must not change the repository | R3, R5, concerns 2 and 3 |
| A row is Pass only with evidence at a named commit; a row that cannot be run is Blocked; no secret or personal data | R3, R4, R10, Data safety |
| The merged intent and spec of TOKI-010 are not edited; nothing merges or pushes to `main` | R9, R10, Scope |

## Open questions from the intent
- At which commit are the rows judged: the merge commit of the pull request of TOKI-010, or the current `main`? Answered: the merge commit, `5a8e7df` (#171) (R6). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 1.
- May the checks use a temporary worktree and the local tools, browser and ports that the rows need? Answered: yes, isolated, with the cached Chromium and Playwright and free local ports (R5). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 2.
- Which requirements about how text looks are checked by command and which by the QA's eye? Answered: a command row drives Chromium with Playwright against the built app of the temporary worktree; a requirement that is only a by-eye comparison with the prototype is a `manual` row, `Blocked` until the QA pastes the result, never `Pass` (R4). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 3.
- The spec puts the fonts in `apps/web/src/fonts/` and says no file outside `apps/web` changes; the delivered ticket differs. How are such rows judged? Answered: against the spec as written, so the row fails and the failure stays in the record; the BA decides whether to reopen the ticket or amend its spec (R10). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 4.

## Areas of concern
1. The commit at which the rows are judged. Requirements of the spec of TOKI-010 describe the repository when the ticket closed, and later tickets changed it. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the rows are judged at the merge commit of the pull request that delivered the ticket, `5a8e7df` (#171), so the record proves the ticket as delivered; the repository as it stands is judged by the acceptance ticket of I02. Owner: Thanh Truong (QA).
2. Temporary worktree and local resources. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the script may create a temporary worktree of that commit, run `pnpm install` there, build the app, and use local tools, the cached Chromium and Playwright, and free local ports, isolated, and removes them at the end (R5); a row that cannot run for lack of a tool or a free port is `Blocked`. Owner: Thanh Truong (QA).
3. Browser and by-eye rows. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the rows that need a browser (R12, R13 of the spec of TOKI-010) are command rows that drive a headless Chromium with Playwright against the built app of the temporary worktree. A requirement that is only a by-eye comparison with the prototype (the Bricolage Grotesque title against the prototype, the drawing in Safari) is a `manual` row for the QA, `Blocked` until the QA pastes the result, never `Pass`. Owner: Thanh Truong (QA).
4. The delivered ticket differs from its spec in at least two places that the plan expects to find: the fonts folder is `apps/web/assets/fonts/` and not `apps/web/src/fonts/` (R1, R2, R7, R14, R15 and the import in `main.tsx` name the spec's folder), and the delivering pull request also adds `docs/plans/TOKI-010.md` and its state file, which are outside `apps/web` (R18). Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the rows are judged against the spec as written, a failure stays in the record with the delivered path in the result note, and the BA decides whether to reopen the ticket or amend its spec; this work edits neither. Owner: Thanh Truong (BA).
