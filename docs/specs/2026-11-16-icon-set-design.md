# Icon set design

Date: 2026-11-16 · Status: draft for review
Intent: docs/intents/icon-set.md (Thanh Truong)
Ticket: TOKI-011

## Goal
The builder (Thanh and Claude) needs the icons of the prototype as components before the base components and screens are built. Today `packages/ui-web` exports nothing, and the drawings exist only as one table inside the prototype's HTML file. After this change `ui-web` exports 43 icon components, drawn as in the prototype, coloured by the text around them and usable in any size.
The plan says "roughly 60 icons". The real numbers are in Scope.

## Scope
- In: the 43 icons of Table A as React components; one component that draws an icon by its name; the list of names, the `IconName` and `IconProps` types; the files, dependencies and test setup of `packages/ui-web` that these need; tests.
- What the prototype holds, counted by script (see Design, "How the list was made"): its icon table has 78 entries, which are 75 names (`left`, `right` and `play` are each written twice; the later entry wins in the prototype, and it is the one used here). Two names, `bolt` and `zap`, have the same drawing. The prototype draws 68 of the 75 names on screen; 7 are never drawn.
- Left out, 32 names, none of them invented away:
  - 7 are never drawn anywhere in the prototype: `chart`, `dot`, `minus`, `square`, `up`, `video-off`, `wave`. `dot` is only the prototype's fallback for an unknown name, which cannot happen here (R2).
  - 25 are drawn only by features that phase 1 does not build or by demo tooling that never ships. Table B lists each with its source. One rule is applied to every name: a name is left out when every place in the prototype that draws it belongs to a feature that the decision log or the Blueprint scope puts outside phase 1, or to demo tooling.
- Out (not now):
  - Colours, light and dark values and sizes of components: TOKI-009 (colours) and the component tickets. An icon takes its colour from the text around it and its size from its caller (R5, R6); the pixel sizes that the prototype's CSS gives to each place (12 to 30) belong to the component that draws the place.
  - IconButton, menu items, empty states and every other component that uses an icon, and the lint rule that an icon-only button has a name (D-075): TOKI-012 and the tickets after it. This work only guarantees that an icon is not itself named (R7).
  - The global rule `.ic{flex:none}` and any other CSS: TOKI-012 owns `.ic{flex:none}` (Decided in this spec; Design). This work adds no CSS.
  - The component preview page that shows every icon: TOKI-016.
  - Importing `@toki/ui-web` from `apps/web` and declaring it there: the first ticket that uses an icon in the app.
  - Icons for the phone app: `ui-native` in phase 3 (concern 7).
  - Any icon that the prototype does not draw, and any new drawing.
  - Text: an icon has no text and no `title`, so nothing here goes through i18n.

