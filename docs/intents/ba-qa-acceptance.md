# Intent: BA-QA acceptance after Dev
Author: Thanh Truong

## Problem
In Toki today a ticket is Done as soon as its pull request is merged and the issue closes. All 22 tickets of milestone M1 (TOKI-001 to 018, 093, 094, 095, 096) are closed with the label Done; none went through In QA, and none has a test matrix. The definition of done (`docs/definition-of-done.md`) stops at the code: a test covers the change, CI is green, a person reviewed it. Nobody checks the finished work against what the intent asked for.
So "Dev finished the tickets" is read as "the intent is finished". An intent is a business outcome, and a ticket is a piece of work toward it. All tickets of an intent can be merged and the outcome still not be there.
The chain from the business need to the proof is also broken in the repository. The intents have no Success Criteria section (only "Proposed outcome"); the one-line `done` of each intent exists only in the Blueprint plan. The specs do not point to the acceptance criteria and test scenarios the Blueprint holds (FR, AC-nnn, TS-nnn). Nothing records that a person looked at an intent's outcome and accepted it.
Source: `docs/ticket-config.yml` (status `in-qa` exists, nothing routes a ticket to it); `docs/definition-of-done.md`; the 22 M1 issues on GitHub (all closed, label Done); Blueprint plan, intents I01, I02, I16, I17 (`done` lines) and `frs[].acs[].tests[]`.

## Proposed outcome
- A ticket is Done only when QA has passed it. Merged and deployed to a test environment is "In QA", not Done.
- QA tests each ticket against test cases that were written and approved before the test, and the result (pass, fail, blocked) with its evidence is recorded where the ticket is.
- When every ticket of an intent has passed QA, the BA (business analyst) reviews the intent against its original Success Criteria and records "accepted" or "not accepted", with the reason, for each criterion.
- Anyone can follow one line from an intent, to its spec, to its tickets, to the tests that proved them, to the acceptance record, and can see where the line is broken.
- Each intent states its Success Criteria in the repository, at the time it is written, so acceptance is judged against what was asked and not against what was built.
- Milestone M1 is taken through this flow as the first proof: its 22 tickets are tested and its four intents accepted, or the gaps are listed.
Source: the requirement of this run.

## Affected users and systems
- Users: the builder (Thanh and Claude), who acts as Dev, and the person who acts as QA and as BA. Toki has one person on the project today (Thanh), so one person may hold several of these roles; the flow must still record which role decided. End users of Toki are not affected.
- Systems: the intents and specs in the repository; the tracker (GitHub issues and their status labels); the definition of done; the `cl-ba-qa` skills (test matrix, verify-fix) and the `Spec ticket` workflow.
Source: `docs/ticket-config.yml` (`lead.blocked_owner` names one person for every role); `.github/workflows/spec-ticket.yml`.

## Constraints
- The flow is Intent → Spec → Ticket → Test → Acceptance. Each link must be traceable by an identifier written in the repository, not by memory.
- Success Criteria come from the intent as first written. Acceptance does not judge an intent by criteria added afterwards. For the existing intents they come from the Blueprint's `done` line (a draft); the person accepting must confirm them.
- A tracker status is only a copy for people; the files in the repository decide (CLAUDE.md, "From a requirement to a ticket"). The flow must not make a decision depend on a label alone.
- The existing readiness rule (`spec-ready.sh`) and the `Spec ticket` workflow keep working. Specs already merged must not break.
- Nothing here merges a pull request or pushes to `main`; a person merges.
- Pilot: milestone M1 only (intents I01 repo-foundation, I02 design-system, I16 claude-project-setup, I17 environment-config). M2 and later are not part of this run.
- No customer data or secrets in test evidence.
- Source: CLAUDE.md; `.github/scripts/spec-ready.sh`; Blueprint plan, milestone M1.

## Open questions
- Toki has one person on the project. May the person who built a ticket also be its QA and the BA who accepts its intent? If yes, what must the record show so that the three decisions are still visible as three? If no, who is the second person?
- The 22 M1 tickets are already closed and Done. Do they go back to In QA (the issue is reopened), or do they stay Done and carry a separate QA result?
- Does every ticket need QA? Tickets for CI, hooks, configuration and tooling change no behavior a user sees. Do they pass QA like the others, with a lighter set of tests, or does the BA accept them only through the intent?
- The Blueprint `done` lines of I01, I02, I16 and I17 are drafts written before the specs. Are they accepted as the Success Criteria of those intents, or does the BA rewrite them first?
- When acceptance of an intent fails for one criterion, what happens: the ticket that should have delivered it is reopened, or a new ticket is written? Who decides?
- Is the milestone exit check of the Blueprint (for M1: `pnpm dev` runs, CI is green, the preview page passes its test and its by-eye comparison) part of the intents' acceptance, or a separate step after the last intent of the milestone is accepted?
