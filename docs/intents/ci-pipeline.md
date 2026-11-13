# Intent: CI on GitHub Actions
Author: Thanh Truong

## Problem
Toki has no automatic check on changes yet. Nothing has been committed to the repository, and no CI exists.
Milestone M1 cannot close without it: its exit check says "CI is green".
Blueprint intent I01 asks for a repository, tooling and CI that all later work builds on. Without CI, later work has no shared check to build on.

## Proposed outcome
Every pull request is checked automatically, and the builder can see whether it passed or failed.
A change that breaks one of the agreed checks does not show as green.
When this is done, the "CI is green" part of the M1 exit check and of the I01 done statement can be met.

## Affected users and systems
- The builder (one person building with Claude). Source: Toki Blueprint, intent I01.
- The Toki repository: github.com/thanhtruong-agilityio/toki.
- All later tickets, because their changes will pass through CI.

## Constraints
- CI service: GitHub Actions. Source: Toki Blueprint, ticket TOKI-007.
- Checks in scope: lint, type check, tests, build, bundle size limit. Source: Toki Blueprint, ticket TOKI-007.
- CI runs on every PR. Source: Toki Blueprint, technical design, Infrastructure.
- Phase 1 acceptance criterion: initial JavaScript under 200 KB compressed. Source: Toki Blueprint, phase 1 acceptance criteria.
- Secrets live in `.env`, never in git. Source: Toki Blueprint, technical design, Infrastructure.
- Milestone: M1, Foundation and design system.
- Size: M (about one working session with Claude).
- Needs: TOKI-002 (Lint, format and package boundary rules).
- Needed by: TOKI-085 (Automated deploy, M6). Source: Toki Blueprint, ticket list, Needs column.
- Belongs to Blueprint intent I01 repo-foundation, alongside TOKI-001 to TOKI-008.

## Open questions
- The Blueprint infrastructure note lists end-to-end among the CI checks on every PR, but the TOKI-007 scope does not. Is end-to-end part of this ticket or a later one?
- The Blueprint says merging to `main` builds an image and deploys. The TOKI-007 scope does not mention it, and the plan has a separate ticket TOKI-085 (Automated deploy, M6). Is deploy fully outside this ticket?
- Is the bundle size limit in CI the same as the phase 1 criterion (initial JavaScript under 200 KB compressed)? The ticket does not give a value.
- The "Open for the spec" column for TOKI-007 is empty.