## Requirements
- R1. `@toki/ui-web` exports exactly 43 icon components, one for each name of Table A, named `<Name>Icon` where `<Name>` is the table name in PascalCase (`bell-off` gives `BellOffIcon`, `x` gives `XIcon`), and exports no other component, type or value from `src/icons` besides those named in R2, R3 and R15 (`IconProps`).
- R2. `@toki/ui-web` exports the type `IconName`, which is the union of the 43 names of Table A, and `iconNames`, an array holding those 43 names in the order of Table A. A name outside `IconName` is a type error at `pnpm typecheck`; no run-time check exists.
- R3. `@toki/ui-web` exports a component `Icon` that takes a required `name` of type `IconName`. `Icon` takes the same props as a named icon (R15) plus `name`. `<Icon name="bell" />` renders the same markup as `<BellIcon />`, for each of the 43 names.
- R4. Each icon renders one `svg` element with exactly these attributes: `class="ic"`, `viewBox="0 0 24 24"`, `width="18"`, `height="18"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="1.75"`, `stroke-linecap="round"`, `stroke-linejoin="round"` and `aria-hidden="true"`, with one `path` child whose `d` is the path of that name in Table A. These are the attributes of the prototype's `icon()` function.
- R5. Props. `size` (a number) sets both `width` and `height`; without it they are 18. `strokeWidth` sets `stroke-width`; without it, 1.75. `className` is added after `ic` (`class="ic active"`). Any other attribute of an `svg` element passes through (for example `data-testid`, `style`, `focusable`), except those that the icon owns (R15). The attributes of R4 are applied after the spread, so a caller cannot override them even by a cast.
- R6. Colour comes only from `currentColor`: no non-test source file of `src/icons` (every file except `*.test.ts` and `*.test.tsx`, which must contain these strings to search for them) contains a colour literal (`#`, `rgb(`, `hsl(`) or imports `@toki/tokens`, so an icon follows the colour that its parent sets, in both looks.
- R7. An icon never gets its own name. `aria-hidden` is always `"true"` and cannot be changed (it is applied after the spread, R5), and the props type does not accept `aria-label`, `aria-labelledby`, `aria-hidden`, `title` or `children`; passing one is a type error at `pnpm typecheck`. The name of an icon-only button comes from the button (D-075).
- R8. Every path in `packages/ui-web/src/icons/paths.ts` equals the path of the same name in the prototype's icon table (the later entry for `left`, `right` and `play`), character for character.
- R9. None of the 32 left-out names (Scope) is in `iconNames`, has an export, or has an entry in `paths.ts`.
- R10. Adding an icon takes one entry in `paths.ts`, one export, and an edit of the two name lists in the test (the 43 kept names; and, for a name that is now left out, its removal from the 32 left-out names). The test of R1 fails when a name is in `iconNames` without its export, or an export is not in `iconNames`, and the test of R9 fails when a left-out name appears, so the person adding an icon is told by a red test what to change.
- R11. `packages/ui-web/package.json` sets `"sideEffects": ["**/*.css"]`, so a bundler may skip a module of the package that nothing imports but keeps any CSS file that a later ticket adds. Each icon is its own named export; a module of `src/icons` has no statement that runs when it is imported other than creating the components. The `exports` entry stays `".": "./src/index.ts"` (TOKI-001 R4) at the time of this change and `src/index.ts` re-exports `./icons`. This does not promise that a bundle with one icon drops the other 42 (Design).
- R12. `pnpm install` exits 0 with the dependencies of Layout declared. `pnpm typecheck` at the root exits 0 with `jsx` and the DOM library set in `packages/ui-web/tsconfig.json` only. `pnpm --filter @toki/ui-web test` runs the tests of this package and exits 0.
- R13. With the new files, `pnpm lint`, `pnpm lint:boundaries` and `pnpm format:check` exit 0 (TOKI-002), and no file of `packages/ui-web/src` uses a banned platform API.
- R14. This change adds no import of `@toki/ui-web` to `apps/web` and no dependency on it to `apps/web/package.json`. This holds for this change only: the first ticket that uses an icon in the app adds both, as intended.
- R15. `@toki/ui-web` exports the type `IconProps`, the props of every named icon and, with `name`, of `Icon`. It is the props of an `svg` element without `ref`, minus the attributes that the icon owns: `stroke`, `fill`, `viewBox`, `width`, `height`, `strokeLinecap`, `strokeLinejoin`, `role`, `dangerouslySetInnerHTML` and the names of R7; plus `size` and `strokeWidth` (R5). Passing an owned attribute is a type error at `pnpm typecheck`; at run time the attributes of R4 win (R5). Components that wrap an icon (IconButton, TOKI-012) use `IconProps`.
- R16. The names of the icon components follow one rule that a lint rule can match: every export of `@toki/ui-web` that draws an icon is named `Icon` or ends in `Icon` (`BellIcon`), and no other export of the package has a name that ends in `Icon`. TOKI-012 reads this: its lint rule for D-075 treats a JSX element with such a name, imported from `@toki/ui-web`, as an icon, and an icon alone in a button is not a name (R7).

## Design
### How the list was made
The list was extracted from the prototype (`docs/blueprint/prototype/index.html`) by script, not by eye:
- The prototype defines its icons in one object, `const ICONS={...}`, and draws one with `icon(name, className)`, which returns an `svg` of 24 by 24 units with one `path`. A script read the object with a regular expression and counted entries, names and distinct drawings.
- To find which names are drawn, the script read every call of `icon(...)` and of every helper that passes a name on to it (`emptyHtml`, the menu item function, the call control button function, the palette `add` function), including calls whose argument is a condition such as `c.priv?'lock':'hash'`, and every `[key, icon, label]` row that is drawn later (the navigation rows, the More sheet rows, the add-a-tab rows). Names that are only passed through as a parameter were followed to the place that writes them. Every name found is defined, and no call was left unresolved.
- Result: 78 entries, 75 names, 74 distinct drawings, 68 names drawn, 7 never drawn. After Table B, 43 remain.
- A second pass read the CSS: the prototype gives the `ic` class sizes of 12, 13, 14, 15, 16, 17, 20, 26 and 30 pixels in different places, and a stroke width of 2.2 for the active bottom tab; every other icon is 18 pixels with stroke width 1.75.

### Table A. The 43 icons
`Drawn by` names the prototype functions that draw the icon, so that the place can be found. The path is the `d` attribute, copied from the prototype.

