# Icon set design

Date: 2026-11-16 · Status: draft for review
Intent: docs/intents/icon-set.md (Thanh Truong)
Ticket: TOKI-011

## Goal
The builder (Thanh and Claude) needs the icons of the prototype as components before the base components and screens are built. Today `packages/ui-web` exports nothing, and the drawings exist only as one table inside the prototype's HTML file. After this change `ui-web` exports 48 icon components, drawn as in the prototype, coloured by the text around them and usable in any size.
The plan says "roughly 60 icons". The real numbers are in Scope.

## Scope
- In: the 48 icons of Table A as React components; one component that draws an icon by its name; the list of names and the `IconName` type; the files, dependencies and test setup of `packages/ui-web` that these need; tests.
- What the prototype holds, counted by script (see Design, "How the list was made"): its icon table has 78 entries, which are 75 names (`left`, `right` and `play` are each written twice; the later entry wins in the prototype, and it is the one used here). Two names, `bolt` and `zap`, have the same drawing. The prototype draws 68 of the 75 names on screen; 7 are never drawn.
- Left out, 27 names, none of them invented away:
  - 7 are never drawn anywhere in the prototype: `chart`, `dot`, `minus`, `square`, `up`, `video-off`, `wave`. `dot` is only the prototype's fallback for an unknown name, which cannot happen here (R2).
  - 20 are drawn only by features that phase 1 does not build or by demo tooling that never ships. Table B lists each with its decisions.
- Out (not now):
  - Colours, light and dark values and sizes of components: TOKI-009 (colours) and the component tickets. An icon takes its colour from the text around it and its size from its caller (R5, R6); the pixel sizes that the prototype's CSS gives to each place (12 to 30) belong to the component that draws the place.
  - IconButton, menu items, empty states and every other component that uses an icon, and the lint rule that an icon-only button has a name (D-075): TOKI-012 and the tickets after it. This work only guarantees that an icon is not itself named (R7).
  - The component preview page that shows every icon: TOKI-016.
  - Importing `@toki/ui-web` from `apps/web` and declaring it there: the first ticket that uses an icon in the app.
  - Icons for the phone app: `ui-native` in phase 3 (concern 7).
  - Any icon that the prototype does not draw, and any new drawing.
  - Text: an icon has no text and no `title`, so nothing here goes through i18n.

## Requirements
- R1. `@toki/ui-web` exports exactly 48 icon components, one for each name of Table A, named `<Name>Icon` where `<Name>` is the table name in PascalCase (`bell-off` gives `BellOffIcon`, `x` gives `XIcon`), and exports no other component or value from `src/icons` besides those named in R2 and R3.
- R2. `@toki/ui-web` exports the type `IconName`, which is the union of the 48 names of Table A, and `iconNames`, an array holding those 48 names in the order of Table A. A name outside `IconName` is a type error at `pnpm typecheck`; no run-time check exists.
- R3. `@toki/ui-web` exports a component `Icon` that takes a required `name` of type `IconName`. `<Icon name="bell" />` renders the same markup as `<BellIcon />`, for each of the 48 names.
- R4. Each icon renders one `svg` element with exactly these attributes: `class="ic"`, `viewBox="0 0 24 24"`, `width="18"`, `height="18"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="1.75"`, `stroke-linecap="round"`, `stroke-linejoin="round"` and `aria-hidden="true"`, with one `path` child whose `d` is the path of that name in Table A. These are the attributes of the prototype's `icon()` function.
- R5. Props. `size` (a number) sets both `width` and `height`; without it they are 18. `strokeWidth` sets `stroke-width`; without it, 1.75. `className` is added after `ic` (`class="ic active"`). Any other attribute of an `svg` element passes through (for example `data-testid`, `style`, `focusable`), except those named in R7.
- R6. Colour comes only from `currentColor`: no source file of `src/icons` contains a colour literal (`#`, `rgb(`, `hsl(`) or imports `@toki/tokens`, so an icon follows the colour that its parent sets, in both looks.
- R7. An icon never gets its own name. `aria-hidden` is always `"true"` and cannot be changed, and the props type does not accept `aria-label`, `aria-labelledby`, `aria-hidden`, `title` or `children`; passing one is a type error at `pnpm typecheck`. The name of an icon-only button comes from the button (D-075).
- R8. Every path in `packages/ui-web/src/icons/paths.ts` equals the path of the same name in the prototype's icon table (the later entry for `left`, `right` and `play`), character for character.
- R9. None of the 27 left-out names (Scope) is in `iconNames`, has an export, or has an entry in `paths.ts`.
- R10. Adding an icon takes one entry in `paths.ts` and one export; the test of R1 fails when a name is in `iconNames` without its export, or an export is not in `iconNames`.
- R11. `packages/ui-web/package.json` sets `"sideEffects": false`; each icon is its own named export; a module of `src/icons` has no statement that runs when it is imported other than creating the components. The `exports` entry stays `".": "./src/index.ts"` (TOKI-001 R4) and `src/index.ts` re-exports `./icons`.
- R12. `pnpm install` exits 0. `pnpm typecheck` at the root exits 0 with `jsx` and the DOM library set in `packages/ui-web/tsconfig.json` only. `pnpm --filter @toki/ui-web test` runs the tests of this package and exits 0.
- R13. With the new files, `pnpm lint`, `pnpm lint:boundaries` and `pnpm format:check` exit 0 (TOKI-002), and no file of `packages/ui-web/src` uses a banned platform API.
- R14. This change adds no import of `@toki/ui-web` to `apps/web` and no dependency on it to `apps/web/package.json`.

