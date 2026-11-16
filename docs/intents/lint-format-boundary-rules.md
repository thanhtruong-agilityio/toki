# Intent: Lint, format and package boundary rules
Author: Thanh Truong

## Problem
Nothing has been committed to the Toki repository yet, so no shared rule for code style, formatting or package boundaries exists.
The Blueprint agrees three boundary rules between packages and server modules, but nothing checks them.
Without a check, a boundary can be broken without anyone noticing. For example, `client-core` could start to depend on the browser, and then React Native could not reuse it in phase 3.
Later work also depends on this: CI (TOKI-007) needs a lint step to run.

## Proposed outcome
All code in the repository follows one agreed style and one agreed format.
The builder is told when code breaks an agreed package boundary, and that code is blocked.
The builder (Thanh and Claude) can rely on the boundaries holding as the code grows, without checking them by hand.
This ticket supplies the "lint blocks a package-boundary violation" part of what Blueprint intent I01 calls done.

## Affected users and systems
- Users: the builder (one person building with Claude). Source: Toki Blueprint, intent I01 repo-foundation.
- Systems: the Toki monorepo, its packages and apps created by TOKI-001; in particular `client-core`, the server modules, the components and the `platform` package.
- CI (TOKI-007) uses the result of this ticket.

## Constraints
- Belongs to Blueprint intent I01 repo-foundation, alongside TOKI-001 to TOKI-008. Source: Toki Blueprint, intent list.
- Milestone: M1, Foundation and design system. Source: Toki Blueprint, milestone M1.
- Size: M, about one working session with Claude. Source: Toki Blueprint, ticket TOKI-002.
- Needs: TOKI-001 (Set up the pnpm monorepo and TypeScript). Source: Toki Blueprint, ticket TOKI-002.
- Needed by: TOKI-007 (CI on GitHub Actions). Source: Toki Blueprint, ticket TOKI-007.
- Agreed scope: ESLint and Prettier, and all three boundary rules. Source: Toki Blueprint, ticket TOKI-002.
  - `client-core` imports no DOM or browser API.
  - Server modules do not import each other's internals.
  - `ui-web` does not call platform APIs directly (notifications, storage, service worker, audio) and goes through `platform`.
- File picking cannot be caught by lint and relies on review. Source: Toki Blueprint, ticket TOKI-002.
- Three boundary rules are fixed and enforced by lint. Source: Toki Blueprint, technical design.
  - Server modules call each other only through public interfaces, never each other's tables.
  - `client-core` touches no DOM or browser API, so React Native can reuse it.
  - Components reach platform features only through `platform`. Lint bans direct use of the notification, storage, service worker and audio APIs in `ui-web`.
- Phase 1 acceptance criterion that this ticket touches: `client-core` imports nothing from the browser. Source: Toki Blueprint, phase 1 acceptance criteria.
- M1 exit check includes "CI is green". Source: Toki Blueprint, milestone M1.

## Open questions
None.
