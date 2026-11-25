# Intent: QA of the monorepo and TypeScript setup
Author: Thanh Truong

## Problem
The ticket TOKI-001 (the pnpm monorepo, the eight projects, the shared TypeScript config, the Node pin and the root scripts) is closed as Done, but nobody tested it against its spec. It is the first of the eight tickets of the Blueprint outcome I01 repo-foundation (TOKI-001 to TOKI-008). The flow that runs after Dev (`docs/specs/2026-11-24-ba-qa-acceptance-design.md`) asks for a QA record for each ticket before the outcome is accepted; I16 and I17 have gone through it, and the I17 follow-up (`docs/intents/environment-config-acceptance.md`) is the pattern. For I01 the lead chose on 2026-11-25 one QA ticket for each of the eight tickets, then one ticket for the acceptance of the outcome.
So `docs/qa/TOKI-001.md` does not exist and `docs/traceability.md` shows "no QA record" for TOKI-001. It is not known whether the workspace, the eight projects, the TypeScript rules, the Node and pnpm pins, the `.gitignore` patterns and the `dev` script are as the spec says, or whether they drifted when later tickets added files and scripts.
Source: `docs/traceability.md` (TOKI-001 row); `docs/specs/2026-11-12-monorepo-typescript-setup-design.md` (R1 to R12); Blueprint plan, intent I01 (tickets 001 to 008, `done` line, status draft).

## Proposed outcome
- TOKI-001 has a QA record: a test matrix with a row for each requirement of its spec, approved by the QA before it is run, with the result and the evidence of each row.
- Each row says at which commit it was judged, so a reader knows whether it proves the ticket as delivered or the repository as it stands.
- If a requirement is not met, the record says which row failed and why, and the failure stays in the record.
- The acceptance of I01 itself is not part of this work; it is written after the QA records of the eight tickets exist.
Source: the requirement of this run; `docs/specs/2026-11-24-ba-qa-acceptance-design.md` (R1 to R5, R10, R17).

## Affected users and systems
- Users: the builder, who acts as Dev; the person who acts as QA and as BA. Toki has one person on the project, so one person holds all three roles and the records name the role next to each name.
- Systems: `docs/qa/`, `docs/traceability.md`, the scripts `qa-ready.sh` and `trace.sh`, and the files that TOKI-001 delivered (`pnpm-workspace.yaml`, the eight project folders, `tsconfig.base.json`, `.gitignore`, `.nvmrc`, the root `package.json`).
Source: `docs/ticket-config.yml`; `.claude/rules/ticket.md` ("After the merge").

## Constraints
- The flow and the record formats are those of the merged spec; this work adds records and changes no script and no format.
- Several requirements of the spec of TOKI-001 describe the repository when the ticket was closed (for example "each project holds exactly three files", "no project has a `dev` script"). Later tickets legitimately changed these, so the commit at which a row is judged matters.
- Some rows need `pnpm install` and a type check, which write to disk and need Node 22 and the package registry; they must not change the working tree of the repository.
- A row is `Pass` only with evidence at a named commit; a row that cannot be run is `Blocked`, never `Pass`. No secret, token or personal data goes into a record.
- The merged intent and spec of TOKI-001 are not edited. Nothing here merges a pull request or pushes to `main`; a person merges.
Source: the merged QA-acceptance spec (R3, R4, R9, Data safety); CLAUDE.md.

## Open questions
- At which commit are the rows of TOKI-001 judged: the merge commit of its pull request (the ticket as delivered), or the current `main` (the repository as it stands)? Several requirements are true only of the first.
- May the checks create a temporary clone or worktree outside the repository, run `pnpm install` and `pnpm typecheck` there, and remove it, as the spec of TOKI-001 expects its checks to be run on a clean clone?
