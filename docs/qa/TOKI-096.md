# QA record: TOKI-096
Ticket: TOKI-096
Spec: docs/specs/2026-11-12-environment-config-design.md
Version: ff5bb3be
Environment: local checkout; the files are read at the Version with `git show`; row T5 is run by the QA in their own terminal

Role: Dev is Thanh Truong with Claude (the ticket was built before this record). QA is Thanh Truong. Claude drafted the rows; the QA approved all 14 in chat on 2026-11-25 ("Duyệt cả hai, chạy") before any row was run, and the BA confirmed the criteria of the acceptance record at the same time. Claude runs the command rows; the QA runs T5.

Each command row runs `V=ff5bb3be bash docs/qa/TOKI-096.checks.sh <ID>` (called `checks` below) and compares its one output line with Expected. The output goes in `docs/qa/TOKI-096.evidence.txt`. The script prints counts, names and words, never the value of a variable.

## Test matrix
| ID | Requirement | Layer | Steps | Expected | Evidence | Priority | Approved | Result | Run |
|---|---|---|---|---|---|---|---|---|---|
| T1 | R1 | command | `checks T1` | `T1 0 N`, N at least 1: no column missing in any inventory table | docs/qa/TOKI-096.evidence.txt, line T1 | P1 | QA Thanh Truong, 2026-11-25 | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T2 | R2 | command | `checks T2` | `T2 12`: all 12 categories have a row or the stated reason | docs/qa/TOKI-096.evidence.txt, line T2 | P1 | QA Thanh Truong, 2026-11-25 | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T3 | R3 | command | `checks T3` | `T3 0 0 0`: no name only in the inventory, none only in the example, no non-secret value that differs | docs/qa/TOKI-096.evidence.txt, line T3 | P1 | QA Thanh Truong, 2026-11-25 | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T4 | R4 | command | `checks T4` | `T4 0 N`, N at least 1: no required row read in production lacks Supplied by | docs/qa/TOKI-096.evidence.txt, line T4 | P1 | QA Thanh Truong, 2026-11-25 | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T5 | R5 | manual | In your own terminal, from the root of a checkout with your `.env`: `V=ff5bb3be bash docs/qa/TOKI-096.checks.sh T5`. It prints the count and the names of required variables that are unset or empty, no value. Paste that output into the evidence file. | `T5 0`: no required development variable unset or empty in the QA's own `.env` (names only) |  | P1 | QA Thanh Truong, 2026-11-25 | Blocked | Claude for QA Thanh Truong, 2026-11-25 (not run: only the QA runs it, in their own terminal) |
| T6 | R6 | command | `checks T6` | `T6 3 4 0`: rows for domain, mail account and VPS, four columns, no backup row | docs/qa/TOKI-096.evidence.txt, line T6 | P2 | QA Thanh Truong, 2026-11-25 | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T7 | R7 | command | `checks T7` | `T7 1 3 3`: the section, three development statements, three production statements | docs/qa/TOKI-096.evidence.txt, line T7 | P2 | QA Thanh Truong, 2026-11-25 | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T8 | R8 | command | `checks T8` | `T8 3 0`: the three `.env` paths ignored, the example not ignored | docs/qa/TOKI-096.evidence.txt, line T8 | P1 | QA Thanh Truong, 2026-11-25 | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T9 | R9 | command | `checks T9` | `T9 0 0`: no secret row with a value in the example, no credential-like string in the two files | docs/qa/TOKI-096.evidence.txt, line T9 | P1 | QA Thanh Truong, 2026-11-25 | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T10 | R10 | command | `checks T10` | `T10 5 5`: the code of all five tickets started after the merge of TOKI-096 | docs/qa/TOKI-096.evidence.txt, line T10 | P3 | QA Thanh Truong, 2026-11-25 | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T11 | R11 | command | `checks T11` | `T11 2 1 0`: both URL rows are secret, the test row names the test database, no app-connection parts row | docs/qa/TOKI-096.evidence.txt, line T11 | P2 | QA Thanh Truong, 2026-11-25 | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T12 | R12 | command | `checks T12` | `T12 7`: the seven server and port rows and defaults found | docs/qa/TOKI-096.evidence.txt, line T12 | P2 | QA Thanh Truong, 2026-11-25 | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T13 | R13 | command | `checks T13` | `T13 0 1`: no `secrets.` reference on the CI line, the database name ends in `_test` | docs/qa/TOKI-096.evidence.txt, line T13 | P2 | QA Thanh Truong, 2026-11-25 | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T14 | R9 | command | `checks T14` | `T14 reserved reserved`: the first admin email is on a reserved test domain in both files | docs/qa/TOKI-096.evidence.txt, line T14 | P1 | QA Thanh Truong, 2026-11-25 | Pass | Claude for QA Thanh Truong, 2026-11-25 |

## Not covered
- None: every requirement R1 to R13 of the spec has a row.

## Result notes
- T1 to T4 and T6 to T14 are Pass: each output line equals Expected, and the script gave the same lines on a second run.
- T5 is Blocked until the QA runs it and pastes the names of any unset or empty required variable into the evidence file. By concern 2 of the spec of TOKI-111 it is run before the verdict is written.
- The rows were read at the commit `ff5bb3be` (`main` after TOKI-111's spec), not at the commit that merged TOKI-096. The inventory was changed by later tickets (for example the sign-in rows); the rows judge it as it is now.
- Variables that code reads and the inventory lacks are not searched for by any row. None was seen.

