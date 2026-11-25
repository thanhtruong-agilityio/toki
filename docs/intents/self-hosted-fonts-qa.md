# Intent: QA of the self-hosted fonts
Author: Thanh Truong

## Problem
The ticket TOKI-010 (self-hosted fonts) is closed as Done, but nobody tested it against its spec. It is the second of the twelve tickets of the Blueprint outcome I02 design-system. The flow that runs after Dev (`docs/specs/2026-11-24-ba-qa-acceptance-design.md`) asks for a QA record for each ticket before the outcome is accepted; I16, I17 and I01 have gone through it. The lead chose on 2026-11-25 one QA ticket for each ticket of the outcome, then one ticket for the acceptance of the outcome.
So `docs/qa/TOKI-010.md` does not exist and `docs/traceability.md` shows "no QA record" for TOKI-010. It is not known whether the seven font files, the `@font-face` rules, the preload link, the source record, the check script and the built app behave as its spec of 18 requirements says, or whether they changed since. The spec names the folder `apps/web/src/fonts/`; the pull request that delivered the ticket put the files in `apps/web/assets/fonts/`.
Source: `docs/traceability.md` (TOKI-010 row); `docs/specs/2026-11-16-self-hosted-fonts-design.md`; Blueprint plan, intent I02 (twelve tickets, status draft).

## Proposed outcome
- TOKI-010 has a QA record: a test matrix with a row for each requirement of its spec, approved by the QA before it is run, with the result and the evidence of each row.
- Each row says at which commit it was judged: the merge commit of the pull request that delivered the ticket.
- If a requirement is not met, the record says which row failed and why, and the failure stays in the record.
- A requirement that only a person can judge by eye against the prototype is a manual row, never `Pass` until the QA records the result.
- The acceptance of I02 itself is not part of this work; it is written after the QA records of the outcome exist.
Source: the requirement of this run; `docs/specs/2026-11-24-ba-qa-acceptance-design.md` (R1 to R5, R10, R17).

## Affected users and systems
- Users: the builder, who acts as Dev; the person who acts as QA and as BA. Toki has one person on the project, so one person holds all three roles and the records name the role next to each name.
- Systems: `docs/qa/`, `docs/traceability.md`, the scripts `qa-ready.sh` and `trace.sh`, and the files that TOKI-010 delivered (`apps/web`: the fonts folder, `index.html`, `main.tsx`, `check-fonts.mjs`).
Source: `docs/ticket-config.yml`; `.claude/rules/ticket.md` ("After the merge").

## Constraints
- The flow and the record formats are those of the merged spec; this work adds records and changes no script and no format.
- Several requirements describe the repository when the ticket was closed, and later tickets legitimately changed it, so the commit at which a row is judged matters.
- Some rows need an install, a built app, a local server or a browser; they must not change the working tree of the repository.
- A row is `Pass` only with evidence at a named commit; a row that cannot be run is `Blocked`, never `Pass`. No secret, token or personal data goes into a record.
- The merged intent and spec of TOKI-010 are not edited. Nothing here merges a pull request or pushes to `main`; a person merges.
Source: the merged QA-acceptance spec (R3, R4, R9, Data safety); CLAUDE.md.

## Open questions
- At which commit are the rows judged: the merge commit of the pull request of TOKI-010, or the current `main`?
- May the checks use a temporary worktree and the local tools, browser and ports that the rows need?
- Some requirements are about how text looks in a browser (the rendered font, the shape of a title against the prototype). Which are checked by command and which by the QA's eye?
- The spec puts the fonts in `apps/web/src/fonts/` and says no file outside `apps/web` changes; the delivered ticket differs. How are such rows judged?
Source: the merged QA specs of I01 (`docs/specs/2026-11-25-web-skeleton-qa-design.md`); the delivering pull request of TOKI-010.
