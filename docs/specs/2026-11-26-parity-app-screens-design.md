# Parity check: five more screens design

Date: 2026-11-26 · Status: draft for review
Intent: docs/intents/parity-app-screens.md (Thanh Truong)
Ticket: TOKI-141

## Goal
The builder and the reviewer need the UI parity check to compare the screens of the app that have a counterpart in the prototype and are built: the conversation page, the Details panel, Browse channels, New message and Preferences. Today only the Admin page and the sign-in page are declared, so nothing says where these five differ. After this change they are declared screens of the check, shown on data made as the prototype's sample workspace, and the differences that stay are recorded with their reason.

## Scope
- In: the data of the check (R1), the five declared screens (R2), their reference images (R3), the record of their differences (R4), the notes (R5), the proof (R6).
- Out (not now):
  - Fixing any difference: the spacing of the Details panel (TOKI-139) and the hints of Browse and New message (TOKI-140) have their own tickets.
  - Screens that have no counterpart in the app (Activity, Later, Files, Mail, Calendar, Meet, Tasks, People, Profile, Search, the automations, the Meet screens) and the dialogs that the app has and the prototype has not (create channel).
  - The conversation page at a narrow width, and the Details, Browse and New message screens at a narrow width (concern 1).
  - Any change to the app, the prototype or the comparison.

## Requirements
- R1. A module `e2e/support/prototype-world.ts` exports `world()`, a workspace in the shape of `GET /api/v1/bootstrap` made as the prototype's sample workspace (`freshData()` of `e2e/prototype/index.html`): the workspace "Hugepig Studio", the person of the session Lan Nguyễn (an Admin), 8 people with the prototype's names, the channels of the prototype that Lan is a member of (`general`, `project-launch` starred, `mobile-release`, `design-crit`, `dev-infra`, `random`, and the private `client-saigon-coffee` and `leadership`) and the 4 direct messages and groups; and `stubWorld(page)`, which answers `GET /api/v1/auth/session`, `GET /api/v1/auth/sessions`, `GET /api/v1/channels`, `GET /api/v1/channels/{id}`, `GET /api/v1/channels/{id}/members` and the bootstrap, with the prototype's topics, descriptions, creators, dates and members; and the constant `LAUNCH`, the id of `project-launch`. Fake data only. Check: `apps/web/tests/e2e-fixtures.test.ts` parses `world()` with `BootstrapResponse`, finds Lan as the person of the session, 8 people, the starred channel and 12 conversations.
- R2. `e2e/parity/screens/app-screens.ts` declares five screens, each on `stubWorld`: `channel` (`/c/{LAUNCH}`, the prototype's `home`), `details` (the same, with the click on the members button of the header on each side), `browse` (the click on "Browse channels", the picture of the whole window, `appRoot: "html"`), `new-message` (the click on "New message", `appRoot: "html"`) and `prefs` (`/prefs`, the prototype's `prefs`). The first four run in Calm and Focus at 1280 and 900 px (concern 1); `prefs` at the three widths. Check: a run of the check lists 22 rows for them and none fails for a missing element or a missing reference.
- R3. The 22 reference images are made by `pnpm ui:reference` from the prototype and are in the pull request. Check: the files `e2e/parity/reference/<id>-<look>-<width>-chromium-linux.png` exist for the 22 rows.
- R4. The rows that are above the limit are listed in `e2e/parity/known-differences.ts`, one entry for each, with a reason for the screen that names what stays different and why: a feature that is not built yet (with the ticket that builds it), or a wording or a layout that a spec decided (with its requirement), and the ticket `accepted` (concern 3). A run then lists no new difference for these rows. Check: a run lists no new difference.
- R5. `e2e/parity/README.md` says what `prototype-world.ts` is, that a screen of the shell is shown on it, and that a dialog is captured as the whole window (`appRoot: "html"`). Check: the file holds it.
- R6. `pnpm format:check`, `pnpm lint`, `pnpm typecheck` and `pnpm test` pass, and two runs of the check one after the other give the same rows and the same ratios. Check: the commands exit 0 (the server database tests need `TEST_DATABASE_URL`, as for every pull request) and the two runs are recorded in the pull request.