## Design
### How the list was made
The list was extracted from the prototype (`docs/blueprint/prototype/index.html`) by script, not by eye:
- The prototype defines its icons in one object, `const ICONS={...}`, and draws one with `icon(name, className)`, which returns an `svg` of 24 by 24 units with one `path`. A script read the object with a regular expression and counted entries, names and distinct drawings.
- To find which names are drawn, the script read every call of `icon(...)` and of every helper that passes a name on to it (`emptyHtml`, the menu item function, the call control button function, the palette `add` function), including calls whose argument is a condition such as `c.priv?'lock':'hash'`, and every `[key, icon, label]` row that is drawn later (the navigation rows, the More sheet rows, the add-a-tab rows). Names that are only passed through as a parameter were followed to the place that writes them. Every name found is defined, and no call was left unresolved.
- Result: 78 entries, 75 names, 74 distinct drawings, 68 names drawn, 7 never drawn. After Table B, 48 remain.
- A second pass read the CSS: the prototype gives the `ic` class sizes of 12, 13, 14, 15, 16, 17, 20, 26 and 30 pixels in different places, and a stroke width of 2.2 for the active bottom tab; every other icon is 18 pixels with stroke width 1.75.

### Table A. The 48 icons
`Drawn by` names the prototype functions that draw the icon, so that the place can be found. The path is the `d` attribute, copied from the prototype.

