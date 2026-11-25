# TOKI-111 QA and acceptance of the environment configuration - implementation plan

**Goal:** TOKI-096 gets a QA record and the outcome I17 gets an acceptance record, run on the real files, with the verdict whatever it is.

**Spec:** `docs/specs/2026-11-25-environment-config-acceptance-design.md` (R1 to R11). Tier M. Branch `docs/toki-111-environment-config-qa`. Documents and one read-only bash script; no existing file changes except `docs/traceability.md` (regenerated).

## Design

Same shape as the I16 example (`docs/qa/TOKI-095.*`, `docs/acceptance/claude-project-setup.md`), with the lessons of that run built in:

- The checks script `docs/qa/TOKI-096.checks.sh` reads files of one commit with `git show` and prints one line for each row: `<ID> <values>`; counts, names and booleans only, never the value of a variable (R3, R10). A strict `Expected` is a line, so a row that looks at nothing (zero rows evaluated) cannot pass: rows that loop over inventory rows print how many they checked.
- The inventory is parsed from the pipe tables of `docs/environment-config.md` between `## Inventory` and `## External values`; the name of a row is the first backticked cell. The example file is read only through `git show <commit>:.env.example` (names and values of non-secret entries).
- Rows are drafted by Claude and approved by the QA before any row is run. The first run of a row whose check proves wrong is corrected and rerun, with both runs kept in the evidence file.
- Row T5 reads the QA's own `.env`; it is in the script but the script never runs it unless asked by ID, and Claude never runs it. The QA runs `bash docs/qa/TOKI-096.checks.sh T5` in their own terminal, before the verdict; it prints the count and the names of the required variables that are unset or empty, no value. Its output is pasted into the evidence file by the QA.
- No `.env` file is created, read or printed by Claude (R5). The Bash tool refused a plain `cat` of the example file; `git show <commit>:<path>` works and is used.

### Rows (one per behavior; T9 and T14 split R9)

| ID | TOKI-096 | Output compared with Expected |
| :-- | :-- | :-- |
| T1 | R1 | `T1 0`: columns missing across the inventory tables |
| T2 | R2 | `T2 12`: of the 12 categories, those with a row or a stated reason |
| T3 | R3 | `T3 0 0 0`: names only in the inventory, only in the example, non-secret values that differ |
| T4 | R4 | `T4 0 N`, N at least 1: rows without Supplied by, rows checked |
| T5 | R5 | manual: `T5 0`, run by the QA |
| T6 | R6 | `T6 3 4 0`: rows for domain, mail account and VPS, columns, backup rows |
| T7 | R7 | `T7 1 3 3`: section, development phrases, production phrases |
| T8 | R8 | `T8 3 0`: ignored paths among the three, ignored among the example |
| T9 | R9 | `T9 0 0`: secret rows with a value in the example, credential-like hits in the two files |
| T10 | R10 | `T10 5`: of TOKI-003, 004, 005, 006 and 008, those whose first commit is after the merge of TOKI-096 |
| T11 | R11 | `T11 2 1 0`: secret rows among the two URL rows, test purpose, app-connection parts rows |
| T12 | R12 | `T12 7`: the seven stated rows and defaults found |
| T13 | R13 | `T13 0 1`: `secrets.` references on the CI line, name ending in `_test` |
| T14 | R9 | `T14 reserved reserved`: first admin email domain in the inventory and the example |

`Version` is the commit of `github/main` when the QA approves the rows; the script takes it as `V=<commit>`.

### Success Criteria (concern 1, four items)

SC1 every environment variable is listed (T1, T2, T10, T11, T12); SC2 `.env.example` matches the list (T3, T9, T14); SC3 each required value exists for development (T5); SC4 each required value has a named owner for production (T4, T6). Rows T7, T8 and T13 judge the ticket, not a criterion. The BA confirms the criteria before any row is run.

### Result notes

A variable that code reads and the inventory lacks is a note, not a Fail (concern 4). I do not search the code for them in this ticket (no row asks for it); if one is seen while reading, it goes in the notes.

## AC -> step -> test

| Req | Step | Test |
| :---- | :---- | :---- |
| R3 | 1. Write `TOKI-096.checks.sh` | run each row on a copy of the commit; run twice, identical lines |
| R1, R2, R4 | 2. Draft `docs/qa/TOKI-096.md` (unapproved, unrun) and the criteria in `docs/acceptance/environment-config.md` | `qa-ready.sh` and `acceptance-ready.sh` report the true gaps |
| R4, R5, R6 | 3. QA approves rows and BA confirms criteria; run T1 to T4 and T6 to T14; the QA runs T5 | results and evidence in the record |
| R7, R8 | 4. Verdict, then `trace.sh` | `acceptance-ready.sh environment-config` and the table |
| R9, R10, R11 | 5. Checks | `git diff` shows added files and `traceability.md` only; `git grep` of the records finds no value; no tracker action |

## What can break (riskiest first)

1. A row that passes because it looked at nothing (an empty parse). Rows that loop print how many they checked, and `Expected` requires at least one.
2. A check that is wrong, not the document (as T3 of TOKI-095). The first run is kept, the correction is explained and rerun.
3. The inventory parser: a cell with `|` or a description row. The tables of the file are read as they are; the script fails loudly (prints `parse error`) when a row has other than eight cells.
4. A value leaking into evidence. The script never prints a value; the evidence is read before commit.
5. R10 depends on git history and merge style; if a ticket has no commit with its key in the subject the row says so instead of passing.