## Design
- The data. `stubBootstrap` of `e2e/support/bootstrap.ts` already answers the bootstrap and the detail of a channel from a `Workspace`; `world()` is that `Workspace`, and `stubWorld` registers, after it, the routes that it does not answer (the members of a channel, the browse list, the list of the person's devices), because a route registered later answers first. The prototype's people have the roles of the prototype where the contract has them (Lan and Minh are Admins; there is no Owner role, D-152).
- The screens. The prototype opens at `home` with `project-launch` open: `section: "home"` shows the channel. The Details panel is the click on the members button (`[data-action="details"]` on the prototype, `[aria-label="Members and details"]` in the app). The dialogs are the click on `button[data-action="browse"]` and `button[data-action="newmsg"]` in the prototype, and on `button[aria-label="Browse channels"]` and `button[aria-label="New message"]` in the app.
- The element captured. A dialog of the app is drawn outside `.app`, so the picture is of `html` (R1 of TOKI-137, `appRoot`).
- The widths. At 720 px or less the prototype shows the list of conversations first and the app shows the open conversation, so the four screens are not the same screen there (concern 1).

### Layout
```
e2e/support/prototype-world.ts         R1
apps/web/tests/e2e-fixtures.test.ts    the test of R1
e2e/parity/screens/app-screens.ts      R2
e2e/parity/reference/                  22 images
e2e/parity/known-differences.ts        R4
e2e/parity/README.md                   R5
```

## Testing
- The test of `world()` is written first and seen to fail (the module does not exist).
- The check is run in the container twice (R6): the 22 rows, the same ratios; the rows of the Admin page and the sign-in page keep their ratios.
- The pictures are looked at in Calm and Focus to write the reasons of R4.
- Data used is fake only: the prototype's invented people, addresses on `example.com`.

## Data safety
- The pictures and the data hold only the prototype's invented sample data; no real person, address or secret goes into the repository.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| The reference images are made from the prototype, never from the app | R3 |
| The check stays inside the Playwright container and uses fake data only | R1 (fake data), R6 |
| A screen that the prototype and the app do not draw in the same way at a width is not compared at that width | R2; Scope, Out; concern 1 |
| The screens that are declared today produce the same rows as before | R6 |

## Open questions from the intent
- At a narrow width the prototype shows the list of conversations and the app the open conversation: are these screens compared at the wide and the middle widths only? Answered: at 1280 and 900 px only (R2); Preferences at the three widths. Decided by Thanh Truong (lead, as product owner) on 2026-11-26. See concern 1.
- Is the sample data a stub of the check, or the seeded workspace of the prototype's seed data ticket, which is not built yet? Answered: a stub of the check (R1). Decided by Thanh Truong (lead, as product owner) on 2026-11-26. See concern 2.
- Are the differences of these rows listed as known, with the ticket that fixes each, or left as new? Answered: listed as known, with a reason (R4). Decided by Thanh Truong (lead, as product owner) on 2026-11-26. See concern 3.

## Areas of concern
1. The narrow width. The prototype shows the list at 390 px and the app the conversation, so a row there compares two different screens. R2 compares the four screens at 1280 and 900 px; to compare at 390 px each side needs the steps that bring it to the same screen. Decided by Thanh Truong (lead, as product owner) on 2026-11-26: compare at 1280 and 900 px only. Owner: Thanh Truong.
2. The source of the data. `world()` is a stub of the check; the seeded workspace of the prototype's seed data ticket (TOKI-081) would replace it when it is built, and the screens that need it are then run with the database (`seed: true`). Decided by Thanh Truong (lead, as product owner) on 2026-11-26: a stub of the check now. Owner: Thanh Truong.
3. The rows that stay. R4 lists them as known, with a reason; the other way is to leave them as new, so that every run lists them. Some rows will hold both an item that a ticket fixes (TOKI-139, TOKI-140) and items that stay for good, so they do not become 'no longer a difference' when the ticket is done. Decided by Thanh Truong (lead, as product owner) on 2026-11-26: listed as known, with the ticket `accepted`. Owner: Thanh Truong.
