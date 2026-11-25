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
| T1 | R1 | command | `V=6153cd0 bash docs/qa/TOKI-095.checks.sh T1` | `T1 5`: all five facts are in the section | docs/qa/TOKI-095.evidence.txt, line T1 | P1 | QA Thanh Truong, 2026-11-25 | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T2 | R2 | command | `checks T2` | `T2 1`: one section `## Read first` | docs/qa/TOKI-095.evidence.txt, line T2 | P1 | QA Thanh Truong, 2026-11-25 | Fail | Claude for QA Thanh Truong, 2026-11-25 |
| T3 | R3 | command | `checks T3` | `T3 11`: the ten folders of the layout and `infra/` | docs/qa/TOKI-095.evidence.txt, line T3 | P2 | QA Thanh Truong, 2026-11-25 | Fail | Claude for QA Thanh Truong, 2026-11-25 |
| T4 | R4 | command | `checks T4` | `T4 11`: the eleven commands R4 names | docs/qa/TOKI-095.evidence.txt, line T4 | P1 | QA Thanh Truong, 2026-11-25 | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T5 | R5 | command | `checks T5` | `T5 4`: the three rules and the file-picking note | docs/qa/TOKI-095.evidence.txt, line T5 | P1 | QA Thanh Truong, 2026-11-25 | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T6 | R6 | command | `checks T6` | `T6 10`: the nine paths and `docs/<topic>.md` | docs/qa/TOKI-095.evidence.txt, line T6 | P2 | QA Thanh Truong, 2026-11-25 | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T7 | R7 | command | `checks T7` | `T7 1 2`: the branch format once, two examples | docs/qa/TOKI-095.evidence.txt, line T7 | P1 | QA Thanh Truong, 2026-11-25 | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T8 | R8 | command | `checks T8` | `T8 2`: `pnpm test` and `pnpm test:e2e` explained | docs/qa/TOKI-095.evidence.txt, line T8 | P2 | QA Thanh Truong, 2026-11-25 | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T9 | R9 | command | `checks T9` | `T9 1 N` with N at least 1: a `## Process` section naming intent -> spec -> ticket | docs/qa/TOKI-095.evidence.txt, line T9 | P1 | QA Thanh Truong, 2026-11-25 | Fail | Claude for QA Thanh Truong, 2026-11-25 |
| T10 | R10 | command | `checks T10` | `T10 3`: the three folders exist in the commit | docs/qa/TOKI-095.evidence.txt, line T10 | P3 | QA Thanh Truong, 2026-11-25 | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T11 | R11 | command | `checks T11` | `T11 cl-ba-qa@cl,cl-core@cl,cl-dev@cl,cl-lead@cl thanhtruong-agilityio/claude-config` | docs/qa/TOKI-095.evidence.txt, line T11 | P1 | QA Thanh Truong, 2026-11-25 | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T12 | R12 | command | `checks T12` | `T12 14 6`: 14 allow rules and 6 deny rules | docs/qa/TOKI-095.evidence.txt, line T12 | P2 | QA Thanh Truong, 2026-11-25 | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T13 | R12 | command | `checks T13` | `T13 none`: the file holds no hook | docs/qa/TOKI-095.evidence.txt, line T13 | P2 | QA Thanh Truong, 2026-11-25 | Fail | Claude for QA Thanh Truong, 2026-11-25 |
| T14 | R12 | command | `checks T14` | `T14 0`: no secret, token or personal path in `CLAUDE.md` or `settings.json` | docs/qa/TOKI-095.evidence.txt, line T14 | P1 | QA Thanh Truong, 2026-11-25 | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T15 | R16 | command | `checks T15` | `T15 1 1 4`: sections Working agreements and Advisor, and the four keys, still there | docs/qa/TOKI-095.evidence.txt, line T15 | P2 | QA Thanh Truong, 2026-11-25 | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T16 | R11 | manual | In a fresh clone with no cl plugin at user level, accept the trust and install prompts and list the skills | The session lists the cl skills of `cl-core`, `cl-dev`, `cl-ba-qa` and `cl-lead` |  | P2 | QA Thanh Truong, 2026-11-25 | Blocked | Claude for QA Thanh Truong, 2026-11-25 (not run: needs a fresh clone) |
| T17 | R14 | manual | Fresh clone, cl plugins off, clean profile, no context: ask the four questions of R14 | All four answers match `CLAUDE.md` (what the project is, what to read first, branch and commit formats, how to run tests) |  | P1 | QA Thanh Truong, 2026-11-25 | Blocked | Claude for QA Thanh Truong, 2026-11-25 (not run: needs a fresh clone) |
| T18 | R15 | manual | Same clean session, then with the cl plugins on: ask it to build a feature that has no intent | It proposes to write the intent first, and writes no code, in both sessions |  | P1 | QA Thanh Truong, 2026-11-25 | Blocked | Claude for QA Thanh Truong, 2026-11-25 (not run: needs a fresh clone) |

## Not covered
- R13. Dropped in the spec on 2026-11-16 (concern 4); there is nothing to check.

## Result notes
- T2 Fail: `CLAUDE.md` at `6153cd0` has no `## Read first` section (R2). The "Read first" order is written in `.claude/rules/ticket.md` ("Before you start work on a ticket, read in this order"), which a session loads, but R2 asks for the section in `CLAUDE.md`.
- T3 Fail: the layout section shows ten of the eleven items; `infra/` is not in it. TOKI-003 put the compose file at the root (`docs/plans/TOKI-095.md` lists this as a known difference), so the spec text of R3 is out of date and the document is arguably right. The QA decides whether the row or the spec changes. The first run of T3 gave 8 because the check looked for the wrong strings; the check was corrected and rerun (see the evidence file).
- T9 Fail: `CLAUDE.md` at `6153cd0` has no `## Process` section (R9). The order intent -> spec -> ticket is stated in `.claude/rules/ticket.md` and in "Working agreements", not in a `## Process` section.
- T13 Fail: `.claude/settings.json` at `6153cd0` holds hooks (Stop, PreToolUse). R12 said this work adds none; the hooks were added by later tickets (for example TOKI-095's own `check-branch-slug.sh` commit). The row compares the file now with the spec at merge time, so this is drift of the spec, not a defect of TOKI-095.
- T16, T17, T18 Blocked: they need a fresh clone and a clean Claude session; Claude cannot run them for the QA. They are not Pass.
- The rows were read against the commit `6153cd0`, which is `main` after the later tickets, not the commit that merged TOKI-095.

