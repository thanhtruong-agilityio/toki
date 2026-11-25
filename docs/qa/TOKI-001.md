# QA record: TOKI-001
Ticket: TOKI-001
Spec: docs/specs/2026-11-12-monorepo-typescript-setup-design.md
Version: f011a9c
Environment: a temporary worktree of the Version under Node 22 (`~/.nvm`), pnpm 12.21.0 through corepack, macOS; the repository itself is not changed

Role: Dev is Thanh Truong with Claude (the ticket was built before this record). QA is Thanh Truong. Claude drafts the rows; the QA approves them before any row is run. Claude runs the command rows.

Each row runs `V=f011a9c bash docs/qa/TOKI-001.checks.sh <ID>` (called `checks` below) and compares its one output line with Expected. The output goes in `docs/qa/TOKI-001.evidence.txt`. `f011a9c` is the merge commit of the pull request of TOKI-001 (PR #54, 2026-11-16), decided in concern 1 of the spec of this record.

## Test matrix
| ID | Requirement | Layer | Steps | Expected | Evidence | Priority | Approved | Result | Run |
|---|---|---|---|---|---|---|---|---|---|
| T1 | R1 | command | `checks T1` | `T1 1 0`: both globs in `pnpm-workspace.yaml`, `pnpm install --frozen-lockfile` exits 0 |  | P1 |  |  |  |
| T2 | R2 | command | `checks T2` | `T2 8 0`: eight workspace projects, none missing or extra |  | P1 |  |  |  |
| T3 | R3 | command | `checks T3` | `T3 0`: none of `apps/mobile`, `apps/desktop`, `packages/ui-native` exists |  | P2 |  |  |  |
| T4 | R4 | command | `checks T4` | `T4 8 24 0`: eight projects with exactly the three files, 24 files in all, none not as specified |  | P1 |  |  |  |
| T5 | R5 | command | `checks T5` | `T5 4 8 0`: four base settings, eight project configs extend the base, no forbidden setting in a project config |  | P1 |  |  |  |
| T6 | R6 | command | `checks T6` | `T6 0`: `pnpm typecheck` exits 0 |  | P1 |  |  |  |
| T7 | R7 | command | `checks T7` | `T7 8 8`: a type error in each of the eight projects fails `pnpm typecheck` and prints that file path |  | P1 |  |  |  |
| T8 | R8 | command | `checks T8` | `T8 22.x 22.x error 22`: `engines.node`, `devEngines` version, `onFail`, `.nvmrc` |  | P2 |  |  |  |
| T9 | R8 | command | `checks T9` | `T9 1 1 0`: install under another Node major exits non-zero, names the version problem, installs nothing |  | P1 |  |  |  |
| T10 | R9 | command | `checks T10` | `T10 1 1 1 0`: exact pnpm pin, `pnpm --version` equals it, lockfile tracked, no other lockfile |  | P2 |  |  |  |
| T11 | R10 | command | `checks T11` | `T11 2 2`: both apps declare `@toki/shared` as `workspace:*` and an import of it type-checks |  | P1 |  |  |  |
| T12 | R11 | command | `checks T12` | `T12 1 2 0 0`: exact `.gitignore` patterns, `.env` and `.env.local` ignored, the example not ignored, `git status --porcelain` empty after install and type check |  | P2 |  |  |  |
| T13 | R12 | command | `checks T13` | `T13 1 0 0`: exact `dev` script, no project has a `dev` script, `pnpm dev` exits 0 |  | P2 |  |  |  |

## Not covered
- None: every requirement R1 to R12 of the spec has a row (R8 has two, one for the fields and one for the refusal of another Node major).
