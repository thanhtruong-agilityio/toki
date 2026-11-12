# Intent: Local development environment
Author: Thanh Truong

## Problem
Toki needs a database, S3-compatible file storage and email to work. Sign-in sends a 6-digit code by email.
Nothing has been committed to the repository yet, so the builder has none of these services on the development machine.
Without them, later foundation work cannot start. The database work in TOKI-005 is the first to be blocked.
During development the builder also needs a way back to a clean state, for all data or for one kind of data, without harming anything outside development.

Source: Toki Blueprint, Product and Status sections; ticket TOKI-003.

## Proposed outcome
The builder can start every backing service that Toki needs for development with one command.
The builder can stop the services and keep their data.
The builder can reset the database, the stored files or the caught mail one at a time, or all three at once to return to a clean state.
Email sent during development stays on the development machine, where the builder can read it.
No reset can harm the configuration, the test database or production.
Later tickets can rely on these services being available locally.

## Affected users and systems
- The builder (one person building with Claude). Source: Toki Blueprint, intent I01 repo-foundation.
- The local development environment of the Toki repository.
- Later work that needs the services, starting with TOKI-005.

## Constraints
- The services are Postgres, MinIO and Mailpit, run from `infra/docker-compose.dev.yml`. Source: Toki Blueprint, ticket TOKI-003.
- The commands are scripts in the root `package.json`. Source: Toki Blueprint, ticket TOKI-003.
  - `dev:up` starts the services.
  - `dev:down` stops them and keeps data.
  - `dev:reset:db` wipes Postgres and re-runs migrations.
  - `dev:reset:files` empties the MinIO bucket.
  - `dev:reset:mail` clears the Mailpit inbox.
  - `dev:reset` does all three.
- No reset touches `.env` or the test database. Every reset refuses to run in production. Source: Toki Blueprint, ticket TOKI-003.
- A partial reset can leave references between the three (messages pointing at deleted files, old codes in the inbox). `dev:reset` is the one that returns a clean state. Source: Toki Blueprint, ticket TOKI-003.
- Sample data is not part of this ticket: the `dev:seed` script comes in TOKI-081, at the end of M3. Source: Toki Blueprint, ticket TOKI-081 and plan notes.
- The agreed stack names Postgres 17 and MinIO. Development uses Mailpit. Source: Toki Blueprint, technical design.
- Secrets live in `.env`, never in git. Source: Toki Blueprint, technical design (infrastructure).
- Milestone: M1 Foundation and design system. The M1 exit check includes "pnpm dev runs".
- Size: M (about one working session with Claude).
- Needs: TOKI-001 (pnpm monorepo and TypeScript).
- Needed by: TOKI-005 (Drizzle, migrations and the workspaces table).
- Belongs to Blueprint intent I01 repo-foundation, alongside TOKI-001 to TOKI-008.

## Open questions
- `dev:reset:db` re-runs migrations, but the migration workflow arrives in TOKI-005, which needs this ticket. What does `dev:reset:db` do before TOKI-005 is done?
