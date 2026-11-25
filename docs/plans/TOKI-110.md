# TOKI-110 BA-QA acceptance after Dev - implementation plan

**Goal:** a ticket is Done only when its QA record passes, and an outcome is accepted only against Success Criteria confirmed before testing. Three scripts read the records and report gaps; the worked example is I16 with TOKI-095.

**Spec:** `docs/specs/2026-11-24-ba-qa-acceptance-design.md` (R1 to R18). Tier M. Branch `ci/toki-110-qa-acceptance-flow`.

## Design

Documents and bash only. No server, web or package code, no workflow change, no merged intent or spec edited (spec Scope).

### Record formats (the part the spec leaves open)

All three scripts read plain Markdown. Tables are pipe tables: one header row, one separator row, then rows; a cell holds no `|`. A script finds a column by its header name, not by position, and reports a missing column.

QA record `docs/qa/<KEY>.md`:

```
# QA record: <KEY>
Ticket: <KEY>
Spec: docs/specs/<file>.md
Version: <commit>
Environment: <where it was run>

## Test matrix
| ID | Requirement | Layer | Steps | Expected | Evidence | Priority | Approved | Result | Run |

## Not covered
- R3. <reason>
```

- `ID` is `T1`, `T2`, ... unique in the record. `Requirement` starts with `R<n>`; text after it (for example a Blueprint id) is ignored.
- `Approved` and `Run` are written `<role> <name>, <YYYY-MM-DD>`; a script only checks that they are not empty and, for `Run`, reads the date.
- `Result` is empty (not run), `Pass`, `Fail` or `Blocked`.

Acceptance record `docs/acceptance/<slug>.md`: header `Outcome:`, `Milestone:`, `Tickets:` (keys separated by commas, no ranges); sections `## Success Criteria` (items `- SC1. ...`), `## Confirmed` (a line with `BA`, a name and `YYYY-MM-DD`), optional `## Changes to the criteria`, `## Results` (columns `SC`, `Tickets`, `Evidence`, `Verdict`, `Reason`), `## Verdict` (first word `Accepted`, `Not accepted` or `Pending`, then a line `By: BA, <name>`). Evidence cites a QA row as `<KEY>:<ID>` (for example `TOKI-095:T3`).

Milestone record `docs/acceptance/milestone-<m>.md`: header `Milestone:`, `Outcomes:` (slugs, comma separated); sections `## Exit check` (items `- EC1. ...`), `## Results` (columns `EC`, `Evidence`, `Verdict`, `Reason`), `## Verdict`.

### Scripts (same shape as `spec-ready.sh`)

Run from the repository root; `set -uo pipefail`; one `- ` line per gap; exit 0 none, 1 gaps, 2 wrong usage; no network, no model. A `ROOT`-free design: paths in the records are relative to the working directory, so a test runs in a temporary tree as `spec-ready.test.sh` does.

- `qa-ready.sh <KEY>` (R1 to R4, R12): header lines and that `Ticket:` equals the file name and `Spec:` exists; the ten columns; every `Layer` valid; `Expected` not empty and not a vague word ("works", "displays correctly", "ok"); every spec requirement has a row or a `## Not covered` entry; `Pass` without Evidence; a Result without Approved; a Result without Run; a row not run, `Fail` or `Blocked` is a gap ("not passed"). Exit 0 therefore means the ticket passes QA (R10).
- `acceptance-ready.sh <slug> [--ready]` (R6 to R9, R13, R18): the gaps of R6 to R9 for an outcome; for a slug starting `milestone-` the gaps of R18. `--ready` prints `ready` or `not ready` with one line per ticket that does not pass `qa-ready.sh`; exit 0 only when ready.
- `trace.sh` (R14): scans `docs/specs/*.md` for `Ticket:`, `docs/qa/*.md` and `docs/acceptance/*.md` (not milestone records), writes `docs/traceability.md`. Columns `Outcome`, `Intent`, `Spec`, `Ticket`, `Requirements`, `Rows passed`, `Acceptance`. A missing link is written as `no QA record` or `no acceptance`; a ticket in no acceptance record has outcome `none`. `Requirements` is covered over total, where covered means a row or a `## Not covered` entry. Output is sorted by ticket key so a rerun gives the same file.

### Tests

One `*.test.sh` per script, in the style of `spec-ready.test.sh`: a temporary tree, one case for each gap, one clean case (R12, R13, R14, R18). Fixtures are made up.

### Documents

R15: `docs/definition-of-done.md` gets two checklist lines; `docs/ticket-config.yml` gets `qa.records_dir`, `qa.acceptance_dir` and a comment that `in-qa` follows `in-review` and precedes `done`; nothing renamed. R16: `.claude/rules/ticket.md` gets a section "After the merge" with the statuses and what each needs; `.claude/rules/specs.md` gets the rule that Success Criteria live in the acceptance record and are confirmed before the tickets are tested; `CLAUDE.md` "Commands" lists the three scripts and tests. All additions, each with its source.

### Worked example (R17)

`docs/qa/TOKI-095.md` with rows for R1 to R12 and R14 to R16 of `docs/specs/2026-11-12-claude-project-setup-design.md` (R13 was dropped there and goes under `## Not covered`). Rows that a command can prove (section names, paths that exist, `git diff` added lines only, JSON validity) are run by me and the output is quoted as evidence. R14 and R15 (fresh Claude session, plugins off) are manual: they are run only if the QA runs them; otherwise they stay `Blocked` and the verdict says so, and nothing is marked Pass without evidence. `docs/acceptance/claude-project-setup.md` takes SC1 to SC5 from the Blueprint `done` line of I16; the BA confirms them (date) before the run; the verdict is written after it, whatever it is. `docs/traceability.md` is generated by `trace.sh`.

## AC -> step -> test

| Req | Step | Test |
| :---- | :---- | :---- |
| R1 to R4, R12 | 1. `qa-ready.sh` | `qa-ready.test.sh`: one case per gap, one clean |
| R6 to R9, R13, R18 | 2. `acceptance-ready.sh` | `acceptance-ready.test.sh`: one case per gap, clean, `--ready`, milestone cases |
| R14 | 3. `trace.sh` | `trace.test.sh`: complete chain, no QA record, no acceptance; output compared |
| R15, R16 | 4. Documents | `git diff` shows added lines only; each path and command named in the spec is found in the files; `spec-ready.test.sh`, `review-request.test.sh`, `changed.test.sh` pass before and after |
| R5, R10, R11, R17 | 5. Worked example | `qa-ready.sh TOKI-095` and `acceptance-ready.sh claude-project-setup` print what is true; `trace.sh` output read |

## What can break (riskiest step first)

1. Step 5 is judgement, not code: a row marked Pass without real evidence defeats the flow. Rule: Pass only with output I ran or a CI run I read; the rest is Blocked.
2. Markdown parsing in bash: a `|` inside a cell, trailing spaces, CRLF. The scripts trim cells and the tests cover empty cells and extra spaces; a `|` in a cell is documented as not allowed.
3. Date comparison (R7): `Confirmed` later than a `Run` date. ISO dates compare as strings; a malformed date is a gap.
4. Existing script tests must not change; the new scripts touch no existing file.