| # | Name | Component | Drawn by (prototype function) | Path data (`d`) |
| :-- | :-- | :-- | :-- | :-- |
| 1 | `at` | `AtIcon` | `composerHtml` | `M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94` |
| 2 | `bell` | `BellIcon` | `SECTIONS`, `activityHtml`, `laterHtml`, `menuHtml`, `navHtml` | `M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0` |
| 3 | `bell-off` | `BellOffIcon` | `menuHtml`, `navHtml`, `paletteItems`, `stripsHtml` | `M6 8a6 6 0 0 1 9-5.2M18 8c0 4 1 6 2 7.5M3 17h13M10.3 21a1.94 1.94 0 0 0 3.4 0M2 2l20 20` |
| 4 | `bold` | `BoldIcon` | `composerHtml` | `M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z` |
| 5 | `bolt` | `BoltIcon` | `menuHtml`, `navHtml`, `paletteItems`, `stripsHtml` | `M13 2L3 14h9l-1 8 10-12h-9z` |
| 6 | `bookmark` | `BookmarkIcon` | `SECTIONS`, `laterHtml`, `modalHtml`, `msgHtml` | `M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z` |
| 7 | `check` | `CheckIcon` | `activityHtml`, `attHtml`, `catchAllHtml`, `catchupHtml`, `guideHtml`, `laterHtml`, `meetHtml` | `M20 6L9 17l-5-5` |
| 8 | `clock` | `ClockIcon` | `activityHtml`, `composerHtml`, `laterHtml`, `menuHtml`, `msgHtml`, `peopleHtml`, `profileHtml` | `M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2` |
| 9 | `code` | `CodeIcon` | `composerHtml` | `M16 18l6-6-6-6M8 6l-6 6 6 6` |
| 10 | `copy` | `CopyIcon` | `calSubHtml`, `chatHtml`, `detailsHtml`, `menuHtml` | `M9 9h11a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1` |
| 11 | `down` | `DownIcon` | `composerHtml`, `convsHtml`, `taskPanelHtml`, `tasksHtml` | `M6 9l6 6 6-6` |
| 12 | `edit` | `EditIcon` | `autoRow`, `convsHtml`, `mailHtml`, `menuHtml` | `M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z` |
| 13 | `external` | `ExternalIcon` | `attHtml`, `chatHtml` | `M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3` |
| 14 | `file` | `FileIcon` | `attHtml`, `composerHtml`, `fileRow`, `filesHtml`, `modalHtml` | `M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h6` |
| 15 | `folder` | `FolderIcon` | `SECTIONS`, `chatHtml`, `filesHtml`, `guestHtml`, `menuHtml`, `modalHtml` | `M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z` |
| 16 | `globe` | `GlobeIcon` | `chromeHtml`, `profileHtml` | `M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z` |
| 17 | `grid` | `GridIcon` | `filesHtml` | `M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z` |
| 18 | `hash` | `HashIcon` | `adminHtml`, `chatHtml`, `convGlyph`, `convRow`, `convsHtml`, `detailsHtml`, `mailHtml`, `meetHtml`, `menuHtml`, `modalHtml`, `paletteItems` | `M4 9h16M4 15h16M10 3L8 21M16 3l-2 18` |
| 19 | `home` | `HomeIcon` | `SECTIONS`, `chatHtml`, `ctrlsHtml`, `msgsHtml`, `navHtml`, `paletteItems`, `profileHtml` | `M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z` |
| 20 | `image` | `ImageIcon` | `fileRow`, `filesHtml` | `M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21` |
| 21 | `italic` | `ItalicIcon` | `composerHtml` | `M19 4h-9M14 20H5M15 4L9 20` |
| 22 | `left` | `LeftIcon` | `chatHtml`, `chromeHtml`, `guestHtml`, `mailHtml`, `sideHead` | `M15 18l-6-6 6-6` |
| 23 | `link` | `LinkIcon` | `calendarHtml`, `chatHtml`, `fileRow`, `filesHtml`, `menuHtml`, `modalHtml`, `paletteItems` | `M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71` |
| 24 | `list` | `ListIcon` | `filesHtml` | `M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01` |
| 25 | `lock` | `LockIcon` | `adminHtml`, `chatHtml`, `chromeHtml`, `convGlyph`, `convRow`, `detailsHtml`, `guestHtml`, `inviteHtml`, `menuHtml`, `modalHtml`, `paletteItems` | `M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM7 11V7a5 5 0 0 1 10 0v4` |
| 26 | `menu` | `MenuIcon` | `navHtml` | `M3 12h18M3 6h18M3 18h18` |
| 27 | `moon` | `MoonIcon` | `paletteItems` | `M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z` |
| 28 | `more` | `MoreIcon` | `msgHtml` | `M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z` |
| 29 | `paperclip` | `PaperclipIcon` | `composerHtml` | `M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48` |
| 30 | `pin` | `PinIcon` | `chatHtml`, `menuHtml`, `msgHtml` | `M12 17v5M9 3h6l-1 7 3 3v2H7v-2l3-3z` |
| 31 | `plus` | `PlusIcon` | `autoGalleryHtml`, `calendarHtml`, `chatHtml`, `composerHtml`, `convsHtml` | `M12 5v14M5 12h14` |
| 32 | `reply` | `ReplyIcon` | `mailHtml`, `msgHtml` | `M9 17l-5-5 5-5M20 18v-2a4 4 0 0 0-4-4H4` |
| 33 | `search` | `SearchIcon` | `chatHtml`, `convsHtml`, `filesHtml`, `msgsHtml`, `navHtml`, `paletteHtml`, `peopleHtml` | `M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35` |
| 34 | `send` | `SendIcon` | `composerHtml`, `mailHtml`, `modalHtml` | `M22 2L11 13M22 2l-7 20-4-9-9-4z` |
| 35 | `settings` | `SettingsIcon` | `SECTIONS`, `menuHtml`, `modalHtml` | `M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6` |
| 36 | `shield` | `ShieldIcon` | `SECTIONS`, `modalHtml` | `M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z` |
| 37 | `smile` | `SmileIcon` | `composerHtml`, `ctrlsHtml`, `menuHtml`, `msgHtml`, `paletteItems` | `M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01` |
| 38 | `star` | `StarIcon` | `chatHtml` | `M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z` |
| 39 | `trash` | `TrashIcon` | `menuHtml` | `M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6` |
| 40 | `user` | `UserIcon` | `paletteItems` | `M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z` |
| 41 | `users` | `UsersIcon` | `SECTIONS`, `chatHtml`, `convRow`, `ctrlsHtml`, `modalHtml`, `paletteItems`, `peopleHtml` | `M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75` |
| 42 | `wifi-off` | `WifiOffIcon` | `convsHtml`, `paletteItems`, `protoHtml`, `stripsHtml` | `M2 2l20 20M8.5 16.4a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5.2-2.8M19 12.9a10 10 0 0 0-2.2-1.6M12 20h.01M1.4 9a15 15 0 0 1 4.3-2.6M10.7 5.1A15 15 0 0 1 22.6 9` |
| 43 | `x` | `XIcon` | `attHtml`, `callHtml`, `chatHtml`, `composerHtml`, `guideHtml`, `menuHtml`, `mhd`, `sideHead` | `M18 6L6 18M6 6l12 12` |

