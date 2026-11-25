# QA record: TOKI-002
Ticket: TOKI-002
Spec: docs/specs/2026-11-12-lint-format-boundary-rules-design.md
Version: 6e7f0fa
Environment: a temporary worktree of the Version under Node 22 (`~/.nvm`), pnpm through corepack, ESLint and Prettier as pinned in the lock file, macOS; the repository itself is not changed

Role: Dev is Thanh Truong with Claude (the ticket was built before this record). QA is Thanh Truong. Claude drafts the rows; the QA approves them before any row is run. Claude runs the command rows.

Each row runs `V=6e7f0fa bash docs/qa/TOKI-002.checks.sh <ID>` (called `checks` below) and compares its one output line with Expected. The output goes in `docs/qa/TOKI-002.evidence.txt`. `6e7f0fa` is the merge commit of PR #77, which re-landed TOKI-002 after PR #70 reverted PR #68 (concern 1 and R6 of the spec of this record). The spec of TOKI-002 was revised by PR #252 after this commit, so a row may fail on a requirement the code did not have to meet when it was merged; the result notes say so.

## Test matrix
| ID | Requirement | Layer | Steps | Expected | Evidence | Priority | Approved | Result | Run |
|---|---|---|---|---|---|---|---|---|---|
| T1 | R1 | command | `checks T1` | `T1 0 1`: `pnpm lint` exits 0 on the clean tree and a violating file under `dist/` is ignored |  | P1 |  |  |  |
| T2 | R13 | command | `checks T2` | `T2 3 1`: the three boundary rules are at severity `error` in the computed config, and a warning makes `pnpm lint` fail |  | P1 |  |  |  |
| T3 | R14 | command | `checks T3` | `T3 1`: the config file carries the comment that file picking in `ui-web` is not checked by lint |  | P3 |  |  |  |
| T4 | R2 | command | `checks T4` | `T4 0 1 1`: `pnpm format:check` exits 0 on the clean tree; a badly formatted file makes it exit non-zero and it is named |  | P1 |  |  |  |
| T5 | R3, R4 | command | `checks T5` | `T5 0 0`: after `pnpm format` on a badly formatted file, `pnpm format:check` and `pnpm lint` on that file both exit 0 |  | P1 |  |  |  |
| T6 | R5 | command | `checks T6` | `T6 60 60 4`: 15 cases fire in each of `client-core`, `shared`, `i18n` and `tokens`, and the allowed globals pass in each |  | P1 |  |  |  |
| T7 | R5 | command | `checks T7` | `T7 15 15`: the same 15 cases fire in `packages/platform` (the revised spec of PR #252 lists `platform`) |  | P1 |  |  |  |
| T8 | R6 | command | `checks T8` | `T8 24 24`: six import cases (`react-dom`, `react-dom/client`, `@toki/ui-web`, `@toki/ui-web/button`, a relative path into `ui-web`, a dynamic `import()`) fire in each of the four packages |  | P1 |  |  |  |
| T9 | R6 | command | `checks T9` | `T9 12 12`: `@toki/platform/web`, its subpath and a relative path into `platform/src/web` fire in each of the four packages (the revised spec lists them) |  | P2 |  |  |  |
| T10 | R7 | command | `checks T10` | `T10 2 2 1`: another module's inner file and its nested `index.ts` fail, an import inside the same module at any depth passes |  | P1 |  |  |  |
| T11 | R8 | command | `checks T11` | `T11 3 3`: `../b`, `../b/index` and `../b/index.js` all pass |  | P1 |  |  |  |
| T12 | R17 | command | `checks T12` | `T12 1 1 1`: a file outside `modules/` importing a module's inner file fails, its `index.ts` passes |  | P1 |  |  |  |
| T13 | R9 | command | `checks T13` | `T13 15 15`: seven bare globals, `navigator.serviceWorker`, `document.cookie`, three access forms, one nested form, one destructuring and `<audio>` fire in `packages/ui-web` |  | P1 |  |  |  |
| T14 | R10 | command | `checks T14` | `T14 0`: importing the same features from `@toki/platform` in `ui-web` raises no error |  | P2 |  |  |  |
| T15 | R15 | command | `checks T15` | `T15 7 7 4`: for the seven paths the computed config holds the boundary rule at `error` with inline config off; for the four packages the globals are the allow list and no browser global |  | P2 |  |  |  |
| T16 | R16 | command | `checks T16` | `T16 5 5 5`: each of five inline comment forms in a covered path still reports the violation, produces a message with a line, and makes `pnpm lint` fail |  | P1 |  |  |  |

## Not covered
- R11. It asks that each boundary rule be shown to fire by hand when it was built, with the evidence in the original pull request. Rows T6 to T13 and T16 show each rule firing again at the Version.
- R12. Dropped in the spec of TOKI-002 (concern 13); there is nothing to check.
