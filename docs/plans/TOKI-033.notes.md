# TOKI-033 notes for the pull request

## Measurement of 500 conversations (concern 17, recorded, not asserted)

Taken by `e2e/conversation-list.spec.ts` ("500 conversations") in headless Chromium on the Vite dev server (not a production build) on one Mac mini, in the final `pnpm test:e2e` run. The list draws every row (no virtualization).

| Window | Rows in the DOM | DOM nodes in the page | `goto` until a row of channel-013 is attached | Search keystroke to the second frame (ms, five steps: `c`, `ch`, `chan`, `channel-4`, empty) |
| :-- | :-- | :-- | :-- | :-- |
| 1100 px | 500 | 2546 | 985 ms | 22, 32, 100, 33, 33 |
| 360 px | 500 | 2544 | 909 ms | 37, 33, 32, 34, 117 |

An earlier run of the same test gave 1002 ms and 852 ms, and keystrokes of 28 to 102 ms, so these numbers vary by about 15 % from run to run. A keystroke costs about 30 ms (two frames) with an occasional 100 ms step. Not measured: a production build, a slow device, scroll cost.

## Bundle size

Initial JavaScript, gzip: baseline 149973 bytes (step 0), 154593 bytes after the layout wiring and at the end (limit 200000). The list and the layout add 4620 bytes.

## By eye, Calm and Focus at 1100 and 360 px

Screenshots of the real list (twelve conversations, `design` unread 3, a DM with a mention and 1 unread), taken with Playwright against the Vite dev server:
`list-calm-1100.png`, `list-calm-360.png`, `list-focus-1100.png`, `list-focus-360.png` in the session scratchpad (not in the repository).

Not compared by eye with the prototype: the prototype is not in the repository or in the worktree, so no side-by-side comparison was made. What I saw in the real list:

- Calm, 1100 px: workspace header with "Acme Studio" and "7 people" (8 members, one deactivated). Home item, "Conversations" heading, search field, three chips (All selected), groups Starred (engineering with an outline star), Channels (design in bold with a count badge of 3, general highlighted as the current row, a lock before secret-project), Direct messages (Alex Phạm in bold with an `@` badge and a count, a people icon for the group, "Deactivated" tag on Dũng, avatars with initials in two hues). The page of the conversation shows only the `h1` "general", flush against the left edge of the main area (the page is a stub of TOKI-035).
- Focus, 1100 px: icon rail on the left, the list in a column beside it, same groups and rows; the heading "Conversations" and the search field sit tight to the top with the Focus padding. The current row is a dark teal fill.
- Calm and Focus, 360 px: the list fills the screen above the bottom bar (Home tab only); rows are taller (52 px), the chips are 40 px, the search field is at 16 px from the edge like the heading. The Direct messages group is cut by the bottom bar at 700 px height (scrolls).
- Nothing looked broken or overlapping. The `+` on Direct messages and the Browse channels row are not drawn (their openers are registered by TOKI-034), so they were not looked at.

## R14, the header button and the '+'

The browser test measures the controls the pane draws (rows, chips, `.sec`). The header button and the '+' are not drawn until TOKI-034 registers the openers, so the real pane has none of them yet. The test appends the same `IconButton` markup (`ib sm`) in `.ch` and `.sech` at narrow width and reads its height under the real stylesheet (at least 40 px, from the narrow `.ib` `min-height`). It fails when that rule is lowered (checked by setting it to 30 px). It checks the stylesheet, not the component.

## Deviations from the plan, declared

- Only `packages/ui-web/tests/components/exports.test.ts` needed the export-test fix. Plan Design point 1 said two files; the other one needed no change.
- `apps/web/tests/router.test.ts` gains one test, for `conversationRoute`, which the plan did not list.
- Test seam files not in the plan: `apps/web/tests/support/conversation-store.ts` (a real `createConversationStore` over a fake api, behind a mock of `src/client`), `apps/web/tests/support/pane-harness.tsx` (the pane in a memory router) and `e2e/support/fixtures.ts` (the bootstrap fixtures). `apps/web/tests/support/load-app.tsx` uses the same seam, so a signed-in `loadApp()` makes no real fetch.
- R13 e2e injects a stand-in `button.sec-add`, because no opener exists until TOKI-034; it checks the stylesheet, not the component.
- R11 e2e checks the empty box against the end of the list content, because the Browse channels row is not drawn until TOKI-034.
- R30 collapsed-total e2e calls `store.setUnread` through `/src/client.ts` on the Vite dev server, because TOKI-053 owns the unread data.
- The 4 `test.fixme` in `e2e/component-preview.spec.ts` (lines about 522, 1061, 1067 and 1068) predate this branch and wait for the fonts of TOKI-010.
- The by-eye comparison with the prototype is NOT done. The prototype is not in the repository, so the person who opens the pull request does it and records the result in the pull request.
