# Intent: Save the results of the UI parity check
Author: Thanh Truong

## Problem
The UI parity check (TOKI-109) writes a report and images each time it runs, and then loses them: the folder they are written to is ignored by git, and CI keeps its copy for 7 days only. Nobody can look back at how the app compared with the prototype on an earlier date or commit, or see how the differences change as screens are added.
Source: the spec of TOKI-109 (R11, R15); the artifact of the `ui parity` job in `.github/workflows/ci.yml`.

## Proposed outcome
- The builder can keep the results of a run in the repository whenever they choose, with one command, and without CI.
- A kept run says when it was made, on which commit and branch, and whether the working tree had uncommitted changes, so that it can be read and trusted later.
- The kept runs can be found in one place, with the counts of each (how many match, differ, are known).
- A kept run holds the report and the images of each screen, and is committed in a pull request like any other file.
Source: the requirement of this run.

## Affected users and systems
- Users: the builder, who runs the check, and the reviewer of a pull request, who can read the kept results. End users of Toki are not affected.
- Systems: the UI parity check (`tools/ui-parity/`, `e2e/parity/`), the `docs/` folder of the repository, and the size of the git history.

## Constraints
- The builder runs it by hand, when needed. CI does not save or push results: the repository forbids pushing to `main`, so the kept results reach the repository through a pull request.
- The kept results live under `docs/ui-parity/`. Prettier already ignores `docs/`, so a generated report does not break `pnpm format:check`.
- By default a kept run includes all the images (about 1 MB for a run today); there is a way to leave the images out.
- A run that gave no result (the check failed before it could report) keeps nothing, and a kept run is never replaced by accident.
- The check and its report do not change (TOKI-109); this work only keeps what the check writes.
- The images are binary files that git cannot store as small differences, so the history grows with every kept run and with every screen added.
Source: the requirement of this run; `CLAUDE.md` (Working agreements).

## Open questions
- What a line of the list of kept runs holds, and in which order the runs are listed.
- How old kept runs are removed: by hand, or by a command that keeps the newest few.
- Whether keeping a run when the working tree has uncommitted changes is refused or only warned.
- How much growth of the history is acceptable as screens are added, and what to do when it is too much (leave the images out, or keep only some).
