# TOKI-141 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use cl-dev:executing-plans to implement this plan task-by-task.

**Goal:** The UI parity check compares the conversation page, the Details panel, Browse channels, New message and Preferences with the prototype, on data made as the prototype's sample workspace.

**Spec:** docs/specs/2026-11-26-parity-app-screens-design.md (tier S, no design stage)

A working draft exists, uncommitted, in the worktree `toki-screens` and as a patch (`parity-app-screens-draft.patch` of the session scratchpad): `e2e/support/prototype-world.ts`, `e2e/parity/screens/app-screens.ts` and the references. It is the source of steps 1 and 2; the 2 stray `channel-*-narrow` images of the draft are not taken.

## AC -> step -> test
| Requirement | Step | Test |
|---|---|---|
| R1 `world()` and `stubWorld` | 1 | `apps/web/tests/e2e-fixtures.test.ts`: `world()` parses with `BootstrapResponse`, Lan is the person of the session, 8 people, the starred channel, 12 conversations |
| R2 five declared screens | 2 | a run lists 22 rows and none fails for a missing element or reference |
| R3 22 reference images | 2 | the 22 files exist (a run does not fail with "no reference") |
| R4 known entries with reasons, ticket `accepted` | 3 | a run lists no new difference |
| R5 README | 3 | the file holds it |
| R6 commands pass; two runs the same | 4 | format, lint, typecheck, test; two runs of the check |

## Steps
1. **The data** (files: `e2e/support/prototype-world.ts`, `apps/web/tests/e2e-fixtures.test.ts`). The test first, seen to fail (the module does not exist); then the module from the draft: `world()` (Hugepig Studio, Lan Nguyễn as Admin, 8 people, 8 channels with `project-launch` starred, 4 direct messages and groups), `stubWorld(page)` (session, devices, browse list, members, channel detail, over `stubBootstrap`) and `LAUNCH`.
2. **The screens and their references** (files: `e2e/parity/screens/app-screens.ts`, `e2e/parity/reference/*.png`). Declare `channel`, `details`, `browse`, `new-message` (1280 and 900 px) and `prefs` (three widths); `browse` and `new-message` with `appRoot: "html"`. Make the 22 images with `pnpm ui:reference channel details browse new-message prefs` (Docker).
3. **Known entries and README** (files: `e2e/parity/known-differences.ts`, `e2e/parity/README.md`). Run the check; look at the pictures; one entry for each of the 22 rows with a reason for its screen (a feature not built yet with the ticket that builds it, or a spec requirement that decided it) and the ticket `accepted`; README: what `prototype-world.ts` is and the capture of a dialog as the whole window.
4. **Check** (no files). `pnpm test:e2e:parity` twice: the same 22 rows and the same ratios; the rows of Admin and sign-in keep their ratios. `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`.

## Risks
- The reasons of step 3 must be true: each names a ticket or a requirement that is read in the repository, not guessed.
- The data is a stub; a field that the prototype has and the contract has not (job titles, presence, unread counts) is missing, and the reasons say so.
- The 22 images add about 2.5 MB once.
