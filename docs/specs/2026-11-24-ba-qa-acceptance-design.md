# BA-QA acceptance after Dev design

Date: 2026-11-24 · Status: draft for review
Intent: docs/intents/ba-qa-acceptance.md (Thanh Truong)
Ticket: TOKI-110

## Goal
The builder (Thanh and Claude, acting as Dev), the QA and the BA need a flow after the merge that says whether the work is good and whether the business outcome was reached. Today a ticket is Done when its pull request is merged; all 22 tickets of M1 closed that way and none was tested by anyone but its author's own tests. After this change a ticket is Done only when QA has run approved test cases against it and recorded the results, and an outcome (a Blueprint intent such as I01 repo-foundation) is accepted only when the BA has checked its original Success Criteria against those results. Every link from the outcome to the proof is written in the repository, so a reader can follow it and see where it breaks.

## Scope
- In:
  - Three record formats: the QA record of a ticket (`docs/qa/<KEY>.md`, R1 to R5), the acceptance record of an outcome (`docs/acceptance/<slug>.md`, R6 to R9) and the record of a milestone (`docs/acceptance/milestone-<m>.md`, R18).
  - The statuses a ticket passes after the merge and what each needs (R10, R11).
  - Three scripts that read the records and report gaps, with no network and no model: `qa-ready.sh`, `acceptance-ready.sh`, `trace.sh` (R12 to R14).
  - The changes to `docs/definition-of-done.md`, `docs/ticket-config.yml` and the rule files (R15, R16).
  - One worked example taken through the whole flow: the Blueprint intent I16 claude-project-setup and its one ticket, TOKI-095 (R17).
- Out (not now):
  - Test matrices and acceptance for the other M1 tickets and for M2 and later, and the record of the M1 milestone itself. They are follow-up work, one intent, spec and ticket for each of I01, I02 and I17, then the milestone record (concern 9).
  - Editing the 22 merged intents and specs of M1. The flow reads them as they are.
  - A change to the plugins `cl-core`, `cl-dev` and `cl-ba-qa` (outside this repository). Where a skill writes its output somewhere else (the `Test matrix` comment of `cl-ba-qa:test-matrix`), this flow copies the repository file to that place (R5).
  - Blocking a GitHub issue from being closed, or a workflow that reopens one; the flow is visible and not binding for now (concern 8).
  - Test automation written for the tickets that have none. A test case may point to an existing automated test (R3); it does not require a new one.