### Table B. Drawn by the prototype but left out (25 names)
A name is left out only when every function that draws it belongs to a feature that the decision log or the Blueprint scope puts outside phase 1, or to demo tooling that never ships. Where one place is in phase 1, the icon is kept. The same rule is applied to every name. `Source` names the decision where one says it, and otherwise the Blueprint (context.md): its Scope tab, whose "Later phases" and "Dropped" lists, and the written journeys with their phase in brackets (accepted as the baseline in D-091).

| Name | Drawn by (prototype function) | Feature | Source |
| :-- | :-- | :-- | :-- |
| `approve` | `attHtml`, `menuHtml` | Approval requests | Blueprint Scope, "approval requests" (later phases); F47 [2] |
| `archive` | `adminHtml`, `mailHtml` | Mail; the analytics CSV download | D-007; Blueprint F49 [5] (Analytics) |
| `calendar` | `SECTIONS`, `attHtml`, `meetHtml`, `modalHtml`, `paletteItems`, `schedFormHtml`, `tasksHtml` | Calendar, Meet and Tasks | Blueprint Scope, "Calendar, Meet, ICS feed" and "Tasks, Notes"; F48 [4]; D-002, D-006 |
| `captions` | `ctrlsHtml` | Meet | D-006 |
| `drag` | `tasksHtml` | Tasks | Blueprint Scope, "Tasks, Notes"; D-002 |
| `hand` | `ctrlsHtml`, `tileHtml` | Meet | D-006 |
| `inbox` | `mailHtml` | Mail | D-007 |
| `info` | `guestHtml`, `protoHtml` | The prototype note on the guest sign-in; the Guide button | D-152 (Guest is phase 5), D-145 (the Guide bar) |
| `layout` | `callHtml` | Meet | D-006 |
| `leave` | `ctrlsHtml` | Meet | D-006 |
| `mail` | `SECTIONS`, `attHtml`, `mailHtml`, `navHtml` | Mail | D-007 |
| `mic` | `ctrlsHtml`, `menuHtml`, `miniHtml`, `modalHtml` | Meet; voice clips | D-006; Blueprint Scope, "voice clips" |
| `mic-off` | `callHtml`, `ctrlsHtml`, `miniHtml`, `tileHtml` | Meet | D-006 |
| `monitor` | `aiNote`, `chromeHtml` | AI summaries; the simulated desktop window | D-053, D-008; D-145 (the Device switch is demo tooling) |
| `pause` | `attHtml` | The voice clip player | Blueprint Scope, "voice clips" |
| `play` | `attHtml`, `autoRow` | The voice clip player; "Run now" on an automation | Blueprint Scope, "voice clips"; D-090, F49 [5] |
| `poll` | `attHtml`, `menuHtml` | Polls | Blueprint Scope, "Polls"; F47 [2] |
| `refresh` | `calSubHtml`, `chromeHtml` | The Calendar feed link; the simulated browser bar | Blueprint Scope, "ICS feed"; D-145 |
| `right` | `autoGalleryHtml`, `chromeHtml` | The automation gallery; the simulated browser bar | D-090, D-145 |
| `screen` | `ctrlsHtml`, `stageHtml` | Meet | D-006 |
| `sparkles` | `activityHtml`, `catchAllHtml`, `catchupHtml`, `msgsHtml`, `paletteItems`, `threadHtml`, `threadSumHtml` | AI summaries | D-008, D-053 |
| `tasks` | `SECTIONS`, `chatHtml`, `menuHtml`, `modalHtml`, `msgHtml` | Tasks | Blueprint Scope, "Tasks, Notes"; D-002 |
| `user-plus` | `autoGalleryHtml`, `chatHtml`, `detailsHtml`, `inviteHtml`, `paletteItems` | Guest invitations; automations; "View as guest" | D-152 (Guest phase 5), D-090; Blueprint Scope, "Guest portal"; D-145. Undecided for F02 and F22, concern 2 |
| `video` | `SECTIONS`, `attHtml`, `chatHtml`, `ctrlsHtml`, `evRow`, `guestHtml`, `meetHtml`, `navHtml`, `paletteItems`, `profileHtml` | Meet | D-006 |
| `zap` | `adminHtml`, `autoGalleryHtml`, `detailsHtml`, `paletteItems` | Automations | D-090 |

