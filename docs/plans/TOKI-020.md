# TOKI-020 First admin from environment variables - implementation plan

**Goal:** on an empty database the server creates, once, the workspace, the first Admin and #general from three environment values; a database with data is left alone; the step never stops the server.

**Spec:** `docs/specs/2026-11-17-first-admin-design.md` (R1 to R21). Tier L: new write path, concurrency (advisory lock), five modules and the process entry. The spec is the design (approved in PR 150); this plan does not repeat it.

## Design

The spec's Design section is the design: `ensureFirstAdmin(deps, hooks?)` in `apps/server/src/first-admin.ts`, called from `main.ts` after `listen`; one attempt = one transaction with `SET LOCAL` timeouts and `pg_advisory_xact_lock(1414482761, 1)`; bounded retry with an injected `sleep`; small public functions in `workspace`, `members` and `conversations`.

## What the code looks like today (checked on main)

- `config.ts` has areas `server`, `database`, `mail`; mail's schema lives in its module. `loadConfig` blanks empty values, and `ConfigError` carries names only. `main.ts` loads `["server","database","mail"]`, builds the app, and has no database client yet.
- `createDb(url)` in `db/client.ts` returns `{ db, close }` and connects lazily. `Db = PostgresJsDatabase` is exported from `modules/conversations/facts.ts`; `createGeneralChannel` and `addMemberToGeneral` already exist (TOKI-028) and use it.
- `workspace/index.ts` and `members/index.ts` export nothing (`export {}`). So `listWorkspaceIds`, `createWorkspace`, `countAccounts`, `createFirstAdminAccount` are new.
- `packages/shared` has no `email.ts` and no `parseEmail`.
- Process tests (`src/tests/main.test.ts`) and `config.test.ts` build fake environments; CI (`.github/workflows/ci.yml`) starts no server with a real environment.
- `docs/environment-config.md` already names the three variables. It marks `FIRST_ADMIN_NAME` **Required: yes**, but R1 says optional. Plan: follow the spec and change that one cell to "no" in this PR.

## AC -> step -> test

| Requirement | Step | Test |
| :-- | :-- | :-- |
| R16 | 1. `parseEmail` in `packages/shared/src/email.ts`, exported from `index.ts` | unit tests in `packages/shared` (well-formed and not, 254/255, 64/65 local part) |
| R1 to R4 | 2. `firstAdmin` area in `config.ts` (names `FIRST_ADMIN_EMAIL`, `FIRST_ADMIN_NAME`, `WORKSPACE_NAME`), checks, limits | `src/tests/config.test.ts`: missing, blank, bad address, 100/101 and 80/81 limits, names only in the error, names present in `.env.example` (R2) |
| R14 | 3. Four small functions and exports in `workspace` and `members` (`accounts.ts`); `db/advisory-locks.ts` | export-name test; `pnpm lint` |
| R5, R6, R17 | 4. `ensureFirstAdmin` happy path: lock, counts, rows, display name | `first-admin.db.test.ts`: four rows, `minh` from address, `archived_at` update refused |
| R7, R8 | 5. Skip / adopt one workspace / several workspaces | same file: counts after three runs, other variables ignored |
| R9 | 6. Advisory lock check | two clients, hook `afterCount`, `pg_locks`, one `created` and one `skipped` |
| R10, R11 | 7. One transaction, never throws, `failed` result | hooks that throw after each write; unreachable port; database with no migration |
| R18, R19, R20 | 8. Retry list, 10 s statement and lock timeouts, attempt timeout, abort signal | fake `sleep` tests: attempts, delay, deadline, abort (no new attempt, one `first_admin_stopped` line) |
| R13, R15 | 9. The log lines and nothing else; no mail import | captured log searched for address and name; import-line test |
| R12 | 10. `main.ts`: build db client, call after `listen`, close hook | database-free process test (still listens, `/healthz` ok, Postgres down) and `first-admin.process.db.test.ts` |
| R21 | 11. Fake values on `@example.com` and `Test Workspace` in every fake environment that starts the server or builds a config (`config.test.ts`, `main.test.ts`, others found by search); the one cell of `docs/environment-config.md` | `pnpm test:unit` and `pnpm test` pass; a start without the values exits 1 |

Each step: write the test, run it and see it fail for the right reason, then write the code.

## Risks (riskiest step first)

1. **Concurrency (step 6).** No table constraint limits `workspaces` to one row, so the lock is the only guard. Mitigation: the two-client test with the hook must fail before the lock is added.
2. **Test timeouts and abort (steps 8 and 10).** A real clock would make tests slow or flaky. Mitigation: `sleep` is injected everywhere; the process test uses no retry wait.
3. **Passing `tx` as `Db`.** Drizzle's transaction type differs from `PostgresJsDatabase`. Mitigation: one typecheck in step 3; add the alias to `db/client.ts` only if it fails (spec says so).
4. **Personal data in logs or errors.** Mitigation: log codes only; R13 test searches the whole captured output.
5. **Config breaks other tests.** Required values are added at every start, so any test that starts the real server without them fails. Mitigation: step 11 searches for every `loadProcessConfig` / spawn of `main.ts`.

## Out of scope

The tables (TOKI-019, TOKI-028), the invitation and last-Admin rules (TOKI-024), mail, sign-in, the first-entry screen and card, `/readyz`, migration order (TOKI-085), the installation guide (TOKI-087).

## Hand check (output goes in the PR)

`pnpm dev` after `dev:reset:db` with the development `.env`; read back the four rows with `psql`. Sign-in as the first Admin waits for TOKI-021 and TOKI-022.
