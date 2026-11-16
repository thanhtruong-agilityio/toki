# Intent: Database connection, migrations and the workspaces table
Author: Thanh Truong

## Problem
Toki keeps its data in Postgres, but nothing has been committed to the repository yet.
The server has no connection to the database.
There is no agreed way to change the database structure over time.
No table exists. Every later table must carry `workspace_id`, so the workspaces table has to come first.
Until this is in place, the test harness (TOKI-008) cannot run against a real Postgres.

## Proposed outcome
The server can reach the Postgres database.
The builder has one repeatable way to change the database structure.
The first table, workspaces, exists in the database.
Later tickets can add their own tables in the same way instead of inventing it.

## Affected users and systems
- The builder (Thanh working with Claude), who is the user of Blueprint intent I01.
- The server app (`apps/server`).
- The development Postgres database provided by TOKI-003.
- The test harness (TOKI-008), which builds on this ticket.

## Constraints
- Scope is fixed to three things: Postgres connection, the migration workflow, the first table. Source: Toki Blueprint, ticket TOKI-005.
- Database tooling is already decided: Drizzle on Postgres 17, with Node 22 and TypeScript. Source: Toki Blueprint, technical design (Stack).
- Every table carries `workspace_id` to keep a path to multi-tenant. IDs are UUIDv7. Source: Toki Blueprint, data model notes.
- Server modules call each other only through public interfaces, never each other's tables. Source: Toki Blueprint, boundary rules.
- Secrets live in `.env`, never in git. Source: Toki Blueprint, infrastructure.
- Milestone: M1 "Foundation and design system". Source: Toki Blueprint.
- Size: S (about half a working session with Claude). Source: Toki Blueprint, ticket TOKI-005.
- Needs: TOKI-003 (Local development environment) and TOKI-004 (Fastify server skeleton). Source: Toki Blueprint, ticket TOKI-005.
- Needed by: TOKI-008 (Test harness), TOKI-019 (Account tables, M2) and TOKI-064 (Background job queue, M4). Source: Toki Blueprint, ticket list, Needs column.
- The `dev:reset:db` script from TOKI-003 wipes Postgres and re-runs migrations, so it depends on the migration workflow made here. Source: Toki Blueprint, ticket TOKI-003.
- Belongs to Blueprint intent I01 repo-foundation, alongside TOKI-001 to TOKI-008.

## Open questions
- The Blueprint lists nothing as open for the spec on this ticket.
- The Blueprint does not say which information the workspaces table holds. What must it record?
