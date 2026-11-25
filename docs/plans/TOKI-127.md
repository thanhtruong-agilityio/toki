# TOKI-127 QA of the AppShell in three layouts - implementation plan

**Goal:** TOKI-015 (the `AppShell` of `ui-web` in Calm, Focus and the narrow layout, the section list and the layout route of `apps/web`, the utilities and the look function) gets a QA record at the merge commit of the pull request that delivered it, with the results whatever they are.

**Spec:** `docs/specs/2026-11-25-app-shell-qa-design.md` (R1 to R10). Tier M. Branch `docs/toki-127-app-shell-qa`. Documents and one bash script; no existing file changes except `docs/traceability.md` (regenerated). `Version:` is `2c3330ef` (PR #157), decided in concern 1. Concern 2 decided: a temporary worktree of `2c3330ef` with `pnpm install` run in it, the unit tests, the Vite dev server of that worktree on a free loopback port and the Chromium that Playwright has cached. Concern 3 decided: the measurements are command rows driven by Playwright against the fixture page of the ticket (`shell-fixture.html`); the rows that run the ticket's own `e2e/app-shell.spec.ts` or `pnpm test:e2e` need ports 5173 and 3000 free and are `Blocked` otherwise; the by-eye comparison with the prototype and the screen reader pass are `manual` rows. Concern 5 decided: a requirement that names an old path (`src/shell`, tests beside the sources, `src/shell-fixture`) whose code now lives at the new path is `Fail`; the row still compares the behavior at the path found at `2c3330ef` and prints the files found at both paths.

## Design

Same shape as the earlier QA tickets, with every lesson built in: each part of a sentence of a requirement is a printed number; a row names one requirement; every check that must fail is paired with a run that must pass (a changed file of the temporary worktree, restored with `git checkout`, or a changed copy of the text held in memory for rows that only read files); a row prints `Blocked` and never a pass when it cannot be shown; one `BASE` folder made in the current shell holds every temporary file (exported as `TMPDIR` and given to every child through `env -i`); the last line shows no worktree of the script, no process and no folder left and the repository unchanged; `grep -q` is not used under `pipefail`; empty arrays are expanded with `${a[@]+"${a[@]}"}`; `perl -0pi` replaces `sed -i ''`.

- **One temporary worktree of `2c3330ef`**, `corepack pnpm install --frozen-lockfile` under Node 22 (the default Node 24 is refused by the repository). The probes (two Vitest files, one for `ui-web` and one for `apps/web`, that render the components and the layout route and write their values to a file), the type files (`.tsx` cases that `tsc` must accept and cases it must refuse), the driver and the Vite process are written, used and deleted; nothing is added to the repository, no `.env` is read or created.
- **The CSS rows** parse the tables C to I out of the spec at `2c3330ef` and `shell.css`, `utilities.css` and `app.css` with one small reader and compare the sets of (media, selector, declaration); each is paired with a changed copy.
- **The browser rows** run the dev server of the worktree on a free port (`vite --port`, so 5173 is not used), open the fixture with the cached Chromium in both looks at the widths of the spec and read rectangles and computed styles. The toasts rows use a paused clock, as the ticket's own test does. Each group is paired with a mutated run (a width in `shell.css`, the overlay media condition, every `visibility:hidden`, the registration of the bar, the anchor margin, the `.secbody` flex, the font size, the focus move).
- **The ticket's own browser test** runs once with the JSON reporter (`pnpm test:e2e`) when ports 5173 and 3000 are free; a second run with one table value changed must fail.
- **The manual rows** (by eye against the prototype; screen reader and keyboard) print `Blocked`. `V=<commit> bash docs/qa/TOKI-015.checks.sh serve` starts the fixture for them and stops on the Enter key.
- Output is counts, exit codes and words. No tool output and no secret.
- Rows are drafted by Claude and approved by the QA before any row is run. Debug runs of the script are not evidence.

### Rows (ids follow the requirement numbers; a requirement with several behaviors is split with a letter)

| ID | TOKI-015 | Output compared with Expected |
| :-- | :-- | :-- |
| T1A to T1D | R1 | the 12 runtime names and the types are exported; the export lines and the folder of the spec (`src/shell`); the `./utilities.css` export; the TOKI-012 test that no component export ends in `Icon` |
| T2A, T2B | R2 | no import of `@toki/i18n`, `@toki/platform`, `@toki/client-core` in the sources and the folder of the spec; each component with empty text props renders no text |
| T3A to T3C | R3 | the order and roles with and without `list` and `panel`; the attributes, labels and `data-testid`; `panel` without `panelLabel` is a type error |
| T4A, T4B | R4 | `derivePane` over its 16 inputs; the four attributes of the root |
| T5A to T5F | R5 | one `a.ni` for each section in order with the current one, `data-id`, `data-calm-hidden`; the badge variant; the plain click and the four modifiers, the middle click and no handler; Enter on a link; `calmHidden` in the browser; the icon name type |
| T6A to T6D | R6 | the bar draws the `tab` sections and the More button only with `moreTab`; its attributes, press and `ref`; no number unless given; the five tabs in the browser |
| T7A | R7 | a badge for 1 and 100, none for 0, -1, `NaN`, missing |
| T8A to T8E | R8 | `WorkspaceHeader`, `SearchBox`, `UserCard`, `triggerProps` with its `ref`, `onClick` and `onKeyDown`; the avatar width in the browser |
| T9A | R9 | no `role="dialog"` before and after the More press |
| T10A | R10 | the rows of the section list at the spec's path and at the found path; ids and paths of the Blueprint |
| T11A to T11C | R11 | the markup of `SidePanel` and both buttons; Escape with and without a layer that took it; the visible button at 719 and 720 |
| T12A, T13A, T13B | R12, R13 | `SectionPage`; `TabList` and `Tab` markup and roving tab stop; `aria-label` is required |
| T14A, T14B | R14 | arrows, Home, End, wrap, Enter, Space and other keys; `scrollIntoView` |
| T15A, T15B | R15 | the flex-column declarations of Table C; the `EmptyState` centred in `.main`, `.secbody` and `.sb` at 360, 720 and 1100 |
| T16A, T16B | R16 | tables C to G against `shell.css`; the four media conditions, no `@container`, no `!important` |
| T17A to T17D | R17 | names, colour literals, look selectors, hover rules and font families |
| T18A to T18G, T18M | R18 | Calm and Focus at 1100 and 720, narrow at 719 and 360, Focus in Activity, the header, the card; the by-eye comparison (manual) |
| T19A to T19C | R19 | the overlay panel at 720, 800 and 1099, the column from 1100, the full-screen panel |
| T20A to T20C | R20 | the heights 560, 480 and 420 in Calm with six, eight and five sections and in Focus: the numbers of Table J |
| T21A to T21D | R21 | 360 by 560: no horizontal scroll, panes inside, controls of at least 40 px, five tabs of at least 64 px |
| T22A to T22C | R22 | which pane is visible, the bar moved out, 40 presses of Tab, the transitions |
| T23A to T23E, T24A, T25A to T25C | R23 to R25 | the toasts at seven widths in both looks; the registrations; `--tabh`; a registered composer; `overflow:hidden` of `.main` and `.side` |
| T26A, T26B | R26 | `utilities.css` against Table H; its import order |
| T27A to T27D | R27 | `app.css` against Table I; the import order; the viewport meta; the body size at 719 and 720 |
| T28A to T28D | R28 | `applyAppearance` for each look, the device change, the stop function, accent and density; the call in `main.tsx` |
| T29A to T29D, T29M | R29 | `useNarrow`; focus follows the pane (jsdom and the browser); the screen reader pass (manual) |
| T30A to T30D | R30 | the layout route, no file-based routing, the section list, the wiring |
| T31A to T31C, T31E | R31 | the `nav` keys in `en` and `vi`; `pnpm --filter @toki/i18n check`; the landmark names; `useTranslation` |
| T32A to T32G | R32 | the fixture is served and not built; the build input check; the paths; the fonts link; the entry; the query parameters and data |
| T33A to T33C | R33 | the spec file lists the checks; it passes; a changed table value makes it fail |
| T34A to T34C | R34 | `ref`, `className`, owned attributes; no `ref` on `SidePanel` and `BottomTabs` |
| T35A to T35I | R35 | typecheck, `lint:boundaries`, lint, `format:check`, the ui-web tests, the build, banned APIs, the size, the whole `test:e2e` |
| T36A to T36D | R36 | `visibleSections` for Member, Admin, none; the session binding; the layout route with a role; the fixture's `?role=member` |

## AC -> step -> test

| Req | Step | Test |
| :---- | :---- | :---- |
| R3, R5 | 1. Write `docs/qa/TOKI-015.checks.sh` | run on a mutated copy for each key row (a width, the overlay condition, `visibility:hidden`, a registration, a source line): the matching rows change; run twice: identical lines |
| R1, R2 | 2. Draft `docs/qa/TOKI-015.md` (unapproved, unrun) | `qa-ready.sh TOKI-015` reports only `has not been run` lines |
| R4, R6 | 3. The QA approves the rows; I run them in groups and the QA runs the two manual rows | results and evidence in the record |
| R7, R8 | 4. Result notes (what changed since `2c3330ef`), `trace.sh` | the TOKI-015 row of the table |
| R9, R10 | 5. Checks | `git diff` shows added files and `traceability.md` only; the repository is unchanged by the script; no process, worktree or folder left; no write to GitHub |

## What can break (riskiest first)

1. A row that passes without measuring: every check that must fail is paired with a run that must pass and the numbers are printed.
2. Ports: the ticket's own browser test needs 5173 and 3000; a development server on either makes those rows `Blocked` with the port named. The script never stops a process it did not start.
3. Requirements that name old paths or things the later work changed: `src/shell`, `src/shell-fixture`, `apps/web/src/shell/sections.ts`, `pnpm lint:boundaries` (TOKI-002 concern 13), the fonts link of the fixture (TOKI-010 not on `main` at the Version), the session binding of `AppShellRoute` (TOKI-023); each row shows what is found and the result notes say so.
4. Spec statements that disagree with each other: R25 says `.main` and `.side` clip with `overflow:hidden`, Table F gives the Focus `.side` none; R16 says `shell.css` holds exactly Tables C to G and the file holds one more declaration (`.srch` `flex:none`). The rows follow the spec as written; the result notes say what they show.
5. The browser rows depend on a cached Chromium and a free local port; without them the rows are `Blocked` with the first error line.
