# QA record: TOKI-095
Ticket: TOKI-095
Spec: docs/specs/2026-11-12-claude-project-setup-design.md
Version: 6153cd0
Environment: local checkout of main at the Version, files read with `git show`; the manual rows need a fresh clone

Role: Dev is Thanh Truong with Claude (the ticket was built before this record). QA is Thanh Truong. Claude drafted the rows; the QA approves them, then they are run.

The command rows run `V=6153cd0 bash docs/qa/TOKI-095.checks.sh <ID>` (called `checks` below) and compare its one line with Expected. Their output goes in `docs/qa/TOKI-095.evidence.txt`.

## Test matrix
| ID | Requirement | Layer | Steps | Expected | Evidence | Priority | Approved | Result | Run |
|---|---|---|---|---|---|---|---|---|---|
| T1 | R1 | command | `V=6153cd0 bash docs/qa/TOKI-095.checks.sh T1` | `T1 5`: all five facts are in the section |  | P1 |  |  |  |
| T2 | R2 | command | `checks T2` | `T2 1`: one section `## Read first` |  | P1 |  |  |  |
| T3 | R3 | command | `checks T3` | `T3 11`: the ten folders of the layout and `infra/` |  | P2 |  |  |  |
| T4 | R4 | command | `checks T4` | `T4 11`: the eleven commands R4 names |  | P1 |  |  |  |
| T5 | R5 | command | `checks T5` | `T5 4`: the three rules and the file-picking note |  | P1 |  |  |  |
| T6 | R6 | command | `checks T6` | `T6 10`: the nine paths and `docs/<topic>.md` |  | P2 |  |  |  |
| T7 | R7 | command | `checks T7` | `T7 1 2`: the branch format once, two examples |  | P1 |  |  |  |
| T8 | R8 | command | `checks T8` | `T8 2`: `pnpm test` and `pnpm test:e2e` explained |  | P2 |  |  |  |
| T9 | R9 | command | `checks T9` | `T9 1 N` with N at least 1: a `## Process` section naming intent -> spec -> ticket |  | P1 |  |  |  |
| T10 | R10 | command | `checks T10` | `T10 3`: the three folders exist in the commit |  | P3 |  |  |  |
| T11 | R11 | command | `checks T11` | `T11 cl-ba-qa@cl,cl-core@cl,cl-dev@cl,cl-lead@cl thanhtruong-agilityio/claude-config` |  | P1 |  |  |  |
| T12 | R12 | command | `checks T12` | `T12 14 6`: 14 allow rules and 6 deny rules |  | P2 |  |  |  |
| T13 | R12 | command | `checks T13` | `T13 none`: the file holds no hook |  | P2 |  |  |  |
| T14 | R12 | command | `checks T14` | `T14 0`: no secret, token or personal path in `CLAUDE.md` or `settings.json` |  | P1 |  |  |  |
| T15 | R16 | command | `checks T15` | `T15 1 1 4`: sections Working agreements and Advisor, and the four keys, still there |  | P2 |  |  |  |
| T16 | R11 | manual | In a fresh clone with no cl plugin at user level, accept the trust and install prompts and list the skills | The session lists the cl skills of `cl-core`, `cl-dev`, `cl-ba-qa` and `cl-lead` |  | P2 |  |  |  |
| T17 | R14 | manual | Fresh clone, cl plugins off, clean profile, no context: ask the four questions of R14 | All four answers match `CLAUDE.md` (what the project is, what to read first, branch and commit formats, how to run tests) |  | P1 |  |  |  |
| T18 | R15 | manual | Same clean session, then with the cl plugins on: ask it to build a feature that has no intent | It proposes to write the intent first, and writes no code, in both sessions |  | P1 |  |  |  |

## Not covered
- R13. Dropped in the spec on 2026-11-16 (concern 4); there is nothing to check.