Reasons, by source:
- D-002 lists the groups of the first release: core chat, Activity, Later, Files, People, Preferences, command palette. Calendar, Tasks, Mail, Meet, the automations, polls, voice clips and approvals are not among them. For Calendar, Tasks, polls, voice clips and approvals the log says this only by omission, so the Blueprint scope tab (context.md, "Later phases") is cited as well: "Tasks, Notes, custom tabs", "Polls, voice clips, approval requests, send later", "Calendar, Meet, ICS feed", "Guest portal, automations, admin analytics", "Mail". The written journey F47 (polls, approvals, send later) is marked [2], F48 (Calendar and Meet) [4], F49 (automations, analytics) [5].
- D-006: video calling (Meet) is its own later phase (`mic` is also on the Meet controls). D-007: Mail is a later phase. D-008 and D-053: AI summaries exist nowhere in phase 1 (`sparkles`, `monitor`).
- D-090: a Member creating automations is phase 5 (`play` on "Run now", `right`, `zap`); D-152: Guest is phase 5, so the guest invitation and "View as guest" (`user-plus`) are out. The analytics section, with its CSV download (`archive`), is phase 5 (F49 [5]; D-183 says the same of the Analytics section).
- D-145: the Look / Device / Clock / Guide bar and every demo control never ship, which covers the Guide button (`info`) and the Device switch's browser and desktop frames (`refresh`, `right`, `monitor`). The prototype also has a note on the guest sign-in that says no email is sent; it is demo text.
- What the phase 1 screens need, checked against the written journeys (accepted as the baseline in D-091): the phone's bottom bar is Home, Activity, Later, Files, More (F38), and its More sheet holds Search, People, Preferences, Admin, Set status, Pause notifications, Focus time and Sign out. Every icon these need (`home`, `bell`, `bookmark`, `folder`, `menu`, `search`, `users`, `settings`, `shield`, `smile`, `bell-off`, `bolt`) is kept, so `mail` and `video` (which the prototype puts in its bottom bar) are not needed in phase 1. The prototype draws no icon for Sign out and none for the Admin member table or its row actions (F39, F40, F41); those are not part of this ticket (concern 2).
- `calendar`, `tasks`, `drag`, `video`, `mail` also appear in the prototype's navigation and More sheet. Which navigation items phase 1 shows is for the app shell (TOKI-015); an icon that it needs is added by R10.

