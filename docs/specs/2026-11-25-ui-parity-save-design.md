# UI parity save design

Date: 2026-11-25 · Status: draft for review
Intent: docs/intents/ui-parity-save.md (Thanh Truong)
Ticket: TOKI-135

## Goal
The builder (Thanh and Claude) needs to keep the results of the UI parity check (TOKI-109) in the repository, whenever they choose, so that they can look back at how the app compared with the prototype on an earlier date or commit. Today the report and the images of a run are written to `e2e/assets/parity/`, which git ignores, and CI keeps its copy for 7 days. After this change one command, run by hand, copies a run into a folder of `docs/ui-parity/` with a record of when and on which commit it was made, and keeps a list of the kept runs; the builder commits the folder in a pull request.

## Scope
- In: a command `pnpm ui:save` (R1) that runs the check (R3), saves the result (R5 to R9, R13) and refuses to replace or half-write a kept run (R10, R14); the list of kept runs (R12); `--prune <n>`, which only prints what to remove (R18); the notes in the README and in `CLAUDE.md` (R16); the first kept run, as proof (R17).
- Out (not now):
  - CI saving, pushing or committing anything. The repository forbids pushing to `main`, and the intent asks for a command run by hand. The command also never runs `git add`, `git commit` or `git push` (R15).
  - Deleting a kept run by the command itself: `--prune <n>` only prints the `git rm` commands and the builder runs them (R18, concern 2).
  - Git LFS, publishing the kept runs on a web page, a comparison of two kept runs.
  - A partial run of the check (one spec or one screen): `pnpm ui:save` runs the whole check, and `--no-run` keeps whatever report is there (concern 5).
  - Any change to the check, to its report or to the images it writes (TOKI-109): this work only copies them.
  - The Playwright output of the run (`e2e/assets/parity/results/`): it is not a result of the check, it is working files.