| # | Name | Component | Drawn by (prototype function) | Path data (`d`) |
| :-- | :-- | :-- | :-- | :-- |
| 1 | `approve` | `ApproveIcon` | `attHtml`, `menuHtml` | `M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4L12 14l-3-3` |
| 2 | `at` | `AtIcon` | `composerHtml` | `M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94` |
| 3 | `bell` | `BellIcon` | `SECTIONS`, `activityHtml`, `laterHtml`, `menuHtml`, `navHtml` | `M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0` |
| 4 | `bell-off` | `BellOffIcon` | `menuHtml`, `navHtml`, `paletteItems`, `stripsHtml` | `M6 8a6 6 0 0 1 9-5.2M18 8c0 4 1 6 2 7.5M3 17h13M10.3 21a1.94 1.94 0 0 0 3.4 0M2 2l20 20` |
| 5 | `bold` | `BoldIcon` | `composerHtml` | `M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z` |
| 6 | `bolt` | `BoltIcon` | `menuHtml`, `navHtml`, `paletteItems`, `stripsHtml` | `M13 2L3 14h9l-1 8 10-12h-9z` |
| 7 | `bookmark` | `BookmarkIcon` | `SECTIONS`, `laterHtml`, `modalHtml`, `msgHtml` | `M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z` |
| 8 | `check` | `CheckIcon` | `activityHtml`, `attHtml`, `catchAllHtml`, `catchupHtml`, `guideHtml`, `laterHtml`, `meetHtml` | `M20 6L9 17l-5-5` |
| 9 | `clock` | `ClockIcon` | `activityHtml`, `composerHtml`, `laterHtml`, `menuHtml`, `msgHtml`, `peopleHtml`, `profileHtml` | `M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2` |
| 10 | `code` | `CodeIcon` | `composerHtml` | `M16 18l6-6-6-6M8 6l-6 6 6 6` |
| 11 | `copy` | `CopyIcon` | `calSubHtml`, `chatHtml`, `detailsHtml`, `menuHtml` | `M9 9h11a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1` |
| 12 | `down` | `DownIcon` | `composerHtml`, `convsHtml`, `taskPanelHtml`, `tasksHtml` | `M6 9l6 6 6-6` |
| 13 | `edit` | `EditIcon` | `autoRow`, `convsHtml`, `mailHtml`, `menuHtml` | `M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z` |
| 14 | `external` | `ExternalIcon` | `attHtml`, `chatHtml` | `M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3` |
| 15 | `file` | `FileIcon` | `attHtml`, `composerHtml`, `fileRow`, `filesHtml`, `modalHtml` | `M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h6` |
| 16 | `folder` | `FolderIcon` | `SECTIONS`, `chatHtml`, `filesHtml`, `guestHtml`, `menuHtml`, `modalHtml` | `M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z` |
| 17 | `globe` | `GlobeIcon` | `chromeHtml`, `profileHtml` | `M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z` |
| 18 | `grid` | `GridIcon` | `filesHtml` | `M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z` |
| 19 | `hash` | `HashIcon` | `adminHtml`, `chatHtml`, `convGlyph`, `convRow`, `convsHtml`, `detailsHtml`, `mailHtml`, `meetHtml`, `menuHtml`, `modalHtml`, `paletteItems` | `M4 9h16M4 15h16M10 3L8 21M16 3l-2 18` |
| 20 | `home` | `HomeIcon` | `SECTIONS`, `chatHtml`, `ctrlsHtml`, `msgsHtml`, `navHtml`, `paletteItems`, `profileHtml` | `M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z` |
| 21 | `image` | `ImageIcon` | `fileRow`, `filesHtml` | `M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21` |
| 22 | `italic` | `ItalicIcon` | `composerHtml` | `M19 4h-9M14 20H5M15 4L9 20` |
| 23 | `left` | `LeftIcon` | `chatHtml`, `chromeHtml`, `guestHtml`, `mailHtml`, `sideHead` | `M15 18l-6-6 6-6` |
| 24 | `link` | `LinkIcon` | `calendarHtml`, `chatHtml`, `fileRow`, `filesHtml`, `menuHtml`, `modalHtml`, `paletteItems` | `M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71` |
| 25 | `list` | `ListIcon` | `filesHtml` | `M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01` |
| 26 | `lock` | `LockIcon` | `adminHtml`, `chatHtml`, `chromeHtml`, `convGlyph`, `convRow`, `detailsHtml`, `guestHtml`, `inviteHtml`, `menuHtml`, `modalHtml`, `paletteItems` | `M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM7 11V7a5 5 0 0 1 10 0v4` |
| 27 | `menu` | `MenuIcon` | `navHtml` | `M3 12h18M3 6h18M3 18h18` |
| 28 | `mic` | `MicIcon` | `ctrlsHtml`, `menuHtml`, `miniHtml`, `modalHtml` | `M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8` |
| 29 | `moon` | `MoonIcon` | `paletteItems` | `M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z` |
| 30 | `more` | `MoreIcon` | `msgHtml` | `M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z` |
| 31 | `paperclip` | `PaperclipIcon` | `composerHtml` | `M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48` |
| 32 | `pause` | `PauseIcon` | `attHtml` | `M6 4h4v16H6zM14 4h4v16h-4z` |
| 33 | `pin` | `PinIcon` | `chatHtml`, `menuHtml`, `msgHtml` | `M12 17v5M9 3h6l-1 7 3 3v2H7v-2l3-3z` |
| 34 | `play` | `PlayIcon` | `attHtml`, `autoRow` | `M5 3l14 9-14 9z` |
| 35 | `plus` | `PlusIcon` | `autoGalleryHtml`, `calendarHtml`, `chatHtml`, `composerHtml`, `convsHtml` | `M12 5v14M5 12h14` |
| 36 | `poll` | `PollIcon` | `attHtml`, `menuHtml` | `M18 20V10M12 20V4M6 20v-6` |
| 37 | `reply` | `ReplyIcon` | `mailHtml`, `msgHtml` | `M9 17l-5-5 5-5M20 18v-2a4 4 0 0 0-4-4H4` |
| 38 | `search` | `SearchIcon` | `chatHtml`, `convsHtml`, `filesHtml`, `msgsHtml`, `navHtml`, `paletteHtml`, `peopleHtml` | `M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35` |
| 39 | `send` | `SendIcon` | `composerHtml`, `mailHtml`, `modalHtml` | `M22 2L11 13M22 2l-7 20-4-9-9-4z` |
| 40 | `settings` | `SettingsIcon` | `SECTIONS`, `menuHtml`, `modalHtml` | `M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6` |
| 41 | `shield` | `ShieldIcon` | `SECTIONS`, `modalHtml` | `M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z` |
| 42 | `smile` | `SmileIcon` | `composerHtml`, `ctrlsHtml`, `menuHtml`, `msgHtml`, `paletteItems` | `M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01` |
| 43 | `star` | `StarIcon` | `chatHtml` | `M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z` |
| 44 | `trash` | `TrashIcon` | `menuHtml` | `M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6` |
| 45 | `user` | `UserIcon` | `paletteItems` | `M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z` |
| 46 | `users` | `UsersIcon` | `SECTIONS`, `chatHtml`, `convRow`, `ctrlsHtml`, `modalHtml`, `paletteItems`, `peopleHtml` | `M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75` |
| 47 | `wifi-off` | `WifiOffIcon` | `convsHtml`, `paletteItems`, `protoHtml`, `stripsHtml` | `M2 2l20 20M8.5 16.4a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5.2-2.8M19 12.9a10 10 0 0 0-2.2-1.6M12 20h.01M1.4 9a15 15 0 0 1 4.3-2.6M10.7 5.1A15 15 0 0 1 22.6 9` |
| 48 | `x` | `XIcon` | `attHtml`, `callHtml`, `chatHtml`, `composerHtml`, `guideHtml`, `menuHtml`, `mhd`, `sideHead` | `M18 6L6 18M6 6l12 12` |

