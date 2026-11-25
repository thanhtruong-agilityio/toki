# Intent: Acceptance of the design system
Author: Thanh Truong

## Problem
The twelve tickets of the Blueprint outcome I02 design-system (TOKI-009 the tokens package, TOKI-010 self-hosted fonts, TOKI-011 the icon set, TOKI-012 and TOKI-013 the base components, TOKI-014 overlays, TOKI-015 the AppShell, TOKI-016 the component preview page, TOKI-017 the i18n package, TOKI-018 the platform package, TOKI-093 the destructive-action and unsaved-form patterns, TOKI-094 the shared date and time rules) are closed as Done. Each is getting a QA record (`docs/qa/TOKI-009.md` and the others, tickets TOKI-121 to TOKI-132), but nobody has judged the outcome itself. The flow that runs after Dev (`docs/specs/2026-11-24-ba-qa-acceptance-design.md`) says a ticket is Done only after QA passes and the BA then accepts the outcome against its original Success Criteria; I16, I17 and I01 went through it.
The Blueprint states the outcome in one line (its `done` line): "The component preview page matches the prototype; the Undo, confirmation and date-rule patterns exist". The QA records will not be enough on their own:
- Every QA row is judged at the merge commit of its ticket, and later tickets changed the repository (for example the unit tests moved into `tests/` folders and the preview page gained sections), so the outcome has to be judged on the repository as it stands.
- "Matches the prototype" is a by-eye comparison, and the prototype's HTML is not in the repository (it was added and removed), so the QA rows for it are `manual` and `Blocked` until the QA supplies the comparison.
- Several QA rows are expected to fail or be Blocked for reasons that may or may not touch the line (paths that moved, a script that was dropped, tests that were `fixme` until the fonts arrived).
So it is not known whether I02 is reached on the repository as it stands today.
Source: `docs/traceability.md` (rows TOKI-009 to TOKI-018, TOKI-093, TOKI-094); the QA specs TOKI-121 to TOKI-132 (concern 1: the repository as it stands is judged by the acceptance of I02); `docs/specs/2026-11-24-ba-qa-acceptance-design.md` (R6 to R9, R17); Blueprint plan, intent I02 (`done` line, status draft).

## Proposed outcome
- I02 has an acceptance record: its Success Criteria, taken from the Blueprint `done` line and confirmed by the BA before anything is run, and a verdict for each criterion with its reason, then an overall verdict.
- Each criterion cites its evidence: QA rows that still hold and new checks on the repository as it stands, each at a named commit; the by-eye comparison with the prototype is the QA's own and is recorded as such.
- The record says how each failed or Blocked QA row bears on the outcome, so a failure is neither hidden nor counted twice.
- If a criterion is not met the verdict is `Not accepted`, says which one and why, and the failure stays in the record.
- The record of milestone M1 is not part of this work; it follows.
Source: the requirement of this run; `docs/specs/2026-11-24-ba-qa-acceptance-design.md` (R6 to R9).

## Affected users and systems
- Users: the builder, who acts as Dev; the person who acts as QA and as BA (one person holds the three roles; the records name the role).
- Systems: `docs/acceptance/`, `docs/traceability.md`, `acceptance-ready.sh`, `trace.sh`, the QA records of the twelve tickets, and the repository as it stands (`main`), including the component preview page and its browser test.
Source: `docs/ticket-config.yml`; `.claude/rules/ticket.md` ("After the merge").

## Constraints
- The flow and the record format are those of the merged spec; this work adds one acceptance record and changes no script and no format.
- Success Criteria are confirmed before any check is run; a criterion added later is shown beside the first ones.
- Claude cannot read or create `.env`; no secret goes into a record. A comparison that only the person can make (the look against the prototype) is theirs and is `Blocked` until they paste it.
- The twelve QA records and their specs are not edited; a QA result that no longer holds is reported, not rewritten.
- A criterion is `Accepted` only with evidence at a named commit; a check that cannot be run is `Blocked`, never `Accepted`.
- Nothing here merges a pull request or pushes to `main`; a person merges.
Source: the merged QA-acceptance spec (R3, R4, R9, Data safety); CLAUDE.md.

## Open questions
- The `done` line has two statements and the second names three patterns. Is it split into four criteria (the preview page matches the prototype; the Undo pattern exists; the confirmation pattern exists; the date-rule pattern exists), or into fewer?
- At which commit are the criteria judged: `main` as it stands on the day of the acceptance, as for I01?
- Do the failed and Blocked QA rows stop a criterion from being accepted, or only those that bear on its statement, and who decides which bear on it, as for I01?
- "Matches the prototype" is a by-eye comparison and the prototype file is not in the repository. Does the QA make that comparison in their own browser from the prototype they hold and paste the result, or is the criterion `Blocked` and not accepted until then?
- The M1 exit check asks that the preview page passes its browser test. Does the acceptance of I02 run that browser test at the commit it judges, or rely on the QA row of TOKI-016?
