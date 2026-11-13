# Intent: Server skeleton

Author: Thanh Truong

## Problem

Toki has no server yet. Nothing has been committed to the repository.
Later work needs a running server to build on. The database work (TOKI-005) cannot start without it.
Without one shared base, each later piece of the server would have to decide for itself how to read configuration, how to log, how to report errors and where its addresses live.

## Proposed outcome

A basic Toki server exists that later work builds on. Afterwards, for the builder:

- The server starts in development and reads and checks its configuration values.
- There is one place to ask the server whether it is healthy.
- The server writes structured logs.
- Every error goes back to clients in one single format.
- All API addresses sit under one versioned prefix.

## Affected users and systems

- The builder (one person building with Claude). Source: Toki Blueprint, intent I01.
- The server app (`apps/server`) in the monorepo. Source: Toki Blueprint, technical design.
- Later tickets that build on the server, starting with TOKI-005.
- End users of Toki: no direct effect from this ticket.

## Constraints

- Part of Blueprint intent I01 repo-foundation, alongside TOKI-001 to TOKI-008. Source: Toki Blueprint, intent list.
- Milestone M1: Foundation and design system. Size M (about one working session with Claude). Source: Toki Blueprint, ticket TOKI-004.
- Needs TOKI-001 (monorepo and TypeScript) and TOKI-096 (configuration for each environment). Source: Toki Blueprint, ticket TOKI-004.
- Needed by TOKI-005 (Drizzle, migrations and the workspaces table), TOKI-021 (Sending mail over SMTP, M2) and TOKI-084 (Production image and Compose, M6). Through TOKI-005, TOKI-008 (test harness) also depends on it. Source: Toki Blueprint, Needs column.
- The server is built with Fastify on Node 22 and TypeScript, as a modular monolith. Source: Toki Blueprint, technical design and ticket TOKI-004.
- The API prefix is `/api/v1`. Within a version, fields are only added. Source: Toki Blueprint, technical design and ticket TOKI-004.
- The health check address is `/healthz`. Source: Toki Blueprint, ticket TOKI-004.
- The configuration values come from the inventory made in TOKI-096. Secrets live in `.env`, never in git. Source: Toki Blueprint, ticket TOKI-096 and infrastructure notes.
- M1 exit check that this ticket supports: `pnpm dev` runs and CI is green. Source: Toki Blueprint, milestone M1.

## Open questions

- What is the error format returned to clients? Source: Toki Blueprint, ticket TOKI-004, "Open for the spec".