### Table B. Drawn by the prototype but left out (20 names)
A name is left out only when every function that draws it belongs to a feature that decisions.md puts outside phase 1, or to demo tooling that never ships. Where one place is in phase 1, the icon is kept.

| Name | Drawn by (prototype function) | Feature | Decision |
| :-- | :-- | :-- | :-- |
| `archive` | `adminHtml`, `mailHtml` | Mail; the analytics CSV download | D-007, D-183 |
| `calendar` | `SECTIONS`, `attHtml`, `meetHtml`, `modalHtml`, `paletteItems`, `schedFormHtml`, `tasksHtml` | Calendar, Meet and Tasks | D-002, D-006 |
| `captions` | `ctrlsHtml` | Meet | D-006 |
| `drag` | `tasksHtml` | Tasks | D-002 |
| `hand` | `ctrlsHtml`, `tileHtml` | Meet | D-006 |
| `inbox` | `mailHtml` | Mail | D-007 |
| `info` | `guestHtml`, `protoHtml` | The prototype note on the guest sign-in; the Guide button | D-152, D-145 |
| `layout` | `callHtml` | Meet | D-006 |
| `leave` | `ctrlsHtml` | Meet | D-006 |
| `mail` | `SECTIONS`, `attHtml`, `mailHtml`, `navHtml` | Mail | D-007 |
| `mic-off` | `callHtml`, `ctrlsHtml`, `miniHtml`, `tileHtml` | Meet | D-006 |
| `monitor` | `aiNote`, `chromeHtml` | AI summaries; the simulated desktop window | D-053, D-003, D-145 |
| `refresh` | `calSubHtml`, `chromeHtml` | The Calendar feed link; the simulated browser bar | D-002, D-145 |
| `right` | `autoGalleryHtml`, `chromeHtml` | The automation gallery; the simulated browser bar | D-090, D-145 |
| `screen` | `ctrlsHtml`, `stageHtml` | Meet | D-006 |
| `sparkles` | `activityHtml`, `catchAllHtml`, `catchupHtml`, `msgsHtml`, `paletteItems`, `threadHtml`, `threadSumHtml` | AI summaries | D-008, D-053 |
| `tasks` | `SECTIONS`, `chatHtml`, `menuHtml`, `modalHtml`, `msgHtml` | Tasks | D-002 |
| `user-plus` | `autoGalleryHtml`, `chatHtml`, `detailsHtml`, `inviteHtml`, `paletteItems` | Guest invitations; automations; "View as guest" | D-152, D-090, D-145 |
| `video` | `SECTIONS`, `attHtml`, `chatHtml`, `ctrlsHtml`, `evRow`, `guestHtml`, `meetHtml`, `navHtml`, `paletteItems`, `profileHtml` | Meet | D-006 |
| `zap` | `adminHtml`, `autoGalleryHtml`, `detailsHtml`, `paletteItems` | Automations | D-090 |

