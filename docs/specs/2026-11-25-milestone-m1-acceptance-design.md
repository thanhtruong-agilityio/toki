# Acceptance of milestone M1 design

Date: 2026-11-25 · Status: draft for review
Intent: docs/intents/milestone-m1-acceptance.md (Thanh Truong)
Ticket: TOKI-134

## Goal
The builder and the BA need to know whether milestone M1 "Foundation and design system" is reached. After this work M1 has a milestone record in the format of the parent spec (R18): the exit check of the Blueprint copied as written, one result for each part with its evidence, and a verdict that follows from the four outcome records (I16, I17, I01, I02) and from the parts of the exit check. It is the last ticket of the series that began with the QA of TOKI-001.

## Scope
- In:
  - The milestone record `docs/acceptance/milestone-m1.md` (R1 to R5).
  - The regenerated `docs/traceability.md` (R6).
- Out (not now):
  - The QA and acceptance of the four outcomes; they are separate tickets and are inputs here.
  - Any change to the scripts of the flow, the record formats, the outcome records or the QA records (R7).
  - Reopening a ticket or an outcome on the tracker; the BA decides.
  - M2 and later milestones.

## Requirements
- R1. `docs/acceptance/milestone-m1.md` is a milestone record in the format of the parent spec (R18): header `Milestone: M1` and `Outcomes:` (the slugs of the four acceptance records: `claude-project-setup`, `environment-config`, `repo-foundation`, `design-system`); sections `## Exit check` (EC1, EC2, ...), `## Results` with the columns `EC`, `Evidence`, `Verdict`, `Reason`, one row for each part, and `## Verdict`. Check: `bash .github/scripts/acceptance-ready.sh milestone-m1` reports no gap other than those the outcome records cause.
- R2. `## Exit check` copies the Blueprint exit check of M1 as written and splits it into numbered yes-or-no parts without changing its meaning (concern 1): `pnpm dev` runs; CI is green; the component preview page passes its browser test; its by-eye comparison with the prototype is recorded in the pull request. The text in brackets (prototype class names, resolved colours in both looks, accent, density, the 719 and 720 px rules, fonts loaded, no sideways scroll at 360, 900 and 1280 px) is kept in the third part as the list that the browser test covers.
- R3. Each `Results` row cites its evidence: an outcome record (`design-system` and its criteria), the checks of an outcome record (for example the lines of `docs/acceptance/repo-foundation.evidence.txt`), and for the fourth part the pull request that records the by-eye comparison (concern 2). Every evidence cell names the commit it was read at. Check: every cell names a record or a line, and a commit.
- R4. The verdict is `Accepted` only when every outcome listed in the header is `Accepted` in its own record and every part of the exit check has evidence; otherwise `Not accepted` with the reason for each part and each outcome that blocks it (concern 3). It is drafted by Claude and marked `By: BA, pending <name>` until the BA confirms it. `acceptance-ready.sh milestone-m1` reads it with the rules of the parent spec.
- R5. The record is written only after the four outcome records exist on `main`, and reads them as they are; it does not re-judge an outcome. The commit at which the parts that need their own check are judged is named in each cell (concern 4).
- R6. `bash .github/scripts/trace.sh` is run after the record exists and `docs/traceability.md` is committed with it. Check: no other row of the file changes except where a spec merged since the last run adds one.
- R7. This work edits no existing file except `docs/traceability.md` (regenerated). The outcome records, the QA records, the three scripts and their tests are not changed. Check: `git diff` of the pull request shows added files and the regenerated table only.
- R8. The record holds no secret, token or personal data, and the tracker is not changed beyond the ticket's own status.

## Design
### Exit check parts and where their evidence comes from
| Part (draft, concern 1) | Evidence |
| :---- | :---- |
| EC1. `pnpm dev` runs | SC1 of the record of I01 (`docs/acceptance/repo-foundation.md`) |
| EC2. CI is green | SC2 of the record of I01 |
| EC3. The component preview page passes its browser test | The machine part of SC1 of the record of I02 (`docs/acceptance/design-system.md`), which runs the browser test at a named commit |
| EC4. Its by-eye comparison with the prototype is recorded in the pull request | The pull request named in concern 2, read with `gh` (a comment or a section of the description) |

### Layout
```
docs/
  acceptance/milestone-m1.md
  traceability.md          (regenerated)
```

## Testing
- The scripts of the flow have their tests, run before and after and unchanged. `acceptance-ready.sh milestone-m1` and `trace.sh` are run on the real files and what they print is read.

## Data safety
- The record quotes names, counts and commit ids only.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| The flow and the format are those of the merged spec; no script or format changes | R1, R7 |
| The record reads the outcome records and does not re-judge them | R5 |
| A part is Accepted only with evidence; a part that cannot be shown is Blocked | R3, R4 |
| No secret; nothing merges or pushes to `main` | R8; a person merges |

## Open questions from the intent
- How is the exit check split into parts? Answered: as drafted in concern 1. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 1.
- Which pull request records the by-eye comparison, and what shows it? Answered: as drafted in concern 2. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 2.
- If an outcome is Not accepted, can the BA accept the milestone by an exception? Answered: as drafted in concern 3. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 3.
- At which commit are the parts judged? Answered: as drafted in concern 4. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. See concern 4.

## Areas of concern
1. The split of the exit check. The draft in Design takes four parts and keeps the bracketed list in the third. Decided: as drafted. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. Owner: Thanh Truong (BA).
2. "Recorded in the pull request". The draft: the pull request that delivered the preview page (TOKI-016), where the by-eye comparison is a comment or a section of the description; if it is not there the fourth part is Blocked and the milestone is not accepted. Decided: as drafted. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. Owner: Thanh Truong (BA).
3. An outcome that is not accepted. The rule of the parent spec (R18) makes the milestone Accepted only when every outcome is Accepted; the draft keeps it, with no exception. Decided: as drafted. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. Owner: Thanh Truong (BA).
4. The commit of the evidence. The draft: the parts are read from the outcome records, which name their commit, and any part that needs its own check is judged at the head of `main` on the day the record is written, named in the cell. Decided: as drafted. Decided by Thanh Truong (lead, as product owner) on 2026-11-25. Owner: Thanh Truong (BA).
