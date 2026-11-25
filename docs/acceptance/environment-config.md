# Acceptance: environment-config
Outcome: I17
Milestone: M1
Tickets: TOKI-096

## Success Criteria
Source: the `done` line of the Blueprint intent I17 (a draft, written before the spec): "Every environment variable is listed; `.env.example` matches the list; each required value exists for development and has a named owner for production", split into four yes-or-no items without changing its meaning (spec concern 1).
- SC1. Every environment variable is listed.
- SC2. `.env.example` matches the list.
- SC3. Each required value exists for development.
- SC4. Each required value has a named owner for production.

## Confirmed
BA Thanh Truong, 2026-11-25. SC1 to SC4 are confirmed as written, before any row of TOKI-096 was run.

## Results
| SC | Tickets | Evidence | Verdict | Reason |
|---|---|---|---|---|
| SC1 | TOKI-096 | TOKI-096:T1, TOKI-096:T2, TOKI-096:T10, TOKI-096:T11, TOKI-096:T12 | Accepted | Every inventory table has the eight columns, the 12 categories are covered, the database rows have the right secret flag, purpose and reader, the server and port rows and the container host rule are as specified, and the five tickets that read the variables started after the inventory merged. |
| SC2 | TOKI-096 | TOKI-096:T3, TOKI-096:T9, TOKI-096:T14 | Accepted | The inventory and `.env.example` have the same names and the same non-secret values; secret entries are empty in the example and carry no value in the inventory; no credential-like string; the first admin email is on a reserved test domain. |
| SC3 | TOKI-096 | TOKI-096:T5 | Accepted | The QA ran the check on their own `.env`: 20 required rows read, none unset or empty. |
| SC4 | TOKI-096 | TOKI-096:T4, TOKI-096:T6 | Accepted | Every required row read in production names who supplies it (10 rows checked, 0 without); the external values list has an owner in each of the domain, mail account and VPS rows. |

## Verdict
Accepted
By: BA, pending Thanh Truong (drafted by Claude from the QA record of 2026-11-25; the BA has confirmed the criteria, not this verdict)

Notes for the BA: a role ("the operator of that installation") counts as a named owner (spec concern 3); the rows were read at `main` of 2026-11-25, not at the merge of TOKI-096; the external values (domain, mail account, VPS) are `open` in the list by design and need their owners' action before the phase 1 deploy, which this acceptance does not cover.