## Requirements
- R1. A QA record is a file `docs/qa/<KEY>.md` (for example `docs/qa/TOKI-095.md`). Its header has `Ticket:` (the key), `Spec:` (the path of the ticket's spec, which must exist), `Version:` (the commit tested) and `Environment:` (where it was run). Its body has a test matrix with one row for each test case and the columns `ID`, `Requirement`, `Layer`, `Steps`, `Expected`, `Evidence`, `Priority`, `Approved`, `Result`, `Run`. Check: `qa-ready.sh` reports a record with a missing header line or column.
- R2. Every requirement of the ticket's spec (`R1`, `R2`, ... in its Requirements section) has at least one row, or an entry under a section `## Not covered` with the reason. A row names one requirement and one behavior. Check: a spec with R1 to R4 and a record with rows for R1, R2 and R4 gives one gap, "R3 has no test case and no reason".
- R3. `Layer` is `unit`, `integration`, `api`, `e2e`, `command` (a command whose output is checked) or `manual`, and the lowest layer that can prove the row is used (the rule of `cl-ba-qa:test-matrix`). `Expected` is a concrete value or output, never "works" or "displays correctly". `Evidence` is, for an automated case, the test file and test name and the CI run or command output at `Version:`; for a manual case, the path of a screenshot or log kept in the pull request or on the ticket. A row whose Evidence is empty cannot be Pass. Check: `qa-ready.sh` reports a Pass row with no Evidence.
- R4. `Approved` holds the name of the person acting as QA and the date. A row that is not approved is not run. `Result` is `Pass`, `Fail` or `Blocked`; Blocked is never counted as Pass. `Run` holds the date and the name of who ran it. Check: `qa-ready.sh` reports a row with a Result and no Approved, and counts Blocked as not passed.
- R5. The QA record in the repository is the source of truth. A copy goes on the ticket as one comment titled `Test matrix` (when drafted) and one titled `QA result` (when run); if the comment and the file differ, the file wins. Evidence contains no customer data or secrets. Check: the review of the pull request that adds the record (the check is by a person, as the spec of TOKI-095 does for secrets).
- R6. An acceptance record is a file `docs/acceptance/<slug>.md`, where `<slug>` is the slug of the Blueprint intent (`repo-foundation`, `design-system`, `claude-project-setup`, `environment-config`, ...). Its header has `Outcome:` (the Blueprint id, for example `I16`), `Milestone:` and `Tickets:` (the keys, as the Blueprint plan lists them). Its body has, in this order, `## Success Criteria`, `## Confirmed`, `## Results` and `## Verdict`. Check: `acceptance-ready.sh` reports a missing header line or section.
- R7. `## Success Criteria` lists SC1, SC2, ... each one a statement that a person can answer yes or no to, with its source: the `done` line of the Blueprint intent, split into separate items without changing its meaning (concern 4). `## Confirmed` holds the name of the BA and the date; it is written before any ticket of the outcome passes QA. A criterion changed or added after that date is listed under `## Changes to the criteria` with the date and the reason, and acceptance judges the criteria as first confirmed plus those changes shown beside them. Check: `acceptance-ready.sh` reports an acceptance whose Confirmed date is later than the Run date of one of its tickets' rows, and one with no Confirmed line.
- R8. `## Results` has one row for each criterion: `SC`, `Tickets` (the keys that deliver it), `Evidence` (the QA rows, by ticket and id, or other proof), `Verdict` (`Accepted` or `Not accepted`) and `Reason`. A criterion with no ticket or no evidence cannot be Accepted. Check: `acceptance-ready.sh` reports an Accepted row with no ticket, one whose ticket has no QA record, and one that cites a row that does not exist.
- R9. `## Verdict` is `Accepted` only when every criterion is Accepted and every ticket in the header passes `qa-ready.sh`; otherwise it is `Not accepted` or `Pending`. The role that decides is written next to it (`By: BA, <name>`). When one criterion is `Not accepted`, the ticket listed against it is reopened (`In Progress`, label `reopened`) and its fix is a new pull request on that ticket; the QA record is run again and the criterion is judged again, the earlier verdict being kept in `## Results` with its date (concern 5). Check: `acceptance-ready.sh` exits 1 for an `Accepted` verdict with a gap and exits 0 for one with none.
- R10. After the merge of its pull request a ticket is `In QA`; it is `Done` only when its QA record passes `qa-ready.sh` (every row Pass, none Blocked, every requirement covered or excused). A ticket that fails goes back to `In Progress` with the label `reopened`; the fix is a new pull request on the same ticket and the QA record is run again, the earlier results being kept in the record with their dates. A ticket that was closed as Done before this change stays Done; its QA record is added beside it, and until it exists `trace.sh` shows "no QA record" for it (concern 2). Check: the rule is in `docs/definition-of-done.md` and `.claude/rules/ticket.md` (R15, R16); a ticket with a Fail row is reported by `qa-ready.sh` as not passed.
- R11. A ticket whose change no user sees (CI, hooks, configuration, tooling) goes through the same flow; its rows use the `command` layer (a command and its expected output) or point to a check that already runs in CI. Check: the worked example of R17 is such a ticket and passes the flow.
- R12. `.github/scripts/qa-ready.sh <KEY>` reads `docs/qa/<KEY>.md` and the spec it names, and prints one "- " line for each gap of R1 to R4. Exit 0 when there is none, 1 when there are gaps, 2 for wrong usage (as `spec-ready.sh`). It makes no network call and uses no model. Check: its test (`qa-ready.test.sh`) holds one fixture for each gap and one for a clean record.
- R13. `.github/scripts/acceptance-ready.sh <slug>` reads `docs/acceptance/<slug>.md` and the QA records of its tickets, and prints one "- " line for each gap of R6 to R9, with the same exits and the same limits as R12. With the option `--ready` it prints only whether the outcome can be accepted now (every ticket of the header passes `qa-ready.sh`), which is the list the BA works from. Check: its test (`acceptance-ready.test.sh`) holds one fixture for each gap, one clean and one `--ready` case.
- R14. `.github/scripts/trace.sh` writes `docs/traceability.md`: one row for each ticket that has a spec, with the outcome, the intent file, the spec file, the key, the requirements covered over the requirements in the spec, the rows passed over the rows, and the verdict of the acceptance that lists it. Where a link is missing it writes the name of the missing link ("no QA record", "no acceptance") and does not guess. It reads only files of the repository. Check: its test (`trace.test.sh`) runs it on a fixture tree with a complete chain, a chain with no QA record and a chain with no acceptance, and compares the output.
- R15. `docs/definition-of-done.md` gains the lines: the QA record of the ticket passes `qa-ready.sh`; the outcome's acceptance record lists the ticket. `docs/ticket-config.yml` records, under `qa:`, the directory of the QA records and the directory of the acceptance records, and says that `in-qa` follows `in-review` and precedes `done`. The statuses and labels already there are used; none is renamed. Check: a diff shows the added lines only, and the existing script tests still pass.
- R16. The rule files say, with their source, where the records live and what each status needs: `.claude/rules/ticket.md` (the flow after the merge) and `.claude/rules/specs.md` (the Success Criteria of an outcome are written in its acceptance record and confirmed before its tickets are tested; the one-ticket intent files get no new section and are not edited, concern 7). `CLAUDE.md` "Commands" lists the three scripts and their tests. Check: a reader of the rule files finds each path and command named in this spec.
- R17. As the worked example, the Blueprint intent I16 claude-project-setup is taken through the flow for TOKI-095: `docs/qa/TOKI-095.md` with a test matrix for each requirement of the spec `docs/specs/2026-11-12-claude-project-setup-design.md`, run by the QA, and `docs/acceptance/claude-project-setup.md` with the Success Criteria confirmed before the run and the verdict written after it. If a row fails, the failure stays in the record and the verdict is `Not accepted`. `docs/traceability.md` is generated from them. Check: `qa-ready.sh TOKI-095` and `acceptance-ready.sh claude-project-setup` print what is true of the records, with no gap that was left unreported.
- R18. A milestone has its own record after its outcomes (concern 6): `docs/acceptance/milestone-<m>.md` (for example `milestone-m1.md`) with the header `Milestone:` and `Outcomes:` (the slugs of its acceptance records), and the sections `## Exit check` (the Blueprint's exit check for the milestone, copied as written), `## Results` (one row for each part of the check with its evidence) and `## Verdict`. It is `Accepted` only when every listed outcome is `Accepted` and every part of the exit check has evidence; `acceptance-ready.sh milestone-<m>` reads it with the rules of R9. The record of M1 is written in the follow-up work (concern 9), not in this ticket. Check: `acceptance-ready.test.sh` holds one clean milestone fixture, one with an outcome that is not accepted and one with an exit-check part that has no evidence.

## Design
### Data model
Plain Markdown files in the repository; the tracker holds only a copy (R5).

| Record | Path | Written by | Read by |
|---|---|---|---|
| QA record | `docs/qa/<KEY>.md` | Claude drafts the matrix; the QA approves it and runs it (`cl-ba-qa:test-matrix`, `cl-ba-qa:verify-fix`) | `qa-ready.sh`, `acceptance-ready.sh`, `trace.sh` |
| Acceptance record | `docs/acceptance/<slug>.md` | The BA writes the criteria, confirms them, then the verdict | `acceptance-ready.sh`, `trace.sh` |
| Traceability table | `docs/traceability.md` | `trace.sh` | people |

The chain that `trace.sh` follows: outcome (acceptance record `Outcome:`) → tickets (its `Tickets:`) → the intent and the spec (`Ticket:` line of the spec, `Intent:` line to the intent file) → requirements (`R<n>` of the spec) → test rows (`docs/qa/<KEY>.md`, column `Requirement`) → results → verdict. Blueprint requirement ids (FR, AC-nnn, TS-nnn) are not used by the M1 outcomes, because the Blueprint plan lists no functional requirement for them (its `frs` for M1 is empty; the measures are in the NFR list and the milestone exit check). A spec of a later milestone may cite them in a row's `Requirement` column beside its own `R<n>`.

### The flow after Dev
1. PR merged → ticket `In QA` (R10).
2. Claude drafts the matrix from the spec; the QA approves rows (R3, R4).
3. The QA runs the rows, by hand or with the automation the repository already has; results and evidence go in the record (R3, R4).
4. `qa-ready.sh` passes → the QA moves the ticket to `Done`. A Fail → `In Progress`, label `reopened` (R10).
5. When every ticket of an outcome is Done, `acceptance-ready.sh --ready` says so; the BA fills `## Results` and `## Verdict` (R8, R9).
6. After the last outcome of a milestone is accepted, the milestone record is written and its exit check is run (R18, concern 6).

### Layout
```
docs/
  qa/<KEY>.md
  acceptance/<slug>.md
  traceability.md          (generated)
.github/scripts/
  qa-ready.sh   qa-ready.test.sh
  acceptance-ready.sh   acceptance-ready.test.sh
  trace.sh   trace.test.sh
```

## Testing
- Each script has a bash test next to it, in the style of `spec-ready.test.sh`: a temporary directory with fixture records and specs, one case for each gap and one clean case, with the expected lines and exit code. Fixtures are made up; no real ticket text.
- The worked example (R17) is the test of the whole flow: it is run by the QA with the real repository and its result is read, not assumed.
- The existing tests (`spec-ready.test.sh`, `review-request.test.sh`, `changed.test.sh`) are run before and after; none changes.

## Data safety
- Evidence (screenshots, logs, command output) carries no secrets, tokens, `.env` contents or customer data; where a run prints one, the row quotes the part that matters only (R5).

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Intent → Spec → Ticket → Test → Acceptance, each link by an identifier in the repository | R1, R2, R6, R8, R14, Design "Data model" |
| Success Criteria come from the intent as first written; the Blueprint `done` lines are drafts the person accepting must confirm | R7 (the `done` lines split into items, confirmed and dated before testing; later changes shown beside), concern 4 |
| Each intent states its Success Criteria in the repository at the time it is written | R6, R7 at the level of the Blueprint outcome (concern 7); the one-ticket intent files are not edited |
| A tracker status is only a copy; files decide; no decision on a label alone | R5, R10 (the records decide), concern 8 |
| `spec-ready.sh` and the `Spec ticket` workflow keep working; merged specs do not break | R15 (existing tests run before and after), Scope (no merged spec or intent edited) |
| Nothing merges a pull request or pushes to `main` | Scope; the flow is records and scripts and merging stays with a person |
| Pilot on M1 only | Scope, R17 (one outcome of M1 as the worked example), R18, concern 9 |
| No customer data or secrets in test evidence | R5, Data safety |

## Open questions from the intent
- Toki has one person on the project. May the person who built a ticket also be its QA and the BA who accepts its intent? Answered: yes, one person, with the role written beside each name in the records. Decided by Thanh Truong (lead, as product owner) on 2026-11-24. See concern 1.
- The 22 M1 tickets are already closed and Done. Do they go back to In QA, or stay Done and carry a separate QA result? Answered: they stay Done and a QA record is added beside each. Decided by Thanh Truong (lead, as product owner) on 2026-11-24. See concern 2.
- Does every ticket need QA, or only those with behavior a user sees? Answered: every ticket, with the `command` layer for a change no user sees (R11). Decided by Thanh Truong (lead, as product owner) on 2026-11-24. See concern 3.
- Are the Blueprint `done` lines of I01, I02, I16 and I17 accepted as the Success Criteria, or does the BA rewrite them first? Answered: accepted as written, split into testable items, and confirmed before any run (R7). Decided by Thanh Truong (lead, as product owner) on 2026-11-24. See concern 4.
- When acceptance of an outcome fails for one criterion, is the ticket reopened or is a new ticket written, and who decides? Answered: the ticket that owns the criterion is reopened (R9). Decided by Thanh Truong (lead, as product owner) on 2026-11-24. See concern 5.
- Is the milestone exit check part of the intents' acceptance, or a step after the last intent? Answered: its own record after the outcomes (R18). Decided by Thanh Truong (lead, as product owner) on 2026-11-24. See concern 6.

## Areas of concern
1. Who holds the roles. One person is Dev, QA and BA. The records show the role next to each name (`Approved`, `Run`, `By:`), so the three decisions are written as three, though nothing stops one person making all of them. Decided by Thanh Truong (lead, as product owner) on 2026-11-24: one person may hold all three roles, and the records name the role that decided. Owner: Thanh Truong.
2. The 22 M1 tickets are closed and Done. Decided by Thanh Truong (lead, as product owner) on 2026-11-24: they stay Done and a QA record is added beside each; until it exists `trace.sh` shows "no QA record" for them (R10). "Done" therefore means "merged" for tickets closed before this change and "QA passed" after it, until the M1 follow-up work is finished. Owner: Thanh Truong.
3. Tickets that change nothing a user sees (CI, hooks, configuration, tooling). Decided by Thanh Truong (lead, as product owner) on 2026-11-24: they pass QA like the rest, with rows in the `command` layer or pointing to a check that already runs in CI (R11). The cost is a matrix for each of them. Owner: Thanh Truong.
4. The Success Criteria of the four M1 outcomes. The Blueprint `done` lines are drafts written before the specs (the Blueprint plan marks the intents `draft`); the one for I02 reads "the component preview page matches the prototype", which TOKI-109 (the UI parity check) is meant to check by machine. Decided by Thanh Truong (lead, as product owner) on 2026-11-24: they are accepted as written, split into separate yes-or-no items without changing their meaning, and confirmed by the BA before any ticket of the outcome is run (R7). Owner: Thanh Truong.
5. A failed acceptance. Decided by Thanh Truong (lead, as product owner) on 2026-11-24: the ticket listed against the unmet criterion is reopened (`In Progress`, label `reopened`), its fix is a new pull request on that ticket, and the criterion is judged again (R9). Owner: Thanh Truong.
6. The milestone exit check. Decided by Thanh Truong (lead, as product owner) on 2026-11-24: it has its own record, `docs/acceptance/milestone-<m>.md`, written after the last outcome of the milestone is accepted; it is not a criterion of any outcome (R18). Owner: Thanh Truong.
7. What "intent" means. In the repository an intent file has one spec and one ticket (for example `docs/intents/monorepo-typescript-setup.md` and TOKI-001); the Blueprint's intents (I01 repo-foundation, with TOKI-001 to 008) group tickets and are not files. Decided by Thanh Truong (lead, as product owner) on 2026-11-24: acceptance is written for the Blueprint outcome only (R6); the one-ticket intent files get no Success Criteria section and no acceptance record of their own, and their tickets are judged by QA (R10). This differs from the intent's line "each intent states its Success Criteria": here the outcome's acceptance record states them, confirmed before testing. Owner: Thanh Truong.
8. Enforcement. The repository has no workflow that sets `In QA` or `Done`, and GitHub cannot refuse to close an issue (searched in `.github/` and `.claude/` of this repository and in the cl plugins; nothing found). Decided by Thanh Truong (lead, as product owner) on 2026-11-24: visible only for now: the scripts report gaps and nothing blocks or reopens; a check can be added by a later ticket if gaps appear. Owner: Thanh Truong.
9. Size and the pilot. Decided by Thanh Truong (lead, as product owner) on 2026-11-24: this ticket holds the formats, the three scripts, the rule changes and the worked example (R17); the QA records of the other 21 M1 tickets, the acceptance of I01, I02 and I17 and the record of M1 are follow-up work, one intent, spec and ticket for each outcome. Owner: Thanh Truong.
10. Where the matrix lives. `cl-ba-qa:test-matrix` posts the matrix as a ticket comment; this spec keeps the file in the repository and copies it to the ticket (R5), because the repository decides (`CLAUDE.md`). Accepted in this spec: it is a choice for the design, not a product decision; if the plugin cannot copy the file, the copy is pasted by hand. Owner: Thanh Truong.