### Layout
```
packages/ui-web/
├─ package.json          adds react (peer and dev), react-dom, @types/react, @types/react-dom, @types/node, vitest (dev); sideEffects: ["**/*.css"]; script: test
├─ tsconfig.json         adds jsx: react-jsx and the DOM library
└─ src/
   ├─ index.ts           export * from "./icons"
   └─ icons/
      ├─ paths.ts        iconPaths: the 43 names and their path data; IconName, iconNames
      ├─ icon-base.tsx   the svg of R4 and R5, one function; IconProps (R15)
      ├─ icons.tsx       the 43 named components and Icon
      ├─ index.ts        re-exports
      └─ icons.test.tsx  the tests
```
- Decided in this spec: the path data sits in `paths.ts`, a file with no React in it, so that the phone app can move or share it in phase 3 without touching the components (concern 7).
- Decided in this spec: each named icon is made by one function, `createIcon(name)`, from the path of that name, and given a `displayName`; `Icon` looks the name up in a map. Decided in this spec: tree shaking is not promised. The 43 icons are top-level calls in one module, which a bundler may keep when only one is imported, and `Icon` holds a map of all of them. The 43 paths total about 3,000 characters, so the cost is small and no test measures it. `sideEffects` lists only CSS files (R11), so that a stylesheet added to `ui-web` later is never dropped from a production build.
- Decided in this spec: the prototype's names are kept, even where the drawing does not match the word: `home` is a speech bubble, `more` is three dots, `bolt` is the lightning bolt that `zap` also draws (only `bolt` is kept). Later tickets then match the prototype's code by name.
- Decided in this spec: the size is a prop, not a token. The prototype sets the size from the CSS of each place, so the component that draws the place passes `size` or sets it in its own CSS; `ic` is on the element so that carried-over prototype CSS still applies, for example `.ic{flex:none}` and the rules that colour an icon inside a note or a banner (`className` and `style` pass through, R5). Decided in this spec: the global rule `.ic{flex:none}` is owned by TOKI-012 (Base components, group 1), the first ticket that puts icons in flex rows and the first to write component CSS in `ui-web`; without the rule an icon shrinks inside a flex row. This ticket adds no CSS.
- Decided in this spec: `React` is declared as a peer dependency and also as a dev dependency of `ui-web`, at the same version as `apps/web` (TOKI-006 pins it in the lockfile and leaves the number to the build). `react-dom` is a dev dependency for `renderToStaticMarkup` in the tests, which needs no DOM. Vitest is added to `ui-web` itself the way TOKI-009 does for `tokens`: if the root or any other workspace project already has Vitest when this work is built, `ui-web` uses the same exact version; otherwise it pins the stable release of that day. `@types/react` and `@types/react-dom` are the versions for the same major of React; `@types/node` (the test reads files) follows the rule of TOKI-009 (the latest release of the Node major version in the root `engines` field, or the version already in the repository). `react` is a peer dependency with the range of the same major as `apps/web` (for example `^19.0.0` when `apps/web` has React 19), and also a dev dependency. All pinned versions are exact. The test run of TOKI-008 is expected to pick the test file up with no change (its R12); if TOKI-008 keeps a list of packages that have tests (its Layout), `ui-web` must be added to it there (hand-off below).
- `ui-web` already depends on nothing else; `platform` and `tokens` are not imported.

### Hand-offs to later tickets
This ticket cannot test these; each names its reader.
- TOKI-012: the lint rule for icon-only buttons (D-075) matches the names of R16 (`Icon` and `*Icon` imported from `@toki/ui-web`) and does not count them as a name. TOKI-012 also owns `.ic{flex:none}` (Design, above), and uses `IconProps` (R15) for IconButton.
- TOKI-012, TOKI-013, TOKI-014, TOKI-015: an icon is always hidden from screen readers (R7), so a state that the prototype shows only by an icon (`lock` for a private channel, `star` for a starred channel, `bell-off` for a muted one, `wifi-off` for no connection) needs a text name in the component that draws it (a visible word, or a name on the button or row). The prototype's names mislead in places (`HomeIcon` is a speech bubble, `MoreIcon` is three dots); a component should not be named after the icon it draws.
- TOKI-008: if its Vitest list names the packages that have tests, `ui-web` is added to it.
- The plan: TOKI-012 needs TOKI-011 (concern 8), and the TOKI-011 line says 43 icons (concern 1).

### Errors
- A name outside `IconName` -> a type error at `pnpm typecheck` (R2); not checked while running.
- An `aria-label`, `title`, `children`, `aria-hidden` or any attribute that the icon owns (R15) passed to an icon -> a type error (R7, R15).