## Requirements
- R1. `pnpm ui:save` runs `node tools/ui-parity/save.mjs`, a root script of `package.json`, with the options `--no-run`, `--no-images`, `--update` and `--prune <n>`, and no other. `--prune` cannot be used with another option. An unknown option, a positional argument or a bad combination stops it with exit code 2 and a usage line, and changes nothing. Check: a test of the argument parser.
- R2. Without `--no-run`, before the check starts, the command deletes `e2e/assets/parity/report.md`, `report.json` and the folder `images/`, so that a report found afterwards is the report of this run and never an old one. Check: a test where an old report is present and the check fails: nothing is kept.
- R3. Without `--no-run`, the command then runs `node tools/ui-parity/container.mjs test` (the whole check, as `pnpm test:e2e:parity` does, in the Playwright container) and waits for it. Its output goes to the terminal as it comes. Check: a test with a fake runner records exactly this command with no further argument.
- R4. A run that gave no result keeps nothing: the check ends with a code other than 0, or `report.json` is missing or cannot be read, or it holds no row. The command then says which of the three it is, exits with 1, creates no folder and does not touch the list of kept runs. Check: one test for each of the three cases.
- R5. A kept run is a folder `docs/ui-parity/<date>-<commit>/`, where `<date>` is the UTC date of the save (`YYYY-MM-DD`) and `<commit>` the first 7 characters of `HEAD`. When the working tree has uncommitted changes (R11) the name ends with `-dirty`. Check: a test of the function that builds the name, with a clean and a dirty tree.
- R6. The folder holds `report.md` and `report.json`, copied as they are, the folder `images/` with every `.png` file of `e2e/assets/parity/images/` (the reference, the app and the difference of each screen, look and width), and `meta.json` (R7). Check: a test lists the files of a kept run made from a fake result.
- R7. `meta.json` is a JSON object with these keys: `date` (the time of the save, ISO 8601, UTC); `commit` (the 40 characters of `HEAD`); `branch` (the name of the branch, or `HEAD` when detached); `dirty` (true or false) and `dirtyFiles` (the number of changed files counted by R11); `ran` (true when the command ran the check, false with `--no-run`); `withImages` (false with `--no-images`); `counts` with `match`, `differs`, `known`, `noLongerDifference` and `notRun`, each the number of rows of `report.json` with the status `match`, `differs`, `known`, `stale-known` and `not-run`; `imageTag` (the Playwright image of the lockfile, from `container.mjs`); `prototypeSha256` (the hash in `e2e/parity/prototype.sha256`). It holds no name or address of a person. Check: a test compares the object with the expected one for a fake result.
- R8. With `--no-images` the folder has no `images/` and `meta.json` says `withImages: false`. By default the images are kept. Check: a test for each.
- R9. With `--no-run` the command does not delete anything (R2) and does not run the check: it keeps what the output folder `e2e/assets/parity/` holds, and `meta.json` says `ran: false`. It prints the summary line of the report and how old the report file is, so that the builder sees what was kept. With no `report.json` there (R4) it keeps nothing. Check: a test with a report that is an hour old.
- R10. A kept run is never replaced by accident: when the folder of R5 exists, the command stops with exit code 1 and names the folder. With `--update` it replaces the folder as a whole (a file that the old run had and the new one has not is gone). Check: a test for each, and a test that the old folder is unchanged after the refusal.
- R11. A working tree has uncommitted changes when `git status --porcelain` lists at least one path outside `docs/ui-parity/` (the kept runs themselves, not yet committed, do not count). In that case the command still keeps the run, writes `dirty: true` (R7), puts `-dirty` in the name (R5) and prints one warning that gives the number of files, because the commit then does not say what code the run came from (concern 3). Check: a test with a fake `git` that answers with changes, and one with changes only under `docs/ui-parity/`.
- R12. After each save the command writes `docs/ui-parity/index.md` again from the `meta.json` of every folder of `docs/ui-parity/`: a heading, one sentence on what the file is, and a table with a row for each kept run, newest first (by `date`, then by folder name), with the columns Date (UTC), Commit (a link to the `report.md` of the folder), Branch, Tree (`clean` or `dirty`), Match, Differs, Known, No longer, Not run. A folder without a readable `meta.json` is left out with a warning. Because the list is made from the folders, a run that was removed by hand is gone from it at the next save. Check: a test with three folders, one removed, and one with a bad `meta.json`.
- R13. The command builds the folder in a temporary folder of `docs/ui-parity/` and moves it to its name only when it is complete, and with `--update` it keeps the old folder until the new one is in place. An error while copying leaves no partial folder and, with `--update`, the old folder as it was. A temporary folder that an earlier crash left behind is removed at the start. Check: a test where the copy fails half way.
- R14. When it has saved, the command prints the folder, the counts, and the next step (`git add docs/ui-parity`), and exits with 0. Check: a test of the printed lines.
- R15. The command runs only commands of `git` that read (`rev-parse`, `status`) and never one that changes the repository. Check: a test with a fake `git` that fails the test on any other command.
- R16. `e2e/parity/README.md` has a section "Keep the results" (what `pnpm ui:save` does, its four options, and that the builder commits the folder), `CLAUDE.md` has the row `pnpm ui:save [--no-run] [--no-images] [--update]` and `pnpm ui:save --prune <n>` in "Common commands" and the row `docs/ui-parity/` in "Where documents live". Check: the files hold them.
- R17. The pull request that builds this ticket holds the first kept run, made by `pnpm ui:save` on a clean tree, and `pnpm format:check`, `pnpm lint`, `pnpm typecheck` and `pnpm test` pass with it there. The new pure functions have `node:test` tests listed in the `test` script. Check: the folder is in the pull request, and the four commands exit 0 (the server database tests need `TEST_DATABASE_URL`, as for every pull request).

