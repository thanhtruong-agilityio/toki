# Intent: Test harness
Author: Thanh Truong

## Problem
Toki's backend and logic are to be written test-first, and CI is to run tests on every PR. Today nothing has been committed to the repository, so there is no way to run a test of any kind. Without a working test setup, later tickets cannot follow the test-first rule and the M1 exit check "CI is green" has no real tests behind it.
Source: Toki Blueprint, Status, Testing and Infrastructure sections; ticket TOKI-008.

## Proposed outcome
- The builder can run server tests that use a real database, not a stand-in.
- The builder can run a browser end-to-end test against the web app, and one sample test exists to show it works.
- Tests can control the time the code sees, so time-dependent behaviour can be tested.
- Later tickets add their tests to this setup instead of building their own.
Source: Toki Blueprint, ticket TOKI-008 scope.

## Affected users and systems
- Users: the builder (one person building with Claude). Source: Toki Blueprint, intent I01.
- Systems: the server app, the web app, the development database, and CI.
- End users of Toki are not affected directly.

## Constraints
- Belongs to Blueprint intent I01 repo-foundation, alongside TOKI-001 to TOKI-008. I01 is done when `pnpm dev` runs, CI is green, and lint blocks a package-boundary violation.
- Milestone: M1 Foundation and design system.
- Size: M (about one working session with Claude).
- Needs: TOKI-005 (Drizzle, migrations and the workspaces table) and TOKI-006 (Vite + React web skeleton).
- Needed by: no ticket in the Blueprint plan lists TOKI-008 in its Needs column.
- Agreed test tools: Vitest for unit and server integration tests, Playwright for end-to-end tests. Source: Toki Blueprint, ticket TOKI-008 and Stack.
- Server integration tests run against a real Postgres. Source: Toki Blueprint, ticket TOKI-008 and Testing.
- The scope includes a controllable clock and one sample Playwright test. Source: Toki Blueprint, ticket TOKI-008.
- Development services (Postgres, MinIO, Mailpit) come from the local development environment. Source: Toki Blueprint, ticket TOKI-003.
- The test database is separate from development data: no development reset script touches it. Source: Toki Blueprint, ticket TOKI-003.
- The end-to-end tests later use the prototype seed data loaded by `dev:seed`, which arrives in TOKI-081 at the end of M3. Source: Toki Blueprint, ticket TOKI-081.
- CI on every PR runs lint, type check, tests, build, end-to-end and bundle size. Source: Toki Blueprint, Infrastructure.

## Open questions
- The Blueprint lists nothing under "Open for the spec" for TOKI-008.
- What is the controllable clock needed for? The source names it but gives no reason or first use.
- Should the sample end-to-end test run in CI as part of this ticket or as part of TOKI-007? TOKI-007 does not list TOKI-008 as a need, and the source does not say.