Reasons, by decision:
- D-002 lists the groups of the first release: core chat, Activity, Later, Files, People, Preferences, command palette. Calendar, Tasks, Mail, Meet and the automations are not among them.
- D-006: video calling (Meet) is its own later phase. D-007: Mail is a later phase. D-008 and D-053: AI summaries exist nowhere in phase 1 (`sparkles`, `monitor`).
- D-090: a Member creating automations is phase 5; D-152: Guest is phase 5, so the guest invitation and "View as guest" (`user-plus`) are out. D-183: the analytics section is phase 5, so the CSV download (`archive`) is out.
- D-145: the Look / Device / Clock / Guide bar and every demo control never ship, which covers the Guide button (`info`) and the Device switch's browser and desktop frames (`refresh`, `right`, `monitor`). The prototype also has a note on the guest sign-in that says no email is sent; it is demo text.
- `calendar`, `tasks`, `drag`, `video`, `mail` also appear in the prototype's navigation and More sheet. Which navigation items phase 1 shows is for the app shell (TOKI-015); an icon that it needs is added by R10.

### Layout
```
packages/ui-web/
├─ package.json          adds react (peer and dev), react-dom, @types/react, vitest (dev); sideEffects: false; script: test
├─ tsconfig.json         adds jsx: react-jsx and the DOM library
└─ src/
   ├─ index.ts           export * from "./icons"
   └─ icons/
      ├─ paths.ts        iconPaths: the 48 names and their path data; IconName, iconNames
      ├─ icon-base.tsx   the svg of R4 and R5, one function
      ├─ icons.tsx       the 48 named components and Icon
      ├─ index.ts        re-exports
      └─ icons.test.tsx  the tests
```
- Decided in this spec: the path data sits in `paths.ts`, a file with no React in it, so that the phone app can move or share it in phase 3 without touching the components (concern 7).
- Decided in this spec: each named icon is made by one function, `createIcon(name)`, from the path of that name, and given a `displayName`; `Icon` looks the name up in a map. A person who only imports `BellIcon` still has the other 47 removed by the bundler, because the modules have no side effects (R11). The 48 paths total about 3,000 characters, so even a bundle that uses `Icon` everywhere stays small.
- Decided in this spec: the prototype's names are kept, even where the drawing does not match the word: `home` is a speech bubble, `approve` is a circle with a tick, `more` is three dots, `bolt` is the lightning bolt that `zap` also draws (only `bolt` is kept). Later tickets then match the prototype's code by name.
- Decided in this spec: the size is a prop, not a token. The prototype sets the size from the CSS of each place, so the component that draws the place passes `size` or sets it in its own CSS; `ic` is on the element so that carried-over prototype CSS such as `.ic{flex:none}` still applies.
- Decided in this spec: `React` is declared as a peer dependency and also as a dev dependency of `ui-web`, at the same version as `apps/web` (TOKI-006 pins it in the lockfile and leaves the number to the build). `react-dom` is a dev dependency for `renderToStaticMarkup` in the tests, which needs no DOM. Vitest is added to `ui-web` itself, pinned to one exact version, the same way TOKI-009 does for `tokens`; the root test run of TOKI-008 picks the test file up with no configuration change.
- `ui-web` already depends on nothing else; `platform` and `tokens` are not imported.

