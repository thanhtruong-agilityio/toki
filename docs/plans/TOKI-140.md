# TOKI-140 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use cl-dev:executing-plans to implement this plan task-by-task.

**Goal:** A row of Browse channels always shows its member count, however long the topic is, and the search box of New message shows its label as a visible hint.

**Spec:** docs/specs/2026-11-26-browse-picker-hints-design.md (tier S, no design stage; concerns decided: only the topic is cut, the hint is the existing label)

## AC -> step -> test
| Requirement | Step | Test |
|---|---|---|
| R1 the member count is shown in full on every row, one line, at 360 and 1280 px | 1, 3 | `e2e/browse-row.spec.ts`: a channel with a topic of 200 characters; the end of the text of the line is inside the box of the line, and the line is one line high, at both widths |
| R2 the row keeps what R6 of the dialogs' spec says | 1 | the existing tests of `BrowseRow` and `BrowseChannelsDialog` pass unchanged (`.sub` stays the element that holds the text); one new test: for a long topic the topic, " · " and the count are in that order |
| R3 the search box of New message has a `placeholder` equal to its label and keeps its `aria-label` | 2 | `PeoplePicker.test.tsx` and `NewMessageDialog.test.tsx`: the input is found by its label and has the attribute `placeholder` equal to it, in English and in Vietnamese |
| R4 no new text key; no literal text | 2 | `pnpm i18n:check` (same number of keys), the sources test |
| R5 the dialogs still fit the window | 4 | the existing end-to-end checks of that rule |
| R6 commands pass | 4 | format, lint, typecheck, test |

## Steps
1. **The row** (files: `apps/web/src/features/channels/BrowseRow.tsx`, `apps/web/src/features/rows.css`, `apps/web/tests/features/channels/BrowseRow.test.tsx`, `apps/web/tests/features/rows.css.test.ts`). Test first: for a long topic the `.sub` holds the topic and the count as two spans, in order (`.sub-lead`, `.sub-count`), and its text is unchanged. The sub line becomes `<span class="xs muted sub sub-line">` holding `span.ell.sub-lead` (the word Private and the topic) and `span.sub-count` (" · " and the count, which does not shrink). Rules `.prow .sub-line { display:flex }`, `.prow .sub-lead { min-width:0 }`, `.prow .sub-count { flex:none; white-space:pre }`, and their rows in Table A of `rows.css.test.ts`, which pins every rule of the file.
2. **The hint** (files: `apps/web/src/features/people/PeoplePicker.tsx`, `apps/web/tests/features/people/PeoplePicker.test.tsx`, `NewMessageDialog.test.tsx`). Test first: the input has `placeholder` equal to its label. Then `placeholder={searchLabel}`.
3. **The measure** (file: `e2e/browse-row.spec.ts`). The case first, seen to fail on `main` (the count is cut): it answers `GET /api/v1/channels` with one channel whose topic has 200 characters, opens Browse channels at 1280 px (the button of the list) and at 360 px (Home, where the list is), and checks the end of the text of the line is inside its box and the line is one line high.
4. **Check** (no files). The whole end-to-end suite and the conversation tests (temporary config on other ports if 3000 and 5173 are taken); the UI parity check (Browse and New message rows stay known, 0 new) and look at the pictures; `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm i18n:check`.

**Change found while building (said in the pull request):** the first version of the rule had `white-space: nowrap`; the picture showed that a flex item drops the space at its start, so the line read "chat· 8 members". It is `white-space: pre`, which keeps the space and does not wrap, and its row in Table A was changed first and seen to fail.

## Risks
- Table A of `rows.css.test.ts` and its test of the first-child order: new rows go in their place.
- The people picker's input sits beside the chips: with people chosen the placeholder still shows in the empty input; the spec asks for the placeholder, and the pictures are looked at.
- The row's text must not change for a screen reader: the three parts stay in one `.sub` element, in the same order.