## Testing
- Tests are written first and seen to fail on the empty package, then made to pass. They live in `packages/ui-web/src/icons/icons.test.tsx` and run with `pnpm --filter @toki/ui-web test`. They render with `renderToStaticMarkup`; no browser and no DOM global is used.
- R1, R2, R9, R10: the test holds the list of the 43 names as a literal and the list of the 32 left-out names. It checks that `iconNames` equals the 43 in order, that the exports of the icons module equal the 43 component names plus `Icon` and `iconNames` (types are not run-time exports, so `IconProps` is not in this list), and that none of the 32 appears.
- R3: for each of the 43 names, the markup of `<Icon name=... />` equals the markup of the named component.
- R4: for each of the 43, the markup is parsed and one `svg` with exactly the ten attributes of R4 and one `path` with a `d` is found. The value of `d` is checked against `iconPaths`, and three paths (`bell`, `x`, `wifi-off`) are also written out in the test as literals from Table A.
- R5: renders with `size={14}`, `strokeWidth={2.2}`, `className="active"` and `data-testid`; the markup shows `width="14" height="14"`, `stroke-width="2.2"`, `class="ic active"` and the test id. A render with `stroke`, `fill`, `viewBox` and `role` passed through a cast (`as never`) still shows `stroke="currentColor"`, `fill="none"`, `viewBox="0 0 24 24"` and no `role`.
- R6: a test reads the non-test source files under `src/icons` (every file whose name does not end in `.test.ts` or `.test.tsx`) and fails on `#`, `rgb(`, `hsl(` or `@toki/tokens`. The test file itself is excluded because it must contain these strings.
- R7, R15: the markup always has `aria-hidden="true"`; lines marked `// @ts-expect-error` pass `aria-label`, `title`, `children`, `aria-hidden={false}`, `stroke`, `viewBox` and `role`; `pnpm typecheck` fails if any of them is accepted (an unused `@ts-expect-error` is itself an error). A line that passes `size`, `strokeWidth`, `className` and `data-testid` must typecheck.
- R16: the test checks that every export of the icons module other than `iconNames` is named `Icon` or ends in `Icon`.
- R8, R11 (the `package.json` and `exports` parts) and R14 are checked once by script or by search when the work is built, and the result is recorded in the PR. They are not part of the test run: the prototype file is not part of this package (R8), and a later ticket may legitimately add a subpath to `exports` or import `@toki/ui-web` in `apps/web` (R14). R8: the script reads the prototype's `ICONS` object and `paths.ts` and compares every name. R11: `sideEffects` is `["**/*.css"]` and `exports` is the single entry of TOKI-001. R14: a search finds no `@toki/ui-web` in `apps/web`. After the R8 check, the three literal paths of R4 and the fixed list of R1 guard against edits.
- R11 (the module part): a test lists the top-level statements of `icons.tsx` by reading the file and fails on anything other than imports, the factory import and `export const` declarations of the components and `Icon`.
- R12, R13: `pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm lint:boundaries` and `pnpm format:check` run on the finished branch and exit 0.
- The look of the icons next to the prototype is compared by eye on the component preview page (TOKI-016), in Calm and Focus. This work shows nothing on a page.
- No data, names or addresses are used.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Blueprint work area: Design system | The change is the icon part of `ui-web`; Scope and Layout |
| Belongs to intent I02 design-system | The drawings, attributes and names of the prototype are kept (R4, R8), so components built on them can match it |
| Milestone: M1 | Planning fact; no design impact |
| Size: S, about half a working session with Claude | One small package change: 43 entries in a table, one factory, one test file; no component CSS, no preview page |
| Needs: TOKI-006 (Web app skeleton) | Uses the React version that TOKI-006 pins for `apps/web` (Design). This work does not touch `apps/web` (R14). TOKI-006 and TOKI-009 name icons as out of their scope; this work covers them |
| Agreed scope: "roughly 60 icons as components" | 43 components (R1), after the counts and the 32 left-out names in Scope; concern 1 |
| The drawings come from the prototype; none is invented | R4, R8; the list in Table A is taken from the prototype's own table by script |
| Every icon-only button has a name (D-075, NFR-03) | The icon is hidden from screen readers and cannot be named (R7), and its component names can be matched by a lint rule (R16), so the button's own name is the only name. IconButton and the lint rule are TOKI-012 (Hand-offs) |
| Components live in `ui-web`; `ui-native` in phase 3 | Layout: all code in `packages/ui-web`; the path data is kept apart (concern 7) |
| Components reach platform features only through `platform`; lint bans direct use of the notification, storage, service worker and audio APIs in `ui-web` | An icon calls no platform API; R13 |
| Only the features of phase 1 are built; demo-only controls never ship (D-002, D-145) | Table B and its reasons; the 25 names are left out with the 7 never drawn (R9) |
| Every text goes through i18n; English default | An icon has no text and no `title` (R7); nothing to translate |
| M1 exit check: the preview page matches the prototype in Calm and Focus | The size, stroke and colour behaviour of the prototype is reproduced (R4, R5, R6); the comparison is on the preview page (TOKI-016) |

