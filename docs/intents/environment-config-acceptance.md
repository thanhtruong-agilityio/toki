# Intent: QA and acceptance of the environment configuration
Author: Thanh Truong

## Problem
The ticket TOKI-096 (the inventory of environment variables and `.env.example`) is closed as Done, but nobody tested it against its spec, and the Blueprint outcome it belongs to, I17 environment-config, was never accepted. The flow that does this after Dev is merged (`docs/specs/2026-11-24-ba-qa-acceptance-design.md`), and its spec asks for one intent, spec and ticket for each M1 outcome (concern 9). I16 claude-project-setup was the worked example. I17 has no QA record (`docs/qa/TOKI-096.md`) and no acceptance record (`docs/acceptance/environment-config.md`), so `docs/traceability.md` shows "no QA record" and "no acceptance" for it.
So it is not known whether the list of variables is complete, whether `.env.example` matches it, whether each required value exists for development, or whether each required value has a named owner for production. The Blueprint states the outcome in one line: "Every environment variable is listed; `.env.example` matches the list; each required value exists for development and has a named owner for production."
Source: `docs/traceability.md` (TOKI-096 row); `docs/intents/environment-config.md` and `docs/specs/2026-11-12-environment-config-design.md` (R1 to R13); Blueprint plan, intent I17 (`done` line, ticket 096, status draft).

## Proposed outcome
- TOKI-096 has a QA record: a test matrix with a row for each requirement of its spec, approved by the QA before it is run, with the result and the evidence of each row.
- I17 has an acceptance record: its Success Criteria, taken from the Blueprint `done` line and confirmed by the BA before any row is run, and a verdict for each criterion with its reason, then an overall verdict.
- The repository shows where the chain from the outcome to its proof holds or breaks for I17.
- If a criterion is not met, the record says which row failed and why; the verdict is `Not accepted` and the failure stays in the record.
Source: the requirement of this run; `docs/specs/2026-11-24-ba-qa-acceptance-design.md` (R1 to R9, R17).

## Affected users and systems
- Users: the builder, who acts as Dev; the person who acts as QA and as BA. Toki has one person on the project, so one person holds all three roles and the records name the role next to each name. Whoever operates the server is affected only through the owners named for production values.
- Systems: `docs/qa/`, `docs/acceptance/`, `docs/traceability.md`, the scripts `qa-ready.sh`, `acceptance-ready.sh` and `trace.sh`, and the files that TOKI-096 delivered (`docs/environment-config.md`, `.env.example`).
Source: `docs/ticket-config.yml`; `.claude/rules/ticket.md` ("After the merge").

## Constraints
- The flow and the record formats are those of the merged spec; this work adds records and changes no script and no format.
- Success Criteria are confirmed before any row is run, and a criterion added later is shown beside the first ones.
- Claude cannot read or create `.env`; a row that needs a real `.env` is run by the person in their own terminal, or it is `Blocked`. No secret, token or real credential value goes into a record or its evidence.
- The existing intent and spec of TOKI-096 are not edited. A requirement of that spec that is out of date is reported as a Fail with the reason, not rewritten.
- A row is `Pass` only with evidence at a named commit. A row that cannot be run is `Blocked`, never `Pass`.
- Nothing here merges a pull request or pushes to `main`; a person merges.
Source: the merged QA-acceptance spec (R3, R4, R9, Data safety); CLAUDE.md.

## Open questions
- The Blueprint `done` line has three statements joined by semicolons. Is it split into three criteria (the list is complete; `.env.example` matches it; each required value exists for development and has a named production owner), or into four, with development values and production owners separate?
- "Each required value exists for development" can only be proven with a filled `.env`, which Claude must not read. Does the QA run that row in their own terminal and paste the result without values, or is the row `Blocked` and the criterion not accepted until then?
- "A named owner for production": the spec of TOKI-096 accepts a person for first-installation values and a role for per-installation values. Does the BA accept a role as "a named owner", or must every value name a person?
- The spec of TOKI-096 was written before the code that reads the variables. Where the inventory and the code now differ (new variables added by later tickets), is that a Fail of TOKI-096 or a follow-up for the ticket that added the variable?
