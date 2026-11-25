# QA of base components, group 1 design

Date: 2026-11-25 · Status: draft for review
Intent: docs/intents/base-components-1-qa.md (Thanh Truong)
Ticket: TOKI-124

## Goal
The builder, the QA and the BA need to know whether TOKI-012 (Button, IconButton, Chip, Switch, Field, Select, Tag and Badge, their style sheets, the base rules, the lint rule for icon-only buttons and the test set-up of `ui-web`) does what its spec says. It was closed as Done on merge and nobody tested it. After this work TOKI-012 has a QA record that tests each requirement of its spec at a named commit, with the result and the evidence of each row. It is ticket 4 of the 12 tickets of the Blueprint outcome I02 design-system; the acceptance of I02 is a later ticket. The records use the flow of `docs/specs/2026-11-24-ba-qa-acceptance-design.md`; this work adds records and changes no format and no script. The pattern is the QA of the test harness (`docs/specs/2026-11-25-test-harness-qa-design.md`).

## Scope
- In:
  - The QA record `docs/qa/TOKI-012.md`, its checks script `docs/qa/TOKI-012.checks.sh` and its evidence file `docs/qa/TOKI-012.evidence.txt` (R1 to R6).
  - The regenerated `docs/traceability.md` (R8).
- Out (not now):
  - The QA of the other tickets of I02 and the acceptance record of I02.
  - Any change to the scripts of the flow, the record formats, the intent and spec of TOKI-012, or any file the checks read. A defect or an out-of-date requirement found here is reported in the record, not fixed (R9).
  - Reopening TOKI-012 on the tracker; the flow is visible and not binding, and the BA decides (R10).
  - New automated tests for TOKI-012; a row may point to a check that already runs (the Vitest tests of `ui-web` and `pnpm lint:boundaries`).