## Open questions from the intent
- How many icons are there really, and which of them does phase 1 use? Answered: 75 names defined, 68 drawn, 43 used in phase 1 (Scope, Table A, Table B). See concern 1.
- Which prototype icons belong to features that are not in phase 1? Answered: the 25 of Table B, each with its source. Three of the phase 1 flows (F02, F22, F26) need a button whose icon the prototype does not draw. See concern 2.
- How does an icon get its size and colour, given that the prototype sets sizes from the CSS of each place? Answered: colour from `currentColor` (R6), default size 18 and a `size` prop (R5). See concern 5.
- Do the prototype's icon drawings come from an open-source set with a licence? Not answered. Carried forward as concern 9.

## Areas of concern
1. The plan says "roughly 60 icons". The prototype defines 75 names and draws 68; this spec keeps 43. Decided in this spec: the number follows the prototype and the decision log and Blueprint scope, not the plan. The plan line should say 43. Owner: Thanh Truong.
2. Settled from the written journeys (accepted as the baseline, D-091): the phone's bottom bar and More sheet need no left-out icon (Design, Table B reasons). Not decided: F02 (Invite members, on the Admin page), F22 (Add people to a channel) and F26 (Archive a channel) are phase 1 flows that need a button each, and the prototype draws none of them: its only invitation drawing is `user-plus` on the guest "Invite a client" and "Send invitation" buttons (Guest, phase 5), and it uses `archive` only for Mail and the analytics CSV button. Whether these three buttons carry an icon, and which (`user-plus` and `archive` are the candidates), is a design choice no decision makes. `user-plus` and `archive` stay left out. Proposal, not a decision: the ticket that builds each screen adds the icon by R10 from the prototype's drawing if it wants one; a text button needs none. The prototype also draws no icon for Sign out and none for the Admin row actions; they are not part of this ticket. Owner: Thanh Truong.
3. Decided in this spec: `approve`, `poll`, `pause`, `play` and `mic` are left out, by the same rule as every other name (Table B): the places that draw them are polls, voice clips, approval requests, Meet and automations, which the Blueprint scope puts in later phases (F47 [2], F48 [4], F49 [5]; D-006, D-090). The log states this by omission from D-002 for polls, voice clips and approvals, and the Blueprint scope tab says it; if the product owner puts one of them in phase 1, it comes back by R10. Owner: Thanh Truong.
4. The prototype's names are kept even where they mislead (for example `home` is a speech bubble). Decided in this spec, for matching the prototype's code. Owner: Thanh Truong.
5. Sizes of 12 to 30 pixels and a stroke of 2.2 on the active bottom tab come from the prototype's CSS. Decided in this spec: the icon has a default of 18 and a stroke of 1.75, and the component that draws the place sets the rest. Owner: Thanh Truong.
6. React, `react-dom`, `@types/react`, `@types/react-dom`, `@types/node` and Vitest versions are not in the Blueprint. Decided in this spec: React is the major version of `apps/web` (the peer range follows it); the type packages follow the React major and, for `@types/node`, TOKI-009's rule; Vitest uses the same exact version as any other workspace project that already has it, as TOKI-009 does (its concern 8), and otherwise the stable release of the day, pinned exactly. If TOKI-004, TOKI-009 and this ticket are built in turn, one version results; TOKI-008 may later move it to the root. Owner: Thanh Truong.
7. The phone app (phase 3) cannot use React DOM components, so `ui-native` will draw the same paths with its own components. Where the path data then lives (stay in `ui-web`, or move to `shared` or `tokens`) is not decided. This spec keeps the data in its own file so either move is small. Not decided. Owner: Thanh Truong.
8. The plan does not list TOKI-011 in the Needs column of any ticket, though IconButton, menus and empty states use icons. Decided in this spec: TOKI-012 needs TOKI-011, because it reads the icon names for its lint rule (R16), owns `.ic{flex:none}` and builds IconButton on `IconProps`; the tickets that need TOKI-012 reach the icons through it. The plan should add TOKI-011 to the Needs of TOKI-012. Owner: Thanh Truong.
9. The Blueprint does not say where the drawings come from. Their style (24 by 24 units, round line ends, a stroke of about 2) resembles common open-source line icon sets, but the prototype names no source and no licence, and this spec cannot tell whether one applies. If one does, it may need a notice in the repository. Not answered. Owner: Thanh Truong.
10. The copy of each path is checked once against the prototype by script (R8); later changes to the prototype are not followed. Accepted: the prototype is the reference only until the preview page (TOKI-016) is accepted. Owner: Thanh Truong.
