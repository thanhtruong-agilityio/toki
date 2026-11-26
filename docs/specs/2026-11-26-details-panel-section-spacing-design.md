# Details panel section spacing design

Date: 2026-11-26 · Status: draft for review
Intent: docs/intents/details-panel-section-spacing.md (Thanh Truong)
Ticket: TOKI-139

## Goal
A member who opens the Details panel of a channel sees its sections (About, Members, Notifications, Settings) set apart as the prototype sets them apart: 18 px above each heading except the first. Today no heading has that space, so the button Edit of About sits about 5 px above "MEMBERS · 8" and the panel reads as one block. After this change the space is there, with or without the buttons Edit and Add people.

## Scope
- In: the space above the headings of the panel's sections (R1 to R3), the first heading (R4), and the proof (Testing).
- Out (not now):
  - What the specs of the panel decided: the buttons Edit, Add people and Remove, the order of the sections, the members sorted by name (`docs/specs/2026-11-17-conversation-header-details-design.md`, `docs/specs/2026-11-17-add-remove-people-design.md`).
  - The sections that the prototype has and the app has not (Guests, Email this channel, Automations) and the job titles and presence in the member rows: their own tickets (TOKI-057, TOKI-055).
  - The space of the Leave block (`.dp-leave`, 16 px) and of the archive block (`.dp-archive`): they are `div`s with their own rules and are not changed.

## Requirements
- R1. In a panel drawn by `SidePanel`, the space between one `section` of its content and the next is 18 px: the stylesheet has a rule for a `section` that follows a `section` with `margin-top: 18px`, the prototype's top margin of a heading in a panel (`.sb h3`, `e2e/prototype/index.html:334`), whether or not the section above ends with buttons. Check: a test reads `packages/ui-web/src/layout/shell.css`, finds the rule `.sb section + section` and its `margin-top: 18px`.
- R2. The first heading of the panel has no space above it: the rule `.sb h3:first-child { margin-top: 0 }` is kept, and the heading About stays at the top of the panel. Check: the same test finds the rule and `margin-top: 0`.
- R3. The space between a heading and what follows it stays 8 px (`.sb h3 { margin: 18px 0 8px }`, `shell.css:70-77`): this work changes no value of it. Check: the same test finds `margin: 18px 0 8px` in the rule `.sb h3`.
- R4. On a Details panel with the buttons Edit and Add people (a member of a channel that is not archived), the distance from the bottom of the Edit button to the top of the heading "MEMBERS · 8" is at least 18 px; without the buttons, the distance from the line "Created by" to the heading is the same 18 px. Check: an end-to-end case of Playwright (`e2e/`) opens the panel of a channel for a member, with the answers of the page stubbed, at 1280 px, and measures the two distances with `boundingBox()`; it fails when either is less than 18 px.
- R5. The Leave block and the archive block keep their own space, and the narrow rule of 40 px for controls is not touched. Check: the test of R1 finds `.dp-leave { margin-top: 16px }` in `apps/web/src/conversation/conversation.css`, and the existing tests of the panel (`apps/web/tests/conversation/`) pass without a change.
- R6. `pnpm format:check`, `pnpm lint`, `pnpm typecheck` and `pnpm test` pass, and the end-to-end cases of the conversation page pass. Check: the commands exit 0 (the server database tests need `TEST_DATABASE_URL`, as for every pull request).

## Design
The cause is one rule. `shell.css` has `.sb h3 { margin: 18px 0 8px }` and `.sb h3:first-child { margin-top: 0 }`. In the prototype the headings are direct children of `.sb`, so only the first heading is a first child. In the app each section is a `section` that holds its own heading, so every heading is the first child of its `section` and loses its space (`AboutSection.tsx:85`, `PeopleSection.tsx:139`, `NotificationsSection.tsx:24`, `SettingsSection.tsx:23`).

The change is one rule in `packages/ui-web/src/layout/shell.css`, after the two that exist:
```css
.sb section + section {
  margin-top: 18px;
}
```
A `section` that follows a `section` is set 18 px from it, which is the space the prototype's heading margin gives. The first section has none above it, so About stays at the top. The rule is in the shared stylesheet of the panel and holds for any panel whose content is a list of sections.

### Layout
```
packages/ui-web/src/layout/shell.css       the rule of R1
packages/ui-web/tests/layout/              the test of R1 to R3 and R5 (reads the file)
e2e/conversation-details.spec.ts           the measure of R4
```

## Testing
- The style test is written first and seen to fail, in `packages/ui-web/tests/layout/` (it reads `shell.css` by selector and property, not by line, as the test of the sign-in styles does).
- The end-to-end case of R4 is written first and seen to fail on `main`: it stubs `GET /api/v1/bootstrap`, `GET /api/v1/channels/{id}` and `GET /api/v1/channels/{id}/members` as `e2e/support/` stubs do, opens the panel with `?panel=details`, and measures.
- The UI parity check, once the screen of the Details panel is declared in it (TOKI-141), is run and the picture is looked at in Calm and Focus: the headings are set apart.
- Data used is fake only: the names of the stubs of the check.

## Data safety
- No data is read, stored or sent by this change; it sets space between blocks.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| What the specs of the panel decided stays: the buttons Edit and Add people, the Remove buttons, the order of the sections, the members sorted by name | Scope, Out; R5 (no test of the panel changes) |
| The space follows the design tokens and the values of the prototype; no new colour | R1 (18 px, the prototype's value); the change adds no colour |
| On a narrow screen the controls stay at least 40 px tall | R5 |

## Open questions from the intent
- Is the fix made in the shared rule of the panel (so that every panel gets it) or in the Details panel only? Answered: in the shared stylesheet, in `shell.css`, because the rule that causes it is there and `SidePanel` (`SidePanel.tsx:61`, `div.sb`) is the one panel that draws a `section` list; no other panel of the app draws its content in sections today. See concern 1.

## Areas of concern
1. Where the rule goes. The rule `.sb h3:first-child` that causes the loss is in the shared `shell.css`, so the repair is there too: `.sb section + section` (R1). Answered from the code (`shell.css:70-80`, `SidePanel.tsx:61`). Owner: Thanh Truong.
2. The Leave and archive blocks. They are `div`s with their own space (`.dp-leave` 16 px, as the prototype's inline `margin-top:16px`); the rule of R1 does not reach them, so they are not changed. Settled in this spec. Owner: Thanh Truong.