### Errors
- A name outside `IconName` -> a type error at `pnpm typecheck` (R2); not checked while running.
- An `aria-label`, `title`, `children` or `aria-hidden` passed to an icon -> a type error (R7).

## Testing
- Tests are written first and seen to fail on the empty package, then made to pass. They live in `packages/ui-web/src/icons/icons.test.tsx` and run with `pnpm --filter @toki/ui-web test`. They render with `renderToStaticMarkup`; no browser and no DOM global is used.
- R1, R2, R9, R10: the test holds the list of the 48 names as a literal and the list of the 27 left-out names. It checks that `iconNames` equals the 48 in order, that the exports of the icons module equal the 48 component names plus `Icon` and `iconNames` (so a stray or missing export fails), and that none of the 27 appears.
- R3: for each of the 48 names, the markup of `<Icon name=... />` equals the markup of the named component.
- R4: for each of the 48, the markup is parsed and one `svg` with exactly the ten attributes of R4 and one `path` with a `d` is found. The value of `d` is checked against `iconPaths`, and three paths (`bell`, `x`, `wifi-off`) are also written out in the test as literals from Table A.
- R5: renders with `size={14}`, `strokeWidth={2.2}`, `className="active"` and `data-testid`; the markup shows `width="14" height="14"`, `stroke-width="2.2"`, `class="ic active"` and the test id.
- R6, R14: a test reads the source files under `src/icons` and fails on `#`, `rgb(`, `hsl(` or `@toki/tokens`; `grep` for `@toki/ui-web` in `apps/web` finds nothing.
- R7: the markup always has `aria-hidden="true"`; lines marked `// @ts-expect-error` pass `aria-label`, `title`, `children` and `aria-hidden={false}`; `pnpm typecheck` fails if any of them is accepted (an unused `@ts-expect-error` is itself an error).
- R8: checked once by script when the work is built, and the result recorded in the PR: the script reads the prototype's `ICONS` object and `paths.ts`, and compares every name. It is not part of the test run, because the prototype file is not part of this package. After that, the three literal paths of R4 and the fixed list of R1 guard against edits.
- R11: a test reads `package.json` and checks `sideEffects` is `false` and `exports` is the single entry of TOKI-001; a second check lists the top-level statements of `icons.tsx` by reading the file for anything other than imports, the factory and the exports.
- R12, R13: `pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm lint:boundaries` and `pnpm format:check` run on the finished branch and exit 0.
- The look of the icons next to the prototype is compared by eye on the component preview page (TOKI-016), in Calm and Focus. This work shows nothing on a page.
- No data, names or addresses are used.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Blueprint work area: Design system | The change is the icon part of `ui-web`; Scope and Layout |
| Belongs to intent I02 design-system | The drawings, attributes and names of the prototype are kept (R4, R8), so components built on them can match it |
| Milestone: M1 | Planning fact; no design impact |
| Size: S, about half a working session with Claude | One small package change: 48 entries in a table, one factory, one test file; no component CSS, no preview page |
| Needs: TOKI-006 (Web app skeleton) | Uses the React version that TOKI-006 pins for `apps/web` (Design). This work does not touch `apps/web` (R14). TOKI-006 and TOKI-009 name icons as out of their scope; this work covers them |
| Agreed scope: "roughly 60 icons as components" | 48 components (R1), after the counts and the 27 left-out names in Scope; concern 1 |
| The drawings come from the prototype; none is invented | R4, R8; the list in Table A is taken from the prototype's own table by script |
| Every icon-only button has a name (D-075, NFR-03) | The icon is hidden from screen readers and cannot be named (R7), so the button's own name is the only name. IconButton and the lint rule are TOKI-012 |
| Components live in `ui-web`; `ui-native` in phase 3 | Layout: all code in `packages/ui-web`; the path data is kept apart (concern 7) |
| Components reach platform features only through `platform`; lint bans direct use of the notification, storage, service worker and audio APIs in `ui-web` | An icon calls no platform API; R13 |
| Only the features of phase 1 are built; demo-only controls never ship (D-002, D-145) | Table B and its reasons; the 20 names are left out (R9) |
| Every text goes through i18n; English default | An icon has no text and no `title` (R7); nothing to translate |
| M1 exit check: the preview page matches the prototype in Calm and Focus | The size, stroke and colour behaviour of the prototype is reproduced (R4, R5, R6); the comparison is on the preview page (TOKI-016) |