## Requirements
- R1. `docs/qa/TOKI-012.md` is a QA record in the format of the parent spec (R1 to R4): header `Ticket: TOKI-012`, `Spec: docs/specs/2026-11-16-base-components-1-design.md`, `Version:` and `Environment:`; a test matrix with the columns `ID`, `Requirement`, `Layer`, `Steps`, `Expected`, `Evidence`, `Priority`, `Approved`, `Result`, `Run`. Check: `bash .github/scripts/qa-ready.sh TOKI-012` reports no gap other than rows that are Fail or Blocked.
- R2. Every requirement of the spec of TOKI-012 (R1 to R31) has at least one row, or an entry under `## Not covered` with the reason. A row names one requirement and one behavior, and a requirement with several behaviors is split into several rows (one row for each component for R4 and R10 to R20; one row for each file or group of files for R5 to R9). `Expected` is a concrete value. Check: `qa-ready.sh TOKI-012` reports no requirement without a row or a reason.
- R3. The command rows use the layer `command`: each runs `V=<commit> bash docs/qa/TOKI-012.checks.sh <ID>` and compares its one output line with `Expected`. The script reads files of the commit `V` with `git show`; a row that needs a tool, a browser or a port runs it in a temporary worktree of `V` outside the repository, which the script removes before it ends (R5). It prints counts, names, exit codes and words, never a secret. Its output is kept in `docs/qa/TOKI-012.evidence.txt` and the `Evidence` of a Pass row points to the line. A row that loops prints how many items it checked and its `Expected` requires at least one. Check: a reader runs the script and gets the same lines; `git status --porcelain` of the repository is the same before and after.
- R4. The rows are drafted by Claude and approved by the QA before any row is run; `Approved` carries the QA's name and the date. A row that cannot be run is `Blocked` with the reason in the result notes, never `Pass`. A check that proves wrong is corrected and rerun with both runs kept in the evidence file; a changed `Expected` needs the QA's approval again. Check: no `Result` without `Approved`, as `qa-ready.sh` reports.
- R5. The checks script uses only a temporary worktree of the commit with its own `pnpm install` (the store is read-only shared and nothing is written to the repository), the tools of that install (Vitest with jsdom, ESLint, TypeScript, Vite), the headless Chromium that Playwright has cached on the machine or installs in the worktree, and free local ports. It prints no secret, reads no `.env` file and creates none, adds no file to the repository, and removes every worktree, folder, process and port it started, even when a row fails. A throwaway page or test written for a row exists only inside the temporary worktree. A row that cannot run for lack of a tool, an install or a free port is `Blocked`. Check: after the script, `git worktree list` shows no new entry and no process of the script remains.
- R6. The record's `Version:` is the merge commit of the pull request that delivered TOKI-012, `80b962b` (#136) (concern 1), and every row is judged at it. PR #136 delivered it: it is the merge of the branch `feat/toki-012-base-components-group-1` on 2026-11-18, it adds the nine component folders, `base.css`, the lint rule and its fixtures and the two imports of `apps/web`, and no later commit landed the same work again. The result notes say, for a row that would give a different answer on the current `main`, what changed since and which later ticket changed it, without judging it (for example the components, the exports and the examples of later tickets in `packages/ui-web`). Check: `Version:` is that commit, and every row's evidence line names it.
- R7. A requirement that the spec of TOKI-012 judges by eye, and not by a value, gets a row of the layer `manual`: the look of each state of the eight components against the prototype in Calm and Focus (at 1280 px and at 360 px) and the reading of the accessible names with a screen reader. The row says what the QA looks at and what counts as a match; it stays `Blocked` until the QA pastes the result and the evidence, and is never `Pass` on a command's output. A requirement that a command can measure (the declarations of a style sheet, the height at a narrow width) gets a `command` row, and when it is a browser measure the command drives Chromium with Playwright against the built or dev app of the temporary worktree. Check: every `manual` row has the QA's name in `Approved` before it is run, and none is `Pass` without a pasted result.
- R8. `bash .github/scripts/trace.sh` is run after the record exists and `docs/traceability.md` is committed with it. Check: the TOKI-012 row shows the requirements covered and the rows passed over the rows, and no other row changes except where a spec merged since the last run adds one.
- R9. This work edits no existing file except `docs/traceability.md` (regenerated). The intent and spec of TOKI-012, the files that TOKI-012 delivered, the three scripts of the flow and their tests are not changed. Check: `git diff` of the pull request shows added files and the regenerated table only.
- R10. The tracker is not changed by this work beyond the ticket's own status. TOKI-012 stays Done; if a row fails the record says so and the BA decides whether to reopen it or to amend its spec. Evidence holds no secret, token or personal data, and the record names the role (Dev, QA or BA) next to each name. Check: review of the pull request.

## Design
### How each requirement of TOKI-012 is tested
The checks read files of one commit `V`; rows that run a tool use a temporary worktree of `V` (R5). `Expected` is what the spec of TOKI-012 states, including the counts it fixes (nine exported components, 32 token names, 36 lint cases of which 21 violate and 15 are allowed). Requirements are grouped by the way they are checked; the plan of the ticket turns each group into rows, one for each behavior (R2), about 11 groups and 40 rows.

