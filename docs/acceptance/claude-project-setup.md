# Acceptance: claude-project-setup
Outcome: I16
Milestone: M1
Tickets: TOKI-095

## Success Criteria
Source: the `done` line of the Blueprint intent I16 (a draft, written before the spec), split into separate yes-or-no items without changing its meaning.
- SC1. A new Claude session that opens the repository knows what the project is.
- SC2. A new Claude session that opens the repository knows what to read first.
- SC3. A new Claude session that opens the repository knows the branch and commit conventions.
- SC4. A new Claude session that opens the repository knows how to run tests.
- SC5. A new Claude session that opens the repository follows intent -> spec -> ticket unprompted.

## Confirmed
BA Thanh Truong, 2026-11-25. SC1 to SC5 are confirmed as written, before any row of TOKI-095 was run.

## Results
| SC | Tickets | Evidence | Verdict | Reason |
|---|---|---|---|---|
| SC1 | TOKI-095 | TOKI-095:T1, TOKI-095:T17 | Not accepted | The facts are in `CLAUDE.md` (T1 Pass), but the check that a new session answers from it (T17) is Blocked. |
| SC2 | TOKI-095 | TOKI-095:T2, TOKI-095:T17 | Not accepted | T2 Fail: no `## Read first` section in `CLAUDE.md`; T17 Blocked. |
| SC3 | TOKI-095 | TOKI-095:T7, TOKI-095:T17 | Not accepted | The formats are stated once with examples (T7 Pass), but T17 is Blocked. |
| SC4 | TOKI-095 | TOKI-095:T8, TOKI-095:T17 | Not accepted | `pnpm test` and `pnpm test:e2e` are explained (T8 Pass), but T17 is Blocked. |
| SC5 | TOKI-095 | TOKI-095:T9, TOKI-095:T18 | Not accepted | T9 Fail: no `## Process` section; T18 Blocked. |

## Verdict
Not accepted
By: BA, pending Thanh Truong (drafted by Claude from the QA record of 2026-11-25; the BA has confirmed the criteria, not this verdict)

The failing rows are T2, T3, T9 and T13 and the blocked rows are T16, T17 and T18 in `docs/qa/TOKI-095.md`. By R9 the ticket TOKI-095 is reopened for the criteria it owns (`In Progress`, label `reopened`). That tracker change is not made by this pull request (concern 8); the BA decides whether to make it, or whether the spec of TOKI-095 is amended instead (T3, T9 and T13 are spec drift as much as defects).