## Open questions from the intent
- How many icons are there really, and which of them does phase 1 use? Answered: 75 names defined, 68 drawn, 48 used in phase 1 (Scope, Table A, Table B). See concern 1.
- Which prototype icons belong to features that are not in phase 1? Answered: the 20 of Table B, with decisions. Five kept icons serve only features whose phase the log does not state. See concerns 2 and 3.
- How does an icon get its size and colour, given that the prototype sets sizes from the CSS of each place? Answered: colour from `currentColor` (R6), default size 18 and a `size` prop (R5). See concern 5.
- Do the prototype's icon drawings come from an open-source set with a licence? Not answered. Carried forward as concern 9.

## Areas of concern
1. The plan says "roughly 60 icons". The prototype defines 75 names and draws 68; this spec keeps 48. Decided in this spec: the number follows the prototype and decisions.md, not the plan. The plan line should say 48. Owner: Thanh Truong.
2. Table B is left out on the evidence of decisions.md, but three of its reasons are by omission: Calendar and Tasks are not in the first-release list of D-002, and no decision states which tabs the phone's bottom bar has in phase 1 (the prototype shows Meet and Mail there). The guest invitation drawing (`user-plus`) may also be wanted by the phase 1 Admin invitation form, which the prototype does not draw. If a phase 1 screen needs a left-out icon, the ticket that builds it adds it by R10, from the prototype's drawing, which stays available for all 27 names. Owner: Thanh Truong.
3. Five kept icons are drawn only by polls, voice clips, approval requests and Meet: `approve`, `poll`, `pause`, `play`, `mic`. The Blueprint's scope table lists polls, voice clips and approval requests as later phases, but decisions.md does not state their phase and the rule here is to leave a name out only on a decision. They are kept; removing them is a one-line change per icon if the product owner decides those features are out. Owner: Thanh Truong.
4. The prototype's names are kept even where they mislead (for example `home` is a speech bubble). Decided in this spec, for matching the prototype's code. Owner: Thanh Truong.
5. Sizes of 12 to 30 pixels and a stroke of 2.2 on the active bottom tab come from the prototype's CSS. Decided in this spec: the icon has a default of 18 and a stroke of 1.75, and the component that draws the place sets the rest. Owner: Thanh Truong.
6. React, `react-dom`, `@types/react` and Vitest versions are not in the Blueprint. Decided in this spec: React is the version of `apps/web`; the others are the stable releases in use when this is built, pinned exactly. Owner: Thanh Truong.
7. The phone app (phase 3) cannot use React DOM components, so `ui-native` will draw the same paths with its own components. Where the path data then lives (stay in `ui-web`, or move to `shared` or `tokens`) is not decided. This spec keeps the data in its own file so either move is small. Not decided. Owner: Thanh Truong.
8. The plan does not list TOKI-011 in the Needs column of TOKI-012 or any other ticket, though IconButton, menus and empty states use icons. This does not block the work, but the plan should say who needs it. Owner: Thanh Truong.
9. The Blueprint does not say where the drawings come from. Their style (24 by 24 units, round line ends, a stroke of about 2) resembles common open-source line icon sets, but the prototype names no source and no licence, and this spec cannot tell whether one applies. If one does, it may need a notice in the repository. Not answered. Owner: Thanh Truong.
10. The copy of each path is checked once against the prototype by script (R8); later changes to the prototype are not followed. Accepted: the prototype is the reference only until the preview page (TOKI-016) is accepted. Owner: Thanh Truong.
