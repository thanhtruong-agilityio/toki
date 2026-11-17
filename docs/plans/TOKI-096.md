# TOKI-096 Environment configuration - implementation plan

**Goal:** one file, `docs/environment-config.md`, lists every phase 1 environment variable, the values that come from outside and how secrets are kept; `.env.example` at the root carries the same names.

**Spec:** `docs/specs/2026-11-12-environment-config-design.md` (R1 to R13). Tier S: documents only, no code, no design stage.

## Choices

1. **Names.** Names already read on `main` by TOKI-003 stay: `NODE_ENV`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_TEST_DB`, `POSTGRES_PORT`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_BUCKET`, `MINIO_PORT`, `MINIO_CONSOLE_PORT`, `MAILPIT_SMTP_PORT`, `MAILPIT_WEB_PORT`. Names the sibling specs already write stay: `DATABASE_URL`, `TEST_DATABASE_URL`, the seven mail names of TOKI-021 (`SMTP_HOST`, `SMTP_PORT`, `SMTP_TLS`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`), `FIRST_ADMIN_EMAIL`, `FIRST_ADMIN_NAME`, `WORKSPACE_NAME`. New names chosen here: `SERVER_PORT`, `SERVER_HOST`, `LOG_LEVEL`, `APP_DOMAIN`.
2. **Two SMTP port rows.** TOKI-021 wants one row (`SMTP_PORT`) shared with the Mailpit host port, but `main` already reads `MAILPIT_SMTP_PORT` in compose (TOKI-003 R25: one variable per published port) and production needs its own SMTP port. Both rows exist; in development both are `1025`. Recorded in the pull request.
3. **No row** for the web dev server port (fixed 5173 by TOKI-006), for backup storage (concern 4), nor for later-phase values (concern 7).

## AC -> step -> test

| Requirement | Step | Test (by hand, output pasted in the PR) |
| :-- | :-- | :-- |
| R1, R2, R4, R11, R12 | Write the inventory table in `docs/environment-config.md` | Read row by row against each requirement |
| R6 | External values table: domain, mail account, VPS | Read: three rows, no backup row, mail row holds no address |
| R7 | "How secrets are kept": development and production entries | Read |
| R3, R5 | Write `.env.example` from the inventory | Sort both name lists and `diff`; compare each non-secret value; fill a throwaway `.env` in a temp dir and check no required variable is empty |
| R8 | none (TOKI-001 patterns) | `git check-ignore` on `.env`, `.env.local`, `apps/server/.env`, `.env.example` |
| R9 | none | Secret rows empty in both files; search for `://user:pass@`, long random strings, key prefixes |
| R10, R13 | none | R10: merge order is a planning fact; R13: pending until TOKI-008 |

## Risks (riskiest step first)

- A name here disagrees with a name `main` reads: check with `grep` over `docker-compose.dev.yml` and `scripts/` that every name they read is in the inventory.
- A secret slips into a committed file: R9 search before the commit.
- `NODE_ENV` is set by Vite and Vitest themselves; noted in the inventory so TOKI-004 and TOKI-006 know.