- R18. `pnpm ui:save --prune <n>` (n a whole number of at least 1) does not run the check, does not save and does not delete anything. It lists the kept runs newest first (by `date` of `meta.json`, then by folder name), keeps the newest `n` and prints, for each older run, the command `git rm -r docs/ui-parity/<folder>` for the builder to run, and says that the list `index.md` is made again by the next save (R12). A folder without a readable `meta.json` is not counted and is named. With nothing older than the newest `n` it says so. It exits with 0. A value of `n` that is not a whole number of at least 1 stops it with exit code 2. Check: a test with five folders and `n` of 2 (three commands printed, in order), one with `n` larger than the number of folders, one with a bad `n`, and a test that no file was deleted (R15).

## Design
### How a save goes
1. Read the arguments (R1). Read `HEAD`, the branch and the working tree (R5, R7, R11), with read-only `git` commands (R15).
2. Without `--no-run`: delete the old report (R2), run the check and wait (R3).
3. Read `e2e/assets/parity/report.json` (R4). Count the rows by status (R7).
4. Work out the name (R5). Refuse if it exists and there is no `--update` (R10).
5. Build the folder in a temporary folder (R13): copy `report.md`, `report.json` and, unless `--no-images`, `images/`; write `meta.json`. Move it into place.
6. Write `docs/ui-parity/index.md` again (R12). Print the result (R14).

### `meta.json` and the list
```json
{
  "date": "2026-11-25T08:03:25.000Z",
  "commit": "b0a772df...",
  "branch": "main",
  "dirty": false,
  "dirtyFiles": 0,
  "ran": true,
  "withImages": true,
  "counts": { "match": 24, "differs": 0, "known": 6, "noLongerDifference": 0, "notRun": 0 },
  "imageTag": "mcr.microsoft.com/playwright:v1.65.1-noble",
  "prototypeSha256": "8afc5b13..."
}
```
`docs/ui-parity/index.md`:
```
| Date (UTC) | Commit | Branch | Tree | Match | Differs | Known | No longer | Not run |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-25 | [b0a772d](2026-11-25-b0a772d/report.md) | main | clean | 24 | 0 | 6 | 0 | 0 |
```

### History growth
A run today is about 1 MB: 18 images (the six references 440 KB, the six app images 296 KB, the six differences 320 KB), a report of 4 KB and a record of 12 KB. Git stores a file of the same content once, wherever it is, and the check gives the same images for the same code (TOKI-109: the same ratios in every run). So a kept run of an unchanged app adds almost nothing to the history, and the references, which are also in `e2e/parity/reference/`, cost nothing again while they do not change. What grows the history is a change of what a screen draws: about 0.6 MB of app and difference images for the six images of one screen declaration, and more with each screen added (concern 4). The folders in the working tree grow with every kept run until they are removed by hand.

### Layout
```
tools/ui-parity/
├─ save.mjs            the command, and the pure functions it uses (name, counts, meta, list)
└─ save.test.mjs       node:test, with temporary folders and a fake runner and a fake git
docs/ui-parity/
├─ index.md            the list of kept runs, made by the command
└─ <date>-<commit>/    one kept run: report.md, report.json, images/, meta.json
package.json            script ui:save, and the test file in the test script
e2e/parity/README.md    section "Keep the results"
CLAUDE.md               two rows (R16)
```

## Testing
- The functions are written first and seen to fail: the argument parser, the name of the folder, the count of rows by status, `meta.json`, the list (`index.md`), and the save with a fake runner (a function that stands for the check), a fake `git` (answers from a table, fails on a command that changes) and a real temporary folder. They follow the existing `node:test` files of `tools/ui-parity/` and are listed in the `test` script.
- Each requirement of R2 to R15 has a test named after it.
- The command is run once by hand on a clean tree after the tests, in the container, and its output is recorded in the pull request; its result is the first kept run (R17).
- Data used is fake only: the prototype's invented sample data and the stubbed data of the check.

