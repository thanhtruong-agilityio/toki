# Intent: Set up the pnpm monorepo and TypeScript
Author: Thanh Truong

## Problem
Nothing has been committed to the Toki repository yet. There is no shared place for the server, the web app and the shared packages to live. Every other Repository foundation ticket needs this base before it can start. Without it, later work has no agreed structure to build on.

## Proposed outcome
The repository holds the agreed structure: the two apps and six packages that phase 1 needs exist, empty, and they share one TypeScript configuration. The builder can start the next foundation tickets without deciding again where code goes.

## Affected users and systems
- The builder (Thanh and Claude), who does all later work in this repository.
- The Toki repository: github.com/thanhtruong-agilityio/toki.
- The later tickets that build on this one (see Constraints).

## Constraints
- Blueprint work area: Repository foundation. Source: Toki Blueprint, ticket TOKI-001.
- Milestone: M1 "Foundation and design system". Source: Toki Blueprint, milestone M1.
- Size: S (about half a working session with Claude). Source: Toki Blueprint, ticket TOKI-001.
- Belongs to Blueprint intent I01 repo-foundation, alongside TOKI-001 to TOKI-008. Source: Toki Blueprint, intent I01.
- Needs: no other ticket. Source: Toki Blueprint, ticket TOKI-001, Needs column.
- Needed by: TOKI-002, TOKI-003, TOKI-004, TOKI-006, TOKI-009 (tokens package), TOKI-017 (i18n package), TOKI-018 (platform package) and TOKI-094 (shared date and time rules) directly. TOKI-005, TOKI-007 and TOKI-008 depend on it through those. Source: Toki Blueprint, ticket list, Needs column.
- Scope is fixed: create `apps/server` and `apps/web`, and the six packages `shared`, `client-core`, `tokens`, `i18n`, `platform`, `ui-web`, with shared TypeScript config. Source: Toki Blueprint, ticket TOKI-001.
- Not in this ticket: `apps/mobile`, `apps/desktop` and `ui-native` are added in their own phases. Source: Toki Blueprint, ticket TOKI-001.
- One monorepo, managed with pnpm. Source: Toki Blueprint, ticket TOKI-001 and technical design.
- The full agreed structure also holds `apps/mobile` (phase 3), `apps/desktop` (phase 6) and `ui-native` (phase 3). Source: Toki Blueprint, technical design, code structure.
- Stack: Node 22 and TypeScript. Source: Toki Blueprint, technical design, stack.
- The server and every client share one package of data contracts. Source: Toki Blueprint, technical design.
- Lint, format and package boundary rules are not part of this ticket; they belong to TOKI-002. Source: Toki Blueprint, ticket TOKI-002.
- M1 exit check that this ticket supports: `pnpm dev` runs and CI is green. Source: Toki Blueprint, milestone M1.

## Open questions
None.
