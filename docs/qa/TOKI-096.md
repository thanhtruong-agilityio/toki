# QA record: TOKI-096
Ticket: TOKI-096
Spec: docs/specs/2026-11-12-environment-config-design.md
Version: ff5bb3be
Environment: local checkout; the files are read at the Version with `git show`; row T5 is run by the QA in their own terminal

Role: Dev is Thanh Truong with Claude (the ticket was built before this record). QA is Thanh Truong. Claude drafts the rows; the QA approves them before any row is run. Claude runs the command rows; the QA runs T5.

Each command row runs `V=ff5bb3be bash docs/qa/TOKI-096.checks.sh <ID>` (called `checks` below) and compares its one output line with Expected. The output goes in `docs/qa/TOKI-096.evidence.txt`. The script prints counts, names and words, never the value of a variable.

## Test matrix
| ID | Requirement | Layer | Steps | Expected | Evidence | Priority | Approved | Result | Run |
|---|---|---|---|---|---|---|---|---|---|
| T1 | R1 | command | `checks T1` | `T1 0 N`, N at least 1: no column missing in any inventory table |  | P1 |  |  |  |
| T2 | R2 | command | `checks T2` | `T2 12`: all 12 categories have a row or the stated reason |  | P1 |  |  |  |
| T3 | R3 | command | `checks T3` | `T3 0 0 0`: no name only in the inventory, none only in the example, no non-secret value that differs |  | P1 |  |  |  |
| T4 | R4 | command | `checks T4` | `T4 0 N`, N at least 1: no required row read in production lacks Supplied by |  | P1 |  |  |  |
| T5 | R5 | manual | In your own terminal, from the root of a checkout with your `.env`: `V=ff5bb3be bash docs/qa/TOKI-096.checks.sh T5`. It prints the count and the names of required variables that are unset or empty, no value. Paste that output into the evidence file. | `T5 0`: no required development variable unset or empty in the QA's own `.env` (names only) |  | P1 |  |  |  |
| T6 | R6 | command | `checks T6` | `T6 3 4 0`: rows for domain, mail account and VPS, four columns, no backup row |  | P2 |  |  |  |
| T7 | R7 | command | `checks T7` | `T7 1 3 3`: the section, three development statements, three production statements |  | P2 |  |  |  |
| T8 | R8 | command | `checks T8` | `T8 3 0`: the three `.env` paths ignored, the example not ignored |  | P1 |  |  |  |
| T9 | R9 | command | `checks T9` | `T9 0 0`: no secret row with a value in the example, no credential-like string in the two files |  | P1 |  |  |  |
| T10 | R10 | command | `checks T10` | `T10 5 5`: the code of all five tickets started after the merge of TOKI-096 |  | P3 |  |  |  |
| T11 | R11 | command | `checks T11` | `T11 2 1 0`: both URL rows are secret, the test row names the test database, no app-connection parts row |  | P2 |  |  |  |
| T12 | R12 | command | `checks T12` | `T12 7`: the seven server and port rows and defaults found |  | P2 |  |  |  |
| T13 | R13 | command | `checks T13` | `T13 0 1`: no `secrets.` reference on the CI line, the database name ends in `_test` |  | P2 |  |  |  |
| T14 | R9 | command | `checks T14` | `T14 reserved reserved`: the first admin email is on a reserved test domain in both files |  | P1 |  |  |  |

## Not covered
- None: every requirement R1 to R13 of the spec has a row.
