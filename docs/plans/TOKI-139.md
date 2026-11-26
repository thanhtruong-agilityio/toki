# TOKI-139 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use cl-dev:executing-plans to implement this plan task-by-task.

**Goal:** Each heading of the Details panel except the first has 18 px above it, as the prototype has, with or without the buttons Edit and Add people.

**Spec:** docs/specs/2026-11-26-details-panel-section-spacing-design.md (tier S, no design stage)

## AC -> step -> test
| Requirement | Step | Test |
|---|---|---|
| R1 `.sb section + section { margin-top: 18px }` | 1 | `packages/ui-web/tests/layout/shell.css.test.ts`: the table of the rules of `shell.css` gets the row; the test "holds exactly the rows typed in, in order, and no other rule" fails until the rule is in the file |
| R2 first heading keeps no space (`.sb h3:first-child`) | 1 | the existing row of the same table (already there; the test stays green) |
| R3 `.sb h3 { margin: 18px 0 8px }` unchanged | 1 | the existing row of the same table |
| R4 the distance Edit button to "MEMBERS" is at least 18 px, and without the buttons the same | 2 | `e2e/conversation-details.spec.ts`: measures with `boundingBox()` |
| R5 Leave and archive blocks keep their space; panel tests unchanged | 1, 3 | `.dp-leave` row in `apps/web/tests/conversation/` styles test if any, and the existing tests of the panel pass |
| R6 commands pass | 3 | format, lint, typecheck, test, the e2e cases of the conversation page |

## Steps
1. **The rule** (files: `packages/ui-web/src/layout/shell.css`, `packages/ui-web/tests/layout/shell.css.test.ts`). The test first: add the row `C(".sb section + section", "margin-top:18px")` after the row of `.sb h3:first-child`, see "holds exactly the rows typed in" fail, then add the rule after `.sb h3:first-child` in `shell.css`.
2. **The measure** (file: `e2e/conversation-details.spec.ts`). The case first, seen to fail on `main` (the distances are about 5 px): it uses `stubWorld` of `e2e/support/prototype-world.ts` (the answers of the session, the channel, its members), opens `/c/{LAUNCH}?panel=details` at 1280 px and measures the bottom of the Edit button to the top of "MEMBERS · 8", and the bottom of the line "Created by" to the same heading when no Edit is shown (an archived channel, or a person who may not edit), both at least 18 px.
   **Deviation found while building (accepted, to say in the pull request):** an archived channel draws its own page (`ArchivedChannelPage`) and not the panel, so it cannot stand for "a panel without the button Edit". The second case measures the headings Notifications and Settings instead, where no button is above, against the section above; the first case measures the Edit button above Members. Both fail on `main` without the rule (a distance of 0) and pass with it.
3. **Check** (no files). Run the case and `e2e/conversation-list.spec.ts` and the other conversation e2e on other ports if 3000 and 5173 are taken; the UI parity check (Details rows stay known, 0 new) and look at the picture; `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`.

## Risks
- The table of the rules of `shell.css` is owned by TOKI-015: the new row goes in its place and in order, and the test says so by failing otherwise.
- A person who may not edit sees no Edit: the second distance needs a panel without the button; if a stub for that is not easy, the archived channel (no Edit, R15 of the details spec) is used.
