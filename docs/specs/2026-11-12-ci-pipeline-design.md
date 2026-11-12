# CI on GitHub Actions design

Date: 2026-11-12 · Status: draft for review
Intent: docs/intents/ci-pipeline.md (Thanh Truong)
Ticket: TOKI-007

## Goal
The builder needs every pull request to be checked automatically, with a clear pass or fail result.
Today Toki has no CI, so milestone M1 cannot close ("CI is green") and later tickets have no shared check.
This spec covers the Blueprint ticket TOKI-007: lint, type check, tests, build and a bundle size limit on GitHub Actions.

## Scope
- In: one GitHub Actions workflow that runs on every pull request; five checks (lint, type check, tests, build, bundle size limit); a Postgres service in the workflow for the tests that need a database; a pass or fail result visible on the pull request.
- Out (not now):
  - ESLint, Prettier and the three package boundary rules themselves: TOKI-002. CI only runs them.
  - Monorepo, packages and shared TypeScript config: TOKI-001.
  - Test harness (Vitest against a real Postgres, the Playwright sample test, the controllable clock): TOKI-008.
  - Web app skeleton that produces the bundle: TOKI-006. Server skeleton: TOKI-004.
  - Local Docker Compose services: TOKI-003. Environment variable inventory and `.env.example`: TOKI-096.
  - Building an image and deploying on merge to `main`: TOKI-085 (M6), with TOKI-084 for the production image. See concern 2.
  - End-to-end tests in CI (`pnpm test:e2e`): TOKI-008 adds that job to the workflow that this ticket creates. See concern 1. The Postgres service is in this ticket (concern 5).
  - `CLAUDE.md` and Claude project setup: TOKI-095.
- Plan change: TOKI-008 now also needs TOKI-007 (decision of 2026-11-12); the Blueprint plan must be updated.

## Requirements
- R1. A GitHub Actions workflow file exists under `.github/workflows/` and its trigger is `pull_request`. Check: open a pull request; a CI run appears on it without any manual step.
- R2. The lint check runs the three root scripts of TOKI-002: `pnpm lint`, `pnpm lint:boundaries` and `pnpm format:check`. Check: a pull request that adds an ESLint error shows a failed lint check; so does one that adds a badly formatted file, and one that switches off a boundary rule.
- R3. CI enforces the package boundary rules of TOKI-002 through the same lint check. Check: a pull request where `client-core` imports a DOM API shows a failed lint check.
- R4. CI runs the TypeScript type check for the whole workspace. Check: a pull request that adds a type error shows a failed type check.
- R5. CI runs the test suite. The tests check passes when the repository holds no test yet, and runs every test once tests exist. Check: a pull request that adds a failing test shows a failed test check.
- R6. CI runs the build of every app and package that has a `build` script. The build check passes when none has one yet. Check: once a `build` script exists, a pull request that breaks that build shows a failed build check.
- R7. CI runs a bundle size check against one limit stored in a file in the repository. The limit is 200 KB, measured with gzip, on the JavaScript that `apps/web` loads on first page load (the entry chunks; lazy-loaded chunks do not count). The bundle size check passes, and says that there is no bundle to measure, while `apps/web` has no build output. Check: the limit file holds 200 KB; once the bundle exists, lower the limit below the current size in a pull request; the bundle size check fails and prints the measured gzip size of the entry chunks and the limit.
- R8. Each of the five checks is reported under its own name on the pull request. Check: the pull request checks list shows lint, type check, tests, build and bundle size as separate entries, each with pass or fail.
- R9. The run is not green when any of the five checks fails. Check: in each failing case of R2 to R7, the overall result on the pull request is red.
- R10. Every check can be run locally with one root command. Check: the root `package.json` has one script per check, and the workflow calls those scripts and holds no check logic of its own.
- R11. The workflow uses no secret and the repository holds no `.env` file. The local-only credentials of the Postgres service container in R15 are written in the workflow file; they protect nothing outside the run and are not secrets. Check: `grep -n "secrets\." .github/workflows/*.yml` prints nothing, and `git ls-files | grep -E '(^|/)\.env$'` prints nothing.
- R12. CI uses Node 22 and pnpm, as the Blueprint stack states. Check: the workflow log prints a Node 22 version line.
- R13. On a pull request with no fault, all five checks pass, whichever of the other foundation tickets are already merged: a check with nothing to run yet passes (R5, R6, R7). Check: the first pull request after this work shows a green run. This is the "CI is green" part of the M1 exit check.
- R14. The workflow delivered by this ticket holds no end-to-end step; TOKI-008 adds it later. Check: when this ticket is done, `grep -niE "test:e2e|playwright" .github/workflows/*.yml` prints nothing.
- R15. The workflow starts a Postgres 17 service for the tests check and gives the tests its connection value under the variable name from the TOKI-096 inventory. Check: on a pull request made after TOKI-005 is merged, the database tests of TOKI-005 are reported as passed in the tests check, not skipped.

