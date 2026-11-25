# QA record: TOKI-001
Ticket: TOKI-001
Spec: docs/specs/2026-11-12-monorepo-typescript-setup-design.md
Version: f011a9c
Environment: a temporary worktree of the Version under Node 22 (`~/.nvm`), pnpm 12.21.0 through corepack, macOS; the repository itself is not changed

Role: Dev is Thanh Truong with Claude (the ticket was built before this record). QA is Thanh Truong. Claude drafted the rows; the QA approved all 13 in chat on 2026-11-25 ("Duyệt, chạy") before any row was run. Claude ran the command rows for the QA.

Each row runs `V=f011a9c bash docs/qa/TOKI-001.checks.sh <ID>` (called `checks` below) and compares its one output line with Expected. The output goes in `docs/qa/TOKI-001.evidence.txt`. `f011a9c` is the merge commit of the pull request of TOKI-001 (PR #54, 2026-11-16), decided in concern 1 of the spec of this record.

## Test matrix
| ID | Requirement | Layer | Steps | Expected | Evidence | Priority | Approved | Result | Run |
|---|---|---|---|---|---|---|---|---|---|
| T1 | R1 | command | `checks T1` | `T1 1 0`: both globs in `pnpm-workspace.yaml`, `pnpm install --frozen-lockfile` exits 0 | docs/qa/TOKI-001.evidence.txt, line T1 | P1 | QA Thanh Truong, 2026-11-25 | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T2 | R2 | command | `checks T2` | `T2 8 0`: eight workspace projects, none missing or extra | docs/qa/TOKI-001.evidence.txt, line T2 | P1 | QA Thanh Truong, 2026-11-25 | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T3 | R3 | command | `checks T3` | `T3 0`: none of `apps/mobile`, `apps/desktop`, `packages/ui-native` exists | docs/qa/TOKI-001.evidence.txt, line T3 | P2 | QA Thanh Truong, 2026-11-25 | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T4 | R4 | command | `checks T4` | `T4 8 24 0`: eight projects with exactly the three files, 24 files in all, none not as specified | docs/qa/TOKI-001.evidence.txt, line T4 | P1 | QA Thanh Truong, 2026-11-25 | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T5 | R5 | command | `checks T5` | `T5 4 8 0`: four base settings, eight project configs extend the base, no forbidden setting in a project config | docs/qa/TOKI-001.evidence.txt, line T5 | P1 | QA Thanh Truong, 2026-11-25 | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T6 | R6 | command | `checks T6` | `T6 0 8`: `pnpm typecheck` exits 0 and eight projects report `typecheck: Done` | docs/qa/TOKI-001.evidence.txt, second run, line T6 | P1 | QA Thanh Truong, 2026-11-25 (re-approved) | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T7 | R7 | command | `checks T7` | `T7 8 8`: a type error in each of the eight projects fails `pnpm typecheck` and prints that file path | docs/qa/TOKI-001.evidence.txt, line T7 | P1 | QA Thanh Truong, 2026-11-25 | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T8 | R8 | command | `checks T8` | `T8 node 22.x 22.x error 22`: runtime name, `engines.node`, `devEngines` version, `onFail`, `.nvmrc` | docs/qa/TOKI-001.evidence.txt, second run, line T8 | P2 | QA Thanh Truong, 2026-11-25 (re-approved) | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T9 | R8 | command | `checks T9` | `T9 1 1 0 v24`: install under Node 24 exits non-zero with `ERR_PNPM_BAD_RUNTIME_VERSION` and installs nothing; the Node major used is printed | docs/qa/TOKI-001.evidence.txt, second run, line T9 | P1 | QA Thanh Truong, 2026-11-25 (re-approved) | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T10 | R9 | command | `checks T10` | `T10 1 1 1 0`: exact pnpm pin, `pnpm --version` equals it, lockfile tracked, no other lockfile | docs/qa/TOKI-001.evidence.txt, line T10 | P2 | QA Thanh Truong, 2026-11-25 | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T11 | R10 | command | `checks T11` | `T11 2 2`: both apps declare `@toki/shared` as `workspace:*` and an import of it type-checks | docs/qa/TOKI-001.evidence.txt, line T11 | P1 | QA Thanh Truong, 2026-11-25 | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T12 | R11 | command | `checks T12` | `T12 1 2 0 0`: exact `.gitignore` patterns, `.env` and `.env.local` ignored, the example not ignored, `git status --porcelain` empty after install and type check | docs/qa/TOKI-001.evidence.txt, line T12 | P2 | QA Thanh Truong, 2026-11-25 | Pass | Claude for QA Thanh Truong, 2026-11-25 |
| T13 | R12 | command | `checks T13` | `T13 1 0 0 0`: exact `dev` script, no project has a `dev` script, `pnpm dev` exits 0 and prints no line of a started `dev` script | docs/qa/TOKI-001.evidence.txt, second run, line T13 | P2 | QA Thanh Truong, 2026-11-25 (re-approved) | Pass | Claude for QA Thanh Truong, 2026-11-25 |

## Not covered
- None: every requirement R1 to R12 of the spec has a row (R8 has two, one for the fields and one for the refusal of another Node major).

## Result notes
- Rows T6, T8, T9 and T13 were strengthened after the first verifier round of TOKI-112 (T6 never counted the projects type-checked; T8 never compared the runtime name; T9 accepted a loose pattern and did not print the Node used; T13 did not look at what `pnpm dev` started). Their Expected changed, so the QA approved them again in chat on 2026-11-25 and Claude reran them. The first run of these four rows, with the old checks, is kept in the evidence file under its own heading.
- All 13 rows are Pass at `f011a9c`: each output line equals Expected, and the script gave the same lines on a second run. T6, T8, T9 and T13 are Pass on their second run, with the strengthened checks. The last evidence line shows the script left the repository's worktree list and status as they were.
- T9 is Pass on its second run: under `v24` (printed by the check) the install exits non-zero with `ERR_PNPM_BAD_RUNTIME_VERSION` and installs nothing.
- The Version is the ticket as delivered. Compared with `main` on 2026-11-25 (not judged here): `apps` and `packages` hold 967 files instead of 24 (R4 would no longer hold), `apps/server` and `apps/web` have a `dev` script (R12, "no project has a `dev` script" would no longer hold), and the root `typecheck` script has changed. The eight projects are still the same. These changes were made by later tickets; the repository as it stands is for the acceptance ticket of I01 to judge.
- For the acceptance of I01 (the `done` line: `pnpm dev` runs, CI is green, lint blocks a package-boundary violation), T13 feeds the first part (`pnpm dev` exits 0 at the Version; the current `main` must be run again). CI (TOKI-007) and the lint rule (TOKI-002) are not rows of this record. Nothing here judges a criterion.

