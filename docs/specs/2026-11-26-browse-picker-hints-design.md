# Browse channels and New message hints design

Date: 2026-11-26 · Status: draft for review
Intent: docs/intents/browse-picker-hints.md (Thanh Truong)
Ticket: TOKI-140

## Goal
A member who browses channels sees the member count of every channel, however long its topic is, and a member who starts a message sees a visible hint in the search box, as the search box of Browse channels already has. Today a long topic hides the member count behind an ellipsis, and the search box of New message has only a label that a screen reader reads.

## Scope
- In: the member count of a row of Browse channels (R1, R2); the hint of the search box of New message (R3, R4); the proof.
- Out (not now):
  - What the dialogs' spec decided: a row shows only name, topic and member count (R6); the buttons Join and Open; the list of New message holds people and no channel; the buttons Cancel and Start (R21) (`docs/specs/2026-11-17-browse-channels-people-picker-design.md`).
  - The job title and the presence in the rows of New message (TOKI-057, TOKI-055).
  - The place of the dialogs on the screen.

## Requirements
- R1. A row of Browse channels shows its member count in full on every row, however long the topic is, at 360 px and at 1280 px. When the topic does not fit, only the topic is cut, with an ellipsis, and the member count stays at the end of the same line (concern 1). Check: an end-to-end case of Playwright opens Browse channels with a channel whose topic has 200 characters, answers `GET /api/v1/channels` with it, and finds the text of the member count (`t("browse.row.members", { count })`) visible, inside the box of its row, at both widths, and the row one line high.
- R2. The row keeps what R6 of the dialogs' spec says: the icon, the name, the topic joined to the member count by " · " (the word `Private` first for a private channel), the label of an archived channel, and the button. Check: the existing tests of `BrowseRow` and `BrowseChannelsDialog` pass without a change, and one test finds, for a row with a long topic, the topic, " · " and the count in that order.
- R3. The search box of New message shows a visible hint: the input has a `placeholder` equal to its label, `t("picker.search.label")` ("Search people" in English; concern 2), and keeps its `aria-label`, so the field is still named by its label. Check: a component test of `PeoplePicker` and of `NewMessageDialog` finds the input by its label and finds the attribute `placeholder` equal to that text, in English and in Vietnamese.
- R4. The hint is the text that the box already has, so this work adds no text key; it goes through the prop `searchLabel` that `NewMessageDialog` fills with `useTranslation` (R28 of their spec), and `ui-web` holds no text. Check: `pnpm i18n:check` passes with the same number of keys as before, and the test that forbids literal text in the sources passes.
- R5. The two dialogs still fit the window at 360 x 560, 719, 720, 1099 and 1100 px (R27 of their spec). Check: the existing end-to-end checks of that rule pass.
- R6. `pnpm format:check`, `pnpm lint`, `pnpm typecheck` and `pnpm test` pass. Check: the commands exit 0 (the server database tests need `TEST_DATABASE_URL`, as for every pull request).

## Design
- The row of Browse channels: `BrowseRow.tsx` draws `span.xs.muted.sub.ell` with the topic and the member count in one text, so the ellipsis can cut the count (`BrowseRow.tsx:48-51`). The sub line becomes a flex row of two spans: the topic (and, for a private channel, the word `Private` before it), which keeps the ellipsis and may shrink (`min-width: 0`), and the member count with its " · ", which does not shrink (`flex: none`).
- The hint: `PeoplePicker.tsx:116-117` passes `type="search"` and `aria-label={searchLabel}`; the same prop gives `placeholder={searchLabel}`, as `BrowseChannelsDialog` does for its field (R4 of the dialogs' spec: `aria-label` and `placeholder`, both `t("browse.search.label")`).

### Layout
```
apps/web/src/features/channels/BrowseRow.tsx      R1, R2
apps/web/src/features/people/PeoplePicker.tsx     R3
apps/web/tests/features/, e2e/                    the tests
```

## Testing
- The tests are written first and seen to fail: the end-to-end case of R1 (the count is not visible today), the component tests of R3.
- The UI parity check, once the screens of Browse and New message are declared in it (TOKI-141), is run and the pictures looked at in Calm and Focus.
- Data used is fake only.

## Data safety
- No data is read, stored or sent by this change.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| What the specs decided stays: rows show name, topic, member count; Join and Open; people only in New message; Cancel and Start | Scope, Out; R2 |
| The hint does not replace the label of the field | R3 (the `aria-label` stays; a test finds the field by it) |
| On a narrow screen the controls stay at least 40 px tall and both dialogs fit the window | R5 |

## Open questions from the intent
- For a long topic, does the row wrap the line (as the prototype does) or cut only the topic and keep the member count at the end? Answered: only the topic is cut and the member count stays at the end (R1). Decided by Thanh Truong (lead, as product owner) on 2026-11-26. See concern 1.
- Is the hint of the New message box the existing label, "Search people", or another text? Answered: the existing label, "Search people" (R3). Decided by Thanh Truong (lead, as product owner) on 2026-11-26. See concern 2.

## Areas of concern
1. The row with a long topic (R1). The prototype lets the line wrap and shows "· 8 members" on the second line, so a row is taller; cutting only the topic keeps one line per row, the list stays regular, and the topic loses its end. Decided by Thanh Truong (lead, as product owner) on 2026-11-26: only the topic is cut and the member count stays. Owner: Thanh Truong.
2. The text of the hint (R3). The existing label is "Search people" (`picker.search.label`); the prototype's box says "Search people and channels", which is not true of this box (it lists people only). Using the label adds no text key; another text adds one in both languages. Decided by Thanh Truong (lead, as product owner) on 2026-11-26: the existing label, no new key. Owner: Thanh Truong.
