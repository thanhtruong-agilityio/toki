# Intent: Acceptance of milestone M1
Author: Thanh Truong

## Problem
Milestone M1 "Foundation and design system" has four outcomes: I16 claude-project-setup, I17 environment-config, I01 repo-foundation and I02 design-system. Each is going through the flow that runs after Dev (`docs/specs/2026-11-24-ba-qa-acceptance-design.md`): QA records for its tickets and an acceptance record. The milestone itself has one more step, its own record (`docs/acceptance/milestone-m1.md`, requirement R18 of that spec), which says whether the exit check the Blueprint gives for M1 holds. Nobody has written it, and `docs/traceability.md` has no milestone row.
The Blueprint states the goal of M1 as: "The project is set up for Claude, its configuration is known, and the repository, tooling and every base component exist, so later screens are assembled rather than invented." Its exit check reads: "pnpm dev runs, CI is green, and the component preview page passes its browser test (prototype class names, resolved colours in both looks, accent, density, the 719 and 720 px rules, fonts loaded, no sideways scroll at 360, 900 and 1280 px) and its by-eye comparison with the prototype is recorded in the pull request."
The milestone record can only be written after the four acceptance records exist, and the exit check needs evidence of its own: a part about `pnpm dev` and CI that the acceptance of I01 covers, a part about the browser test of the preview page that the acceptance of I02 covers, and a part about a by-eye comparison recorded in a pull request, which only a person can show.
Source: `docs/specs/2026-11-24-ba-qa-acceptance-design.md` (R18 and concern 6); `docs/acceptance/claude-project-setup.md`, `docs/acceptance/environment-config.md`, the records of I01 and I02; Blueprint plan, milestone M1 (goal and exit check).

## Proposed outcome
- M1 has a milestone record: its exit check copied as written, a result with evidence for each part of the check, and a verdict.
- The verdict is `Accepted` only when every outcome of M1 is `Accepted` and every part of the exit check has evidence; otherwise `Not accepted`, with the reason for each part and each outcome.
- The record shows where the chain from the milestone to its proof holds or breaks, and which outcomes block it.
Source: the requirement of this run; `docs/specs/2026-11-24-ba-qa-acceptance-design.md` (R18).

## Affected users and systems
- Users: the builder, who acts as Dev; the person who acts as QA and as BA.
- Systems: `docs/acceptance/`, `docs/traceability.md`, `acceptance-ready.sh`, `trace.sh`, the four outcome records and the pull request that carries the by-eye comparison.
Source: `docs/ticket-config.yml`.

## Constraints
- The flow and the record format are those of the merged spec; this work adds one milestone record and changes no script and no format.
- The record is written after the four outcome records exist and reads them; it does not re-judge an outcome.
- A part of the exit check is `Accepted` only with evidence; a part that cannot be shown is `Blocked`, never `Accepted`.
- No secret goes into the record. Nothing here merges a pull request or pushes to `main`; a person merges.
Source: the merged QA-acceptance spec (R9, R18); CLAUDE.md.

## Open questions
- The exit check has several parts joined by "and". How is it split into parts (`pnpm dev` runs; CI is green; the preview page passes its browser test; the by-eye comparison is recorded in the pull request), and does the list in brackets count as part of the third?
- "Recorded in the pull request": which pull request counts (the one that delivered the preview page, TOKI-016, or the one that merges the milestone), and what shows it is recorded (a comment, a section of the description)?
- If an outcome is `Not accepted`, can the milestone still be accepted by an explicit exception of the BA, or is the milestone then `Not accepted` by rule?
- Which commit are the exit check parts judged at, the same one as the outcome records (the head of `main` when they were run), or a later one?