## Data safety
- The images and the report hold only the invented data of the prototype and the stubbed data of the check (TOKI-109); no real person, address or secret goes into the repository.
- `meta.json` holds a commit, a branch name, counts, a Playwright image tag and a file hash. It holds no author name or address.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| The builder runs it by hand, when needed. CI does not save or push results; the kept results reach the repository through a pull request | R1, R14, R15; Scope, Out (no CI, no commit) |
| The kept results live under `docs/ui-parity/`; Prettier already ignores `docs/` | R5, R6, R12; R17 (`pnpm format:check` and `pnpm lint` pass with a kept run) |
| By default a kept run includes all the images; there is a way to leave the images out | R6, R8 |
| A run that gave no result keeps nothing, and a kept run is never replaced by accident | R2, R4, R10, R13 |
| The check and its report do not change; this work only keeps what the check writes | Scope, Out; R3 runs the check as it is, R6 copies its files as they are |
| The images are binary files that git cannot store as small differences, so the history grows with every kept run and with every screen added | Design, "History growth" (identical files are stored once; a change of a screen is what grows it); concern 4 |

## Open questions from the intent
- What a line of the list of kept runs holds, and in which order the runs are listed. Answered: a table made from the folders, newest first, with the date, the commit (a link to the report), the branch, the tree and the five counts (R12). Decided by Thanh Truong (lead, as product owner) on 2026-11-26. See concern 1.
- How old kept runs are removed: by hand, or by a command that keeps the newest few. Answered: a command `--prune <n>` that keeps the newest `n` and only prints the `git rm` commands for the others; it never deletes (R18). Decided by Thanh Truong (lead, as product owner) on 2026-11-26. See concern 2.
- Whether keeping a run when the working tree has uncommitted changes is refused or only warned. Answered: the run is kept, marked (`dirty` in `meta.json`, `-dirty` in the name) and a warning is printed (R5, R7, R11). Decided by Thanh Truong (lead, as product owner) on 2026-11-26. See concern 3.
- How much growth of the history is acceptable as screens are added, and what to do when it is too much. Answered: it is accepted and there is no limit now; the facts are in Design, "History growth". Decided by Thanh Truong (lead, as product owner) on 2026-11-26. See concern 4.

## Areas of concern
1. The list of kept runs (R12). A table made from the folders, newest first, with the columns Date (UTC), Commit (a link to the report), Branch, Tree, Match, Differs, Known, No longer and Not run. Because the list is made again at every save, two pull requests that each add a run can conflict on `index.md`; the next save repairs it. Decided by Thanh Truong (lead, as product owner) on 2026-11-26. Owner: Thanh Truong.
2. Removing old kept runs. `--prune <n>` keeps the newest `n` and prints the `git rm -r` commands for the older runs; it never deletes anything itself, so a folder that is not yet committed cannot be lost by the command (R18). The list `index.md` is made again by the next save, so it still shows the removed runs until then. Decided by Thanh Truong (lead, as product owner) on 2026-11-26. Owner: Thanh Truong.
3. A tree with uncommitted changes (R11). The run is kept, marked and warned about, not refused. The mark `-dirty` in the name is an addition to the name `<date>-<commit>` that was agreed in the conversation, so that a clean and a dirty run of one commit do not collide. Decided by Thanh Truong (lead, as product owner) on 2026-11-26. Owner: Thanh Truong.
4. Growth of the history. Identical files cost nothing and a change of a screen costs about 0.6 MB per six images; a kept run keeps the reference images too (440 KB, stored once while they do not change). Decided by Thanh Truong (lead, as product owner) on 2026-11-26: accept it, with no limit now; `--no-images` (or Git LFS, in another ticket) is the answer when the repository grows too large. Owner: Thanh Truong.
5. `--no-run` (R9) can keep an old report, or the report of a partial run. Decided by Thanh Truong (lead, as product owner) on 2026-11-26: the command only prints the summary line and the age of the report, and writes `ran: false`; there is no stronger guard. Owner: Thanh Truong.