## Design
### Errors
- A check fails -> its entry on the pull request is red, the overall run is red, and the log shows the failing command output.
- Bundle size over the limit (200 KB gzip on the entry chunks of `apps/web`) -> the bundle size check fails and prints measured size, limit and the difference.
- Dependency install fails (lockfile out of date) -> the run fails before any check; the log names the install step.
- One check fails -> Assumption: the other checks still run, so the builder sees every failure in one run.
- A check has nothing to run yet (no test, no `build` script, no web bundle) -> the check passes and its log says what was missing.

### Layout
```
toki/
├─ .github/
│  └─ workflows/
│     └─ ci.yml          the only workflow in this ticket; trigger: pull_request
├─ package.json          root scripts, one per check (R10)
└─ <bundle limit file>   holds the limit value for R7 (200 KB gzip)
```
- Assumption: the workflow file is named `ci.yml`.
- Assumption: the root script names are `lint`, `typecheck`, `test`, `build` and `size`. Scripts that TOKI-001 or TOKI-002 already added are reused, not renamed.
- The limit is 200 KB gzip on the entry chunks of `apps/web` (R7). The Blueprint names no bundle size tool and no limit file. See concern 3.
- TOKI-008 later adds the end-to-end job (`pnpm test:e2e`) to `ci.yml`; this ticket does not (R14).
- The Postgres service is part of this ticket (R15), so the database tests of TOKI-005 run in CI as soon as both tickets are merged, in either order.
- The root `test` script: TOKI-004 adds the first tests and TOKI-008 owns the full `pnpm test`. This ticket creates the root `test` script only if it does not exist yet, as a script that runs the `test` script of every project that has one.

## Testing
- Each requirement is proven on GitHub with a throwaway pull request that carries one fault (lint error, boundary violation, type error, failing test, broken build, lowered size limit). Each must show red on the matching check. The failing-test, broken-build and size faults can only be shown once a test, a `build` script and the web bundle exist; until then R5, R6 and R7 are checked by the passing case and by the local scripts.
- One clean pull request must show all five checks green (R13).
- Local check first: run each root script and confirm it exits non-zero on the same faults.
- Fake data only. No real credential is used in any test pull request.

## Data safety
- Secrets live in `.env`, never in git. The workflow in this ticket needs no secret.
- Logs must not print environment values. The checks in scope read none.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| CI service: GitHub Actions | R1; Layout (`.github/workflows/ci.yml`) |
| Checks in scope: lint, type check, tests, build, bundle size limit | R2, R4, R5, R6, R7, R8; R15 gives the tests check its Postgres service |
| CI runs on every PR | R1 |
| Phase 1 acceptance criterion: initial JavaScript under 200 KB compressed | R7 sets the same limit: 200 KB, gzip, on the entry chunks of `apps/web`. The measuring tool is not decided; concern 3 |
| Secrets live in `.env`, never in git | R11; Data safety |
| Milestone: M1, Foundation and design system | Planning fact; no design impact. R13 serves the M1 exit check |
| Size: M (about one working session with Claude) | Scope: one workflow and five checks; end-to-end (TOKI-008) and deploy (TOKI-085) are left out; R14 |
| Needs: TOKI-002 (Lint, format and package boundary rules) | R2 and R3 run the three scripts TOKI-002 delivers; this spec adds no rule. No other need is added: the checks pass while there is nothing to run (R5, R6, R7, R13) |
| Needed by: TOKI-085 (Automated deploy, M6) | Planning fact; no design impact. Deploy stays in TOKI-085 (Scope, Out). TOKI-008 now also needs this ticket (Scope, plan change) |
| Belongs to Blueprint intent I01 repo-foundation, alongside TOKI-001 to TOKI-008 | Scope, Out names the neighbouring tickets; R13 serves the I01 done statement |

