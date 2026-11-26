# TOKI-137 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use cl-dev:executing-plans to implement this plan task-by-task.

**Goal:** Let a screen of the UI parity check name the element of the app that is captured, and declare the two sign-in screens with their reference images.

**Spec:** docs/specs/2026-11-26-parity-app-root-design.md (tier S, no design stage)

A working draft of the code exists, uncommitted, in the worktree `toki-135` and as a patch (`parity-draft.patch` of the session scratchpad). It also holds the code of TOKI-138 (the frame of the difference), which is not part of this ticket: take only `appRoot`, `screens.spec.ts`, `screens/signin.ts` and the README lines of this spec.

## AC -> step -> test
| Requirement | Step | Test |
|---|---|---|
| R1 `appRoot`, `appRootOf` | 1 | `appRootOf` in `e2e/support/parity.test.ts` |
| R2 app side captures `appRootOf(decl)`, `admin` unchanged | 1, 4 | a run of the check: the `admin` rows keep their ratios |
| R3 the two sign-in screens | 2 | a run lists 12 rows, none fails for a missing element |
| R4 12 reference images | 2 | the files are there; no "no reference" |
| R5 known entries (ticket TOKI-136, reason of two parts) | 3 | a run lists no new difference for the sign-in rows |
| R6 README | 3 | the file holds `appRoot`, `section: "guest"` and the example |
| R7 commands pass, two runs the same | 4 | format, lint, typecheck, test; two runs of the check |

## Steps
1. **`appRoot`** (files: `e2e/support/parity.ts`, `e2e/support/parity.test.ts`, `e2e/parity/screens.spec.ts`). Write the test of `appRootOf` first and see it fail; add `appRoot?: string` and `appRootOf(decl)` (default `.app`); `screens.spec.ts` captures `appRootOf(decl)`. The prototype side stays `#app`.
2. **The screens and their references** (files: `e2e/parity/screens/signin.ts`, `e2e/parity/reference/signin-*.png`). Declare `signin-email` and `signin-code` as in the spec (section `guest`, route `/login`, root `#root`, stubs of `e2e/support/sign-in.ts`, workspace `Hugepig Studio`, the fake address, a step that clicks the code field to wait for it). Make the 12 images with `pnpm ui:reference signin-email signin-code` (Docker).
3. **Known entries and README** (files: `e2e/parity/known-differences.ts`, `e2e/parity/README.md`). One entry for each of the 12 rows with the ticket `TOKI-136` and a reason that names the sign-in card and the frame, link and note of the prototype's picture; README: what `appRoot` is, `section` is a HASH key or `guest`, the example.
4. **Check** (no files). `pnpm test:e2e:parity screens.spec.ts` twice: the rows are the same, `admin` keeps its ratios, the sign-in rows are `known`. Then `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm exec vitest run e2e/support` and `pnpm test` (the `server-db` files need `TEST_DATABASE_URL`).

## Risks
- The wait of the code step (the first draft was flaky): the step that clicks `.inp.code` waits for the field; the two runs of step 4 prove it.
- The reference images are made in the container (Docker, arm64), as for every screen of the check.