| TOKI-012 | Row and what it compares | Layer | Needs |
| :---- | :---- | :---- | :---- |
| R1, R31 | the nine names of R1 and the constants of R2 are exported by `components/index.ts` and `src/index.ts`; each folder holds its five files (the two exceptions `ChipGroup` and `Select` as the spec says); no export ends in `Icon` except TOKI-011's; adding a component needs its folder, one line in `components/index.ts` and one import and entry in `src/examples.ts` and no other shared file | command | files, install, Vitest |
| R2, R30 | the prop convention (unions and constants in the stated order, `className` after the own classes, `forwardRef` to the element of Table B, owned attributes win over the spread); the twelve mistakes of R30 are type errors found by `pnpm typecheck`, each marked `@ts-expect-error` | command | install, Vitest, TypeScript |
| R3 | each component rendered with no text props and no children has an empty `textContent`; no source file under `src/components` imports `@toki/i18n` | command | install, Vitest |
| R4, R10, R11, R12 | `Button` and `IconButton`: element, `type`, classes and attributes of Table B for each variant and size; `link` renders `linkbtn` and not `btn`; `IconButton` has `aria-label` equal to `label` and one icon child | command | install, Vitest |
| R4, R13, R14, R19, R20 | `Chip` and `ChipGroup`, `Switch`, `Tag`, `Badge`: element, role, `aria-pressed` and `aria-checked`, `onChange(checked)` of `Switch`, the class of each `Badge` variant, the hidden digits and the `sr` label | command | install, Vitest |
| R4, R15, R16, R17, R18 | `Field` in its three forms, `Select` with its options and `wide`, the `gerr` box with `role="alert"` and the id `<id>-error`, `aria-invalid` and `aria-describedby` order, the `disabled` and `readonly` classes | command | install, Vitest |
| R5, R9 | each CSS file holds exactly the selectors and declarations of its table (the spec's tables typed into the CSS tests); `base.css` equals Table J; `package.json` has the `./base.css` and `./examples` exports; the sources import no CSS outside their own file | command | install, Vitest, files |
| R6, R7 | no colour literal and every `var(--name)` is one of the 32 properties of `tokens.css`; no `--row`, `--gap` or `--av`; no selector with `data-eff`, `data-look`, `data-accent` or `data-density`; every `:hover` rule declares only the four allowed properties; no `opacity: 0`, `visibility: hidden` or `display: none`; no `title` or `onMouseEnter` | command | files, install, Vitest |
| R8 | each CSS file holds one `@media (max-width: 719px)` block with the declarations of Table I; a Chromium page at 719 px and at 720 px renders the examples of the built or dev app of the temporary worktree and every control but the two named exceptions is at least 40 px tall at 719 px | command | install, Chromium, free port |
| R21 | each input component is a native control in the Tab order and skipped when `disabled`; Space and Enter activate `Button`, `Chip`, `IconButton` and `Switch`; no `tabindex` in a component source; `outline: 0` or `none` only on `.inp` and `.field input`; in Chromium a Tab key press reaches each example control | command | install, Vitest, Chromium |
| R22, R23, R24, R25 | `pnpm lint:boundaries` exits 0 with the rule in the block of `eslint.config.js`; the 36 fixture cases give 21 reports on `violates.tsx`, none on `allowed.tsx`, the line and the disable-comment report on `disabled.tsx`; with the rule switched off in a copy the same command fails and names the fixture; the block sets `error` for the non-test `.tsx` files of `ui-web/src` and `apps/web/src` and switches inline configuration off | command | install, ESLint |
| R26 | each `<Name>.examples.tsx` exports `examples`; each value of each union and each state has an example; ids are unique; the nine items that the preview page checks by selector are there; only `examples.ts` imports an examples file | command | install, Vitest |
| R27 | `pnpm --filter @toki/ui-web test` exits 0 with the `jsdom` environment, `globals` off and `src/test/setup.ts`; `readCss` returns the rules as `{ selector, media, declarations }`; a component rendered in two tests in a row is found once; one version of `jsdom` and of Vitest in the install | command | install, Vitest |
| R28 | `components` and `styles` import nothing from the five named packages and none of the APIs that TOKI-002 R9 bans; `pnpm lint`, `pnpm lint:boundaries`, `pnpm format:check` and `pnpm typecheck` exit 0 | command | install |
| R29 | `apps/web/package.json` lists the two packages under `dependencies` in the form of TOKI-001; `main.tsx` imports `fonts.css`, `tokens.css` and `base.css` in that order before every other import; `order.test.ts` passes; `pnpm --filter ./apps/web build` exits 0 and the built `dist` holds both sheets | command | install, build |
| R4, R5, R8 (look) | the look of each state of Tables C to H in Calm and Focus at 1280 px and 360 px beside the prototype; no decision draws the error, invalid, disabled and read-only states, so the QA records that they are as the tables say | manual | prototype, browser, QA |
| R21 (names) | Tab through every state of the examples and listen to the name of each icon-only button, the switch, a field with an error and the badge with and without `label` | manual | screen reader, QA |

Requirements that describe the repository when the ticket closed may no longer hold on `main`; the commit at which the rows are judged decides (concern 1). The prototype is not in the repository (concern 11 of the spec of TOKI-012), so the look rows are by eye and never `Pass` by a command (R7, concern 3).

### Layout
```
docs/
  qa/TOKI-012.md  TOKI-012.checks.sh  TOKI-012.evidence.txt
  traceability.md          (regenerated)
```

## Testing
- The scripts of the flow have their tests (`qa-ready.test.sh`, `acceptance-ready.test.sh`, `trace.test.sh`); this work runs them before and after and changes none.
- The checks script is run twice on the same commit: the lines are identical. A mutated copy of a file in the temporary worktree (a colour literal in a CSS file, a missing `label` in a fixture) makes the matching row fail, so a row is not vacuous.
- The worked run is the test: `qa-ready.sh TOKI-012` and `trace.sh` are run on the real files and what they print is read, not assumed. A row that fails stays in the record.
- The `manual` rows are run by the QA, who pastes the result; until then they are `Blocked` (R7).

## Data safety
- Evidence quotes counts, names and exit codes only. No `.env` file is read or created, and no secret, token or personal data is kept; tool output is not kept except the first error line of a refusal. Test texts of `ui-web` are made up and are not copied into the record.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| The flow and formats are those of the merged spec; no script or format changes | R1, R9 |
| Some requirements describe the repository at the close of the ticket, so the commit matters | R6, concern 1 |
| Rows need installs, a browser or a port, and must not change the repository | R3, R5, concern 2 |
| A row is Pass only with evidence at a named commit; a row that cannot be run is Blocked; no secret or personal data | R3, R4, R7, R10, Data safety |
| The merged intent and spec of TOKI-012 are not edited; nothing merges or pushes to `main` | R9, R10, Scope |

## Open questions from the intent
- At which commit are the rows judged: the merge commit of the pull request of TOKI-012, or the current `main`? Answered: the merge commit, `80b962b` (#136) (R6). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 1.
- May the checks use a temporary worktree with its own install, the local tools, a headless Chromium and free ports, isolated from the repository? Answered: yes, isolated, and removed at the end (R5). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 2.
- The spec asks for a look comparison with the prototype, by eye, in Calm and Focus, and a screen-reader pass. Neither can be run by a command. What do the rows do? Answered: a requirement that a command can measure is a `command` row driving Chromium with Playwright against the built or dev app of the temporary worktree; a requirement that is only a by-eye comparison with the prototype or a listening test is a `manual` row for the QA, `Blocked` until the QA pastes the result, never `Pass` (R7). Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 3.

## Areas of concern
1. The commit at which the rows are judged. Requirements of the spec of TOKI-012 describe the repository when the ticket closed, and later tickets changed it: `packages/ui-web` now holds the group 2 components, the overlays, the layout and screen pieces, and `eslint.config.js`, `apps/web/src/main.tsx` and the examples list have been edited since. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the rows are judged at the merge commit of the pull request that delivered the ticket, `80b962b` (#136), so the record proves the ticket as delivered; the repository as it stands is judged by the acceptance ticket of I02. Owner: Thanh Truong (QA).
2. Temporary worktree, install and local resources. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the script may create a temporary worktree of `80b962b`, run `pnpm install` there, use the local tools, the cached Chromium with Playwright and free local ports, isolated from the repository, and removes them at the end (R5); a row that cannot run for lack of a tool or a free port is `Blocked`. No throwaway pull request is opened; if CI evidence is needed, the run history is read with read-only `gh`. Owner: Thanh Truong (QA).
3. The look and the screen reader. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the look rows (Tables C to H against the prototype in Calm and Focus, at 1280 px and 360 px) and the screen-reader row are `manual` rows for the QA, `Blocked` until the QA pastes the result, never `Pass`; what a command can measure (the declarations of the style sheets, the 40 px heights at 719 px in Chromium) is a `command` row. Owner: Thanh Truong (QA).
4. One person holds Dev, QA and BA. Decided by Thanh Truong (lead, as product owner) on 2026-11-25: the role is named next to the name in each record, and a failure stays in the record while the BA decides whether to reopen the ticket (R10). Claude cannot read or create `.env`, so no row needs it (R5). Owner: Thanh Truong (BA).