## Open questions from the intent
- Is end-to-end part of this ticket or a later one? Answered: a later one. TOKI-008 adds the end-to-end job to the CI workflow that TOKI-007 creates. See concern 1.
- Is deploy fully outside this ticket? Answered: yes. Image build and deploy belong to TOKI-085. See concern 2.
- Is the bundle size limit in CI the same as the phase 1 criterion (initial JavaScript under 200 KB compressed)? Answered in part. The limit is the same: 200 KB, gzip, on the entry chunks of `apps/web`. The measuring tool is still open. Carried forward as concern 3.
- The "Open for the spec" column for TOKI-007 is empty. Answered: the Blueprint extract shows "-" for TOKI-007, so the Blueprint raises no further question. The gaps found while writing this spec are concerns 4 to 8.

## Areas of concern
1. End-to-end in CI is undecided. The Blueprint infrastructure note lists it among the checks on every PR, but the TOKI-007 scope does not, and Playwright arrives with TOKI-008, which TOKI-007 does not need. This spec leaves end-to-end out. Decided: TOKI-008 adds the end-to-end job (`pnpm test:e2e`) to the CI workflow that TOKI-007 creates. TOKI-007 itself contains no end-to-end step. TOKI-008 now also needs TOKI-007. Decided by Thanh Truong (lead, as product owner) on 2026-11-12. The Postgres service moved to this ticket by a later decision the same day; see concern 5. Owner: Thanh Truong.
2. Deploy on merge to `main` is undecided for this ticket. This spec treats it as owned by TOKI-085 and adds no `main` trigger. Answered: yes, deploy is outside TOKI-007. Image build and deploy belong to TOKI-085 "Automated deploy" (M6), whose scope is "Build the image on merge, deploy, run migrations, roll back" and which needs TOKI-084 and TOKI-007. TOKI-007 holds no image build and no deploy step. Evidence: Toki Blueprint (claude.ai/artifact/VVRByrWR4d1BYgp3JA5vTE), Plan tab, ticket TOKI-085. Owner: Thanh Truong.
3. The bundle size limit value and how it is measured are not set. Open points: is the value 200 KB; does "compressed" mean gzip or Brotli; does "initial JavaScript" mean only the entry chunks of `apps/web`; which tool measures it. Answered in part: the limit is 200 KB, measured with gzip, on the JavaScript that `apps/web` loads on first page load (the entry chunks; lazy-loaded chunks do not count). The same rule applies in TOKI-006 and TOKI-007. Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Still open: which tool measures it. R7 cannot be finished without the tool. Owner: Thanh Truong.
4. Ordering of tickets. TOKI-007 needs only TOKI-002, but the tests come from TOKI-004, TOKI-005 and TOKI-008 and the web bundle from TOKI-006. If TOKI-007 is built first, the test check has no test and the size check has no bundle. Decided: the order stays; each check passes while there is nothing to run and starts to check for real when another ticket adds the thing it checks (R5, R6, R7, R13). Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Owner: Thanh Truong.
5. Tests against a real Postgres. TOKI-008 runs Vitest against a real Postgres. The Blueprint does not say whether CI must provide a Postgres service, or which ticket adds it. R11 (no secret in the workflow) may need a throwaway test value at that point. Decided: TOKI-007 adds the Postgres service to the CI workflow itself (R15), so the database tests of TOKI-005 run in CI before TOKI-008 exists; TOKI-008 adds only the end-to-end job. This replaces the earlier decision of the same day that TOKI-008 adds the service. The service's local-only credentials are written in the workflow and are not secrets (R11). Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Owner: Thanh Truong.
6. "Does not show as green" is met by a red run (R9), but nothing states that a red run blocks the merge. Decide whether the checks become required on `main` (branch protection), and who sets it. Owner: Thanh Truong.
7. Format check. TOKI-002 delivers Prettier, but the TOKI-007 scope lists lint only. Decided: the lint check runs all three scripts of TOKI-002, `pnpm lint`, `pnpm lint:boundaries` and `pnpm format:check`, so unformatted code and a switched-off boundary rule both fail CI (R2). Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Owner: Thanh Truong.
8. Runs on `main`. The intent says "every PR" only. Decide whether the same checks also run on a push to `main`, so `main` itself shows green or red. Owner: Thanh Truong.
