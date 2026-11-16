# AppShell in three layouts design

Date: 2026-11-16 · Status: draft for review
Intent: docs/intents/app-shell.md (Thanh Truong)
Ticket: TOKI-015

## Goal
The builder (Thanh and Claude) needs the frame that every phase 1 screen sits in, before the conversation list, the chat and the section screens are built. The prototype draws the frame with one grid and two sets of rules, and in three places it breaks what the decision log now requires (D-068, D-078): a side panel squeezes the chat to 84 px at 800 px, the conversation list or the navigation is cut off in a window 560 px high, and on a narrow screen the toasts sit at the top of the window.
After this change `ui-web` exports an `AppShell` that draws Calm, Focus and the narrow layout with bottom tabs, with the side panel overlaying the chat from 720 to 1099 px, a navigation that scrolls, a conversation list that stays the main area of the sidebar, and toasts that stay above the bottom bar and the composer. `apps/web` mounts it for every signed-in route. The pieces the screens inside it share (tab row, section page, side panel, utility classes, narrow text size, look attributes) are built here once.

## Scope
- In:
  - `packages/ui-web/src/shell/`: `AppShell`, its navigation (sidebar items, Focus rail, `BottomTabs` with its More tab), `WorkspaceHeader`, `SearchBox`, `UserCard`, `SidePanel`, `SectionPage`, `TabList` and `Tab`, `derivePane`, `useNarrow`. One CSS file with the shell's rules, carried over from the prototype where the prototype is right and changed where it is not (Tables C to H).
  - `packages/ui-web/src/styles/utilities.css`: the prototype's utility classes (Table H). `packages/ui-web/src/appearance.ts`: `applyAppearance`, which sets `data-eff`, `data-accent` and `data-density` on the page.
  - `apps/web`: a layout route that mounts the shell for every route except `/login`, the list of sections, `src/app.css` (`#root` and the narrow body text size), the viewport meta, the call of `applyAppearance`, and four navigation keys in both catalogs of `packages/i18n`.
  - The toast places: the shell mounts `ToastProvider` (TOKI-013), registers the main area as the anchor and the bottom tabs as an obstacle, and states the rule for a composer (R24, R25).
  - A development-only fixture page for the shell and one Playwright test file that measures the three layouts (R32, R33), with the by-eye comparison recorded in the pull request.
- Shared with TOKI-012 and TOKI-013. Their specs hand this ticket the pieces below, and this spec takes each one:

| Handed over by | Piece | Where it is built here |
| :---- | :---- | :---- |
| TOKI-012 (second ownership table) | the tab row, `.tabs` and `.tab`, with its 40 px narrow rule | `TabList`, `Tab`, Table C, R13, R14 |
| TOKI-012 (Scope, Out) | the 15 px body text of narrow screens, which the prototype never applies (Design, "What the prototype does, measured") | `app.css`, Table I, R27 |
| TOKI-012 (Tag and Badge) | the position of a badge on a navigation item and on a tab (`.ni .cnt`, `.nt .cnt`, and the Focus variants) | Tables D, E, G |
| TOKI-012 (Scope, Out) | `#root`, `--tabh`, the app shell layout | Table I, Table G, R24 |
| TOKI-012 (Scope, Out) | the utility classes, "TOKI-015 is expected to be first" | `utilities.css`, Table H, R26 |
| TOKI-012 (third table) | the search box `.srch` | `SearchBox`, Tables D, E |
| TOKI-012 (concern 8) | whether "narrow" is the window or a container | the window (R16, concern 3) |
| TOKI-013 (Design, Toast) | mounting `ToastProvider`, `useToastAnchor` on the main area, `useToastAvoid` on the bottom tabs, the anchor while a panel overlays the chat | R23 |
| TOKI-013 (concern 8) | pane bodies that hold an empty state are flex columns with a height and `min-height:0` | R15 |
| TOKI-013 (concern 8) | the rule for a composer that registers with `useToastAvoid` (TOKI-043) | R25 |
| TOKI-013 (Design, EmptyState) | the content area that centres an empty state (D-074) | R15 |

- Draw the line with the neighbours once (the first two were written at the same time as this spec):
  - TOKI-014 (Overlays: Menu, Modal, Sheet). Its spec lists what the layer gives the shell ("What the layer gives the AppShell"); this spec agrees with each point. The shell mounts no overlay and draws no scrim: every layer portals itself into `document.body`. The shell's own layers stay at or under `z-index:6` (Table G), the dialogs' scrim takes 20, a menu 30 and the toasts keep the 40 of TOKI-013 R21. The shell sets no `inert` and no `aria-hidden` and never relies on the body for scrolling. Escape is asked of the layers first (they stop the event), and closes the side panel only when no layer took it (R11). The account card and the More tab are opening buttons of a menu and of a sheet; the layers return focus to them. The More sheet itself is TOKI-092 (plan line: Search, People, Preferences, Admin and the account section), built with the `Sheet` of TOKI-014; the shell draws the More tab (R6).
  - TOKI-016 (Component preview page). The page draws components beside the shell, not inside it. This ticket does not add the shell to `componentExamples`: the shell fills the window, so it cannot be one figure of a page. The layouts of the shell are compared with the prototype through the fixture page of this ticket (R32). The page needs one thing from the shell: `applyAppearance` (R28), which it may call instead of keeping its own copy.
  - TOKI-043 (Composer), TOKI-045 (Threads), TOKI-035 (header and Details), TOKI-057 (profile panel): they fill the panes. What the shell gives them, and what they give the shell, is in R15, R17 and R25.
- Out (not now), each with its owner:
  - The conversation list, its search field and chips, the Browse channels button and the Direct messages '+': TOKI-033 and TOKI-034. The shell only gives the list a column and a minimum height (R20).
  - The conversation header (the Back button of a narrow screen, the star, the topic, the members button), the Details panel and the notification level: TOKI-035. The message list, which must be a flex column too (R15): TOKI-041. The composer: TOKI-043. The thread panel: TOKI-045. The profile panel: TOKI-057.
  - The More sheet (Search, People, Preferences, Admin and the account section): TOKI-092, which needs the shell and the palette. The account menu and Sign out, in the account card's menu and in the More sheet: TOKI-099. Set status: TOKI-056. Pause and Focus time, and the timer that the prototype draws in the account card (`.navclock`): TOKI-076. The shell draws the account card and the More tab and leaves the rest to them (R8, R6).
  - The strips (offline, Pause, Focus, update): TOKI-082, TOKI-076, TOKI-104 (`.strip`, TOKI-012 second table).
  - The numbers on the badges: TOKI-054. The shell shows a number it is given and hides it at zero (R7).
  - The head count under the workspace name, the workspace name itself and the account card's data (name, hue, presence, status or role): the shell takes them as props (R8). Reading them is TOKI-033 (head count, with the bootstrap store of TOKI-032) and TOKI-099 (the signed-in person). Until then the shell shows no head count and no card.
  - The command palette: TOKI-071. The search box calls the function it is given; with none, the box is not drawn (R8).
  - Activity, Later, Files, People, Admin and Preferences pages: their own tickets. Each adds one row to the section list and one route file (R30). The shell draws their frame (`SectionPage`).
  - Loading skeletons and the shared not-found page: TOKI-082. The not-found view of TOKI-006 stays outside the shell.
  - Saving look, accent and density to the account, and the Preferences controls: TOKI-078. This ticket applies the attributes and offers the function (R28).
  - Remembering the last look in the browser to remove the first-paint difference (tokens concern 10): not built; concern 10.
- Not in phase 1, so out of the shell, with the reason (the prototype draws each; D-002 lists what phase 1 has, and the Blueprint scope lists the later phases):

| Prototype piece | Where it is | Why it stays out |
| :---- | :---- | :---- |
| Navigation items Mail, Calendar, Meet, Tasks (`SECTIONS`, line 1199) | sidebar, rail | Mail phase 7 (D-007); Calendar and Meet phase 4 (D-006); Tasks phase 2 |
| Bottom tabs Meet and Mail (line 1204) | bottom bar | Journey F38, accepted in D-091, has Home, Activity, Later, Files, More. Later and Files move from the More sheet into the bar; the sheet's own rows are TOKI-092's |
| More sheet rows Calendar and Tasks (line 2155) | More sheet (TOKI-092) | same; TOKI-092 leaves them out |
| The demo bar (`.protobar`), the device switch, `.stage[data-device="phone"]`, the desktop title bar and address bar (`.chrome`, `--chromeh`) | around the frame | D-145: demo-only controls never ship. The desktop and phone apps are phase 3 |
| Guest layout (`.app[data-guest]`, lines 705-721, 763) | whole frame | Guest portal is phase 5 (D-152) |
| 'Add a tab' and the Notes, Tasks and link tabs (line 1296) | tab row | Custom tabs are phase 2. The tab row holds Messages, Files & links, Pinned (journey F10) |
| `.minibar` (the Meet bar, line 552) | above the composer | Meet is phase 4. It will register with `useToastAvoid` itself |
| The purple 'New' marks (`np()`) | headings, strips | D-146 |
| 'Owner' as the account card's fallback line (line 1210) | account card | There is no Owner role (D-152); the line is the screen's (R8) |
| The Claude summary panel (`aiOn`, line 1140) | side | D-066: summaries are desktop only and not in phase 1 |

## Requirements
In the checks below, "the fixture" is `http://localhost:5173/shell-fixture.html` served by `pnpm --filter ./apps/web dev` (R32), "the browser test" is `e2e/app-shell.spec.ts` run by `pnpm test:e2e` (Chromium, TOKI-008), and a "width" is the width of the browser window. A rectangle is `getBoundingClientRect()` of the element, taken relative to the shell root.

Structure and exports
- R1. `@toki/ui-web` exports, from `packages/ui-web/src/shell/` through one added line `export * from "./shell"` in `src/index.ts`: `AppShell`, `AppShellProps`, `NavSection`, `BottomTabs`, `WorkspaceHeader`, `SearchBox`, `UserCard`, `SidePanel`, `SectionPage`, `TabList`, `Tab`, `derivePane`, `PaneName` and `useNarrow`; and `applyAppearance` with its option types from `src/appearance.ts`. The package `exports` map gains `"./utilities.css": "./src/styles/utilities.css"`. The test of R1 of TOKI-012 (no other export ends in `Icon`) still passes. Check: a test lists the exports.
- R2. No source file under `packages/ui-web/src/shell` holds a visible text or an accessible name of its own, and none imports `@toki/i18n`, `@toki/platform` or `@toki/client-core`. Every text and every name comes in as a prop, already translated. Rendering each component with its text props empty gives no text in the DOM. Check: a test reads the sources for those imports; a test renders each component with empty strings and reads `textContent`.
- R3. `AppShell` renders, in this order inside one root `div.app`: a `div.sidebar` holding the `nav.nav` (R5 to R8), the `aside.convs` only when `list` is given and the `div.usercard` (R8); then the `main.main`, the `aside.side` only when `panel` is given, and one `div.toast-anchor` (R23). The `sidebar` has the attribute `data-has-list` when `list` is given. The `nav` has `aria-label` from `labels.mainNavigation`; the conversation `aside` has `aria-label` from `labels.conversations`; the side `aside` has `aria-label` from `panelLabel`. `panelLabel` is required when `panel` is given (type error otherwise). The root is a `div` with the class `app`, the attributes of R4 and `data-testid="shell"`. `children` is the content of `main`. Check: render with and without `list` and `panel` and read the DOM, the order and the roles (`navigation`, `complementary` twice, `main`).
- R4. `derivePane({ section, chatOpen, panelOpen, hasList })` returns `"side"` when `panelOpen`; else `"list"` when `section` is `"home"`, `chatOpen` is false and `hasList` is true; else `"main"`. `AppShell` sets on the root `data-section` (the current section id), `data-pane` (the result), `data-chat-open` (present, empty, when `chatOpen` is true) and `data-panel` (present, empty, when `panel` is given). Check: a table test of `derivePane` over its 16 inputs and a DOM test of the four attributes.

Navigation
- R5. `NavSection` is `{ id, icon, label, href, badge?, badgeLabel?, tab?, more?, calmHidden? }` (`tab` and `more` are booleans: shown in the bottom bar, and reached from the More sheet on a narrow screen) with `icon` an `IconName` of TOKI-011. `AppShell` takes `sections`, `currentSection` and an optional `onNavigate(section, event)`. The sidebar (Calm) and the rail (Focus) draw one `a.ni` for every section, in the order of the array, each holding the icon, a `span.lb` with the label and, when `badge` is above 0, a `Badge` of TOKI-012 (`variant="mute"` for the section `home`, default for the others; `label` from `badgeLabel`). The section equal to `currentSection` has `aria-current="page"`. A section with `calmHidden` gets the attribute `data-calm-hidden` and is hidden in Calm from 720 px (Table D). `data-id` is the section id. A plain left click calls `onNavigate` and cancels the browser's navigation; a click with Ctrl, Meta, Shift or Alt, a middle click and a click when `onNavigate` is missing are left to the browser. Check: DOM and click tests with `user-event`, including the four modifiers.
- R6. `BottomTabs` (the narrow bar, inside the same `nav` as `div.nav-tabs`) draws one `a.nt` for each section that has `tab: true`, in the order of the array, each with the icon, a `span` with the label and the badge as in R5. The sections that the bar shows are Home, Activity, Later and Files (journey F38). After them it draws one `button.nt` for More, only when `AppShell` is given `moreTab = { label, open, onOpen }`: the button shows the label and a `MenuIcon` (the icon the prototype gives More, line 1204), has `aria-haspopup="dialog"` and `aria-expanded` equal to `open`, calls `onOpen` on a press, and has `aria-current="page"` when the current section has `more: true`. The state of the sheet is the owner's (TOKI-092), so with no `moreTab` the bar has no More button: a build that has no sheet shows no dead tab. The More button carries no badge, and Files shows no number: F08 gives badges to Home, Activity and Later only, and the shell shows a number only when it is given. Check: DOM tests with the four phase 1 tab sections, with and without `moreTab`, and the press.
- R7. A badge is drawn only when its `badge` is a number above 0; a value of 0, a negative number, `NaN` or a missing value draws nothing. The number is shown as given (no cap, TOKI-012 concern 4). Check: a test with 0, -1, `NaN`, 1 and 100.
- R8. `WorkspaceHeader` draws, from `workspace = { name, detail? }`, a `span.wsl` with the first letter of `name` (first code point, upper-cased), a `span.wsn` with the name and, only when `detail` is given, a `span.wss` with it; with no `workspace` nothing is drawn. `SearchBox` is a `button.srch` named by `search.label` (`aria-label`), holding a `SearchIcon`, a `span.t` with the label and, only when `search.hint` is given, a `span.kbd` with it; it calls `search.onOpen` on a press, and with no `search` nothing is drawn. `UserCard` takes `account = { label, name, hue, presence?, presenceLabel?, detail?, onOpen? }` and is a `div.usercard` holding one `button.ucard` named by `account.label` (`aria-label`) with an `Avatar` of TOKI-013 (`name`, `hue`, `presence`, `presenceLabel`), a `div.uct` with `span.un` (the name) and `span.us` (`account.detail`, drawn only when given); with no `account` nothing is drawn. When `account.onOpen` is missing the card is a `div` with no button role and no focus stop. The `us` line is the status or the role, written by the screen that wires the card (TOKI-099). Check: DOM tests for each prop present and missing.
- R9. The shell holds no overlay and no sheet content (Scope): `AppShell` renders nothing for the More sheet, `moreTab` is the only part of it that the shell knows, and the shell calls `onOpen` and nothing else. The sections with `more: true` are the ones TOKI-092 puts in its sheet; the shell's `NavSection` list is the data it can read. Check: a test renders `AppShell` with `moreTab` and finds no element with `role="dialog"` before and after a press.
- R10. The set of sections that a build offers is the list in `apps/web/src/shell/sections.ts` (R30). A section is in that list only when its route exists. The list holds no row for a feature that is not in phase 1: a test fails when a row has an `id` outside `home`, `activity`, `later`, `files`, `people`, `preferences` and `admin`.

Pane frames
- R11. `SidePanel` renders, inside the `aside.side`, a `div.sh` with: a `button.ib.back-side` (an `IconButton` of TOKI-012, `icon="left"`, `label` from `labels.back`), an `h2.ell` with `title` and, when `subtitle` is given, a `span.muted` with it, and a `button.ib.sm.closex` (`IconButton`, `icon="x"`, `label` from `labels.close`); both buttons call `onClose`. Then a `div.sb` holding `children`. Which of the two buttons is visible depends on the width (Tables D and G): the back button under 720 px, the close button from 720 px; the hidden one is not in the Tab order (it is `display:none`). `SidePanel` also closes on Escape: it listens on `document` (bubble phase) while it is mounted and calls `onClose` for `Escape` when the event is not `defaultPrevented` and not `isComposing`, which gives the order of the prototype (lines 2565-2571): menus and dialogs first (TOKI-014 R9 stops the event), then the panel. A handler of another layer, such as a mention popup or an edit in place, must stop the event too to come first. Check: DOM test; a test that an Escape stopped by a stand-in layer does not close the panel and the next one does; the browser test reads which button is visible at 719 and 720.
- R12. `SectionPage` renders a `div.sechead` with an `h1.title` (the `title`) and, when `actions` is given, the node after it, then a `div.secbody` holding `children`. It sets no text. Check: DOM test.
- R13. `TabList` renders a `div.tabs` with `role="tablist"` and `aria-label` from its prop (required), holding `Tab`s. `Tab` renders a `button.tab` with `role="tab"`, `aria-selected`, `id` and, when `panelId` is given, `aria-controls`; the selected tab has the roving tab stop (`tabIndex` 0) and the others `-1`. `Tab` calls `onSelect` on a click. A `Tab` takes children (text, an icon, a count) and sets no text itself. Check: DOM test.
- R14. Keyboard in a `TabList`: ArrowRight and ArrowLeft move focus to the next and the previous `Tab`, wrapping at the ends, and select it (automatic activation); Home and End go to the first and the last; the other keys do nothing. After a selection the selected `Tab` is scrolled into view with `scrollIntoView({ inline: "nearest", block: "nearest" })` when the browser has it. Check: `user-event` keyboard test, and one test that `scrollIntoView` is called when the selected tab changes.
- R15. The pane bodies are flex columns with a height and `min-height:0`, so that an `EmptyState` (`flex:1`, TOKI-013 R17) centres in the free area (D-074). Table C gives `display:flex; flex-direction:column; min-height:0` to `.main`, `.secbody`, `.sb` and `.convs`, and `overflow-y:auto` to `.secbody` and `.sb`. The message list `.msgs` and the conversation list body `.clist` are written by TOKI-041 and TOKI-033 and follow the same rule (hand-off). Check: in the browser test an `EmptyState` is placed in `.secbody`, in `.sb` and in `.main` of the fixture; at 360, 720 and 1100 px, in both looks, the centre of its content (`.eic` and the text) is within 1 px of the centre of the parent, as TOKI-013 R17 says.

Style rules
- R16. `shell.css` holds exactly the selectors and declarations of Tables C to G (value for value, in any order, any white space), grouped in the media blocks that the tables name, and no other rule. The media conditions are exactly `(min-width: 720px)`, `(max-width: 719px)` and `(min-width: 720px) and (max-width: 1099px)`; there is no `@container` query and no `!important`. "Narrow" is the window under 720 px; a window of exactly 720 px is not narrow (D-068, Design, "What the prototype does, measured"). Check: a CSS test with `readCss` of TOKI-012 R27, with the tables typed in.
- R17. `shell.css` uses only the design system's names: every colour is `var(--…)` or `transparent`, every `var(--name)` is one of the 32 properties of TOKI-009 R10 or `--tabh`, `--shell-panel` or `--shell-convs-min` (Table C), no colour literal appears, and the `font-family` lines are those of Table C. A selector may name `[data-eff="calm"]` or `[data-eff="focus"]`: the layouts differ between the looks (TOKI-009, Design, Layout); no selector names `data-look`, `data-accent` or `data-density`. Nothing is hover-only (D-067): no rule hides an element with `opacity:0`, `visibility:hidden` or `display:none` for `:hover`, and every `:hover` rule changes only `background`, `color` or `border-color`. Check: a CSS test walks the file.

Layouts (browser test)
- R18. Three layouts, measured in the fixture with the section `home`, a list, a main area and no panel. Calm at 1100 and at 720 px: the sidebar is 272 px wide, the main area starts at x 272 and ends 12 px from the right edge, and its rectangle has a margin of 12 px above and below. Focus at 1100 and 720 px: the rail is 68 px wide, the conversation column ends at x 356, the main area runs from 356 to the right edge. In both looks, at 719 and at 360 px: no sidebar and no rail, the bottom bar is 62 px high (plus the bottom inset, 0 in the test) and ends at the bottom edge, and the list pane fills the rest. In the section `activity` Focus has the rail only (x 0 to 68) and the main area from 68 to the edge. Check: the browser test.
- R19. A side panel from 720 to 1099 px overlays the chat and does not squeeze it. In the fixture, in both looks, at 720, 800 and 1099 px: opening the panel leaves the rectangle of `.main` unchanged (same x, width, y and height as with no panel), and the rectangle of `.side` is 360 px wide (`min(360px, 100%)`), ends at the right edge of the main area (Calm: 12 px from the window's edge, as the main area does; Focus: at the edge) and lies over `.main` (its `z-index` is above `.main`). From 1100 px the panel is a column: in Calm at 1100 px `.main` is 444 px wide with the panel open and 816 px with it closed, in Focus `.main` is 384 px and 744 px. Under 720 px the panel is the full-screen pane (R22). Check: the browser test.
- R20. The sidebar keeps the conversation list as its main area, and the navigation scrolls. In the fixture with the six sections that Calm shows plus a seventh and an eighth added by the test, in windows 1100 by 560, 1100 by 480 and 1100 by 420 px: the `.convs` column is at least 240 px high; the `.nav-items` list scrolls when its content is higher than its box (`overflow-y:auto`, `scrollHeight` above `clientHeight`); and the workspace header, the search box, the conversation column and the account card all lie inside the window. At 1100 by 560 px with the six sections of phase 1 the Calm list still scrolls (it needs 185 px and gets 158 px; concern 1). In Focus at the same sizes the rail's items scroll between the search box and the account card, which stays inside the window; with the seven sections of phase 1 at 1100 by 560 px the Focus items need no scroll (356 px of items). Check: the browser test, with the numbers of Table J.
- R21. The smallest window, 360 by 560 px, in both looks and with every section of the fixture: no horizontal scroll (`document.documentElement.scrollWidth` not above `innerWidth`), the bottom bar, the list pane and the main pane are inside the window, and every `.nt`, `.tab`, `.ib` and `.btn` that the shell draws is at least 40 px tall at 719 px and below. The five tabs fit side by side at 360 px, each at least 64 px wide; with a longer label the bar scrolls sideways (Table G). Check: the browser test measures each.
- R22. Narrow panes (719 px and below). `data-pane="list"`: the list pane is visible and the main pane and the panel are not; `main`: the main pane; `side`: the panel pane, full screen, with the bottom bar hidden. The panes that are not shown have `visibility:hidden` once their transition has ended, so they are not in the Tab order and not read by a screen reader. With `data-chat-open` or `data-pane="side"` the bottom bar is moved out of the window (`translateY(100%)`) and is `visibility:hidden` after the transition, so its tabs cannot be reached by the keyboard while it is out of sight (the prototype leaves them reachable). The transitions last 0.18 s and the reduced-motion rule of TOKI-012's `base.css` shortens them. Check: the browser test sets each pane, waits for the transition and tries to focus a tab of the hidden bar with the keyboard (focus does not land on it); the CSS test reads Table G.
- R23. Toasts. `AppShell` renders `ToastProvider` (TOKI-013) around everything it draws, and its `ToastRegion` is therefore after the shell's elements in the document. It registers three things: `useToastAnchor` on the `div.toast-anchor`; `useToastAvoid` on the `nav`; and nothing else. The `div.toast-anchor` has `aria-hidden="true"`, no content, `pointer-events:none` and `visibility:hidden` (Table C); it occupies the grid area of the main column in the wide layouts and the whole shell in the narrow one, and from 720 to 1099 px, while the panel is open, it leaves out the panel's width (Table F), so a toast is centred in what the person can see of the chat. The `nav` is registered while it is the bottom bar; in the wide layouts its box is a column at the left, which does not overlap the anchor, so it does not move the toasts. In the fixture with a stand-in composer registered the way R25 says, with three toasts shown (one with a text long enough to fill the region), in both looks: at 360, 719, 720, 800, 1099 and 1100 px no toast intersects the bottom bar, the composer, the sidebar, the rail or (when open) the side panel, and each toast ends above the top of the composer and of the bottom bar while the bar is shown. At 360 px with the list pane open the toasts are above the bottom bar, not at the top of the window as in the prototype. When the bar is moved out by `data-chat-open`, the toasts come down to the composer or to 20 px (TOKI-013 R28 e). Check: the browser test, which is the proof of TOKI-013 R29 for the real shell.
- R24. `--tabh` is defined only on `.app`, only under 720 px (`calc(62px + env(safe-area-inset-bottom, 0px))`, Table G), and is read only by rules whose selector begins with `.app` or whose element is inside it. No rule of `shell.css` or of a toast or overlay reads it from outside `.app`. The toasts and the overlays do not use it: the toasts follow the registrations of R23. Check: a CSS test finds each `--tabh` and its selector; the browser test of R23.
- R25. The rule for a composer (the contract that TOKI-043 follows; TOKI-045 follows it in the panel). A composer calls `useToastAvoid(ref)` of TOKI-013 on its outermost element; it is drawn inside `main` or inside the side panel, which are inside the shell's `ToastProvider`, so the call has effect. The shell keeps nothing in the way: `.main` and `.side` clip their content with `overflow:hidden` and do not move a registered element with a transform. A composer that is drawn outside the shell (none in phase 1) must mount its own provider. The shell's fixture includes a stand-in with this call so that R23 is proved with it. Check: the browser test of R23; a test renders a component that calls `useToastAvoid` inside `AppShell` and sees the region's `bottom` change.

Page-wide
- R26. `packages/ui-web/src/styles/utilities.css` holds exactly the rules of Table H. It is imported by `apps/web/src/main.tsx` after `@toki/ui-web/base.css` and `app.css`, and by no component. Check: a CSS test; a test reads `main.tsx` as text.
- R27. `apps/web/src/app.css` holds exactly the rules of Table I: `#root`, and `body{font-size:15px}` under 720 px. It is imported by `main.tsx` right after `@toki/ui-web/base.css` and before every non-CSS import, so the order test of TOKI-012 R29 stays true and extends to this file. The 15 px applies to the whole app, the sign-in page included, at 719 px and below; at 720 px and above the text is 14 px. Check: a CSS test; the browser test reads the computed `font-size` of `body` at 719 (15 px) and 720 (14 px) px. The viewport meta of `apps/web/index.html` contains `viewport-fit=cover`, so that the safe-area insets of Table G are not 0 on a phone that asks for the whole screen; a test reads `index.html`.
- R28. `applyAppearance({ look, accent, density })` sets attributes on `document.documentElement` and returns a function that stops it. `look` is `"calm"`, `"focus"` or `"device"`: `"calm"` and `"focus"` set `data-eff` to that value; `"device"` sets `data-eff` to `"focus"` when `matchMedia("(prefers-color-scheme: dark)")` matches and to `"calm"` otherwise, and sets it again whenever the device's setting changes, until the function is called again or the returned function is called. `accent` is one of the four accents of TOKI-009 (`teal`, `indigo`, `clay`, `violet`; default `teal`) and sets `data-accent`. `density` is `"comfortable"`, `"compact"` or missing; missing removes `data-density` ("none chosen", TOKI-009 concern 1). An unknown value is treated as the default. `apps/web/src/main.tsx` calls `applyAppearance({ look: "device" })` before the app is mounted. Saving the choice to the account (D-175) and offering the controls is TOKI-078, which calls the same function with the saved values; the page of TOKI-016 may call it too. Check: unit tests with a stubbed `matchMedia` for each look, a device change, an unknown value and the stop function.
- R29. `useNarrow()` returns whether `matchMedia("(max-width: 719px)")` matches, and updates when it changes; with no `matchMedia` it returns `false`. When `AppShell` is narrow and its `data-pane` changes, focus moves to the pane that is now shown (the `aside.convs`, the `main` or the `aside.side`, each with `tabIndex={-1}`), unless the focus is already inside it; this runs only on a change, not at the first render. At 720 px and above focus is not moved. Check: unit tests with a stubbed `matchMedia`; the browser test opens a conversation from the list at 360 px and reads `document.activeElement`.
- R30. In `apps/web`, a pathless layout route `src/routes/_app.tsx` renders the shell with the sections of `src/shell/sections.ts` for every route under `src/routes/_app/`; `/login` (TOKI-023) and the not-found view stay outside it. The index route moves to `src/routes/_app/index.tsx` and its page is unchanged (it shows "Toki" in `data-testid="app-root"`), so TOKI-006 R2 and the sample test of TOKI-008 R11 still pass, with the page now inside the shell. `routeTree.gen.ts` is regenerated and committed. `sections.ts` exports the list (R10), one row per built section, each with `id`, `icon`, `labelKey` (a `MessageKey` of `@toki/i18n`), `to` (the path) and `match(pathname)`; this ticket's list has the row `home` only (`to: "/"`, `match: p => p === "/"`, `tab: true`). The layout route turns each row into a `NavSection` with `t(labelKey)`, takes `currentSection` from the first row whose `match` is true for the current path, and gives `onNavigate` the router's navigation. A later ticket adds its row and its route file and changes nothing else in the shell. The paths of the other sections are decided here so that the tickets agree: `/activity`, `/later`, `/files`, `/people`, `/preferences`, `/admin`. Check: a test of the list; the browser test opens `/` and finds `shell` and `app-root`; a test that the route tree has `_app` and `login` as separate branches (once `/login` exists).
- R31. Texts. `apps/web` translates the shell's words with `useTranslation` of `@toki/i18n/react`: the section labels from `nav.home`, `nav.activity`, `nav.later`, `nav.files`, `nav.people`, `nav.preferences`, `nav.admin`, `nav.more` and `nav.search` (TOKI-017), and `nav.conversations` for the landmark of the list. This ticket adds four keys to both catalogs: `nav.main` ("Main", the prototype's `aria-label`; the label of the navigation landmark), `nav.accountMenu` ("Your account menu", line 1210), `nav.back` ("Back", line 1426) and `nav.closePanel` ("Close panel", line 1426), each with a Vietnamese text (concern 8). `pnpm --filter @toki/i18n check` still prints `no problem`. Check: the i18n check; a test renders the layout route in `en` and in `vi` and reads the landmark names.
- R32. `apps/web/shell-fixture.html` is a second entry of the web app, in development only, the way TOKI-016 does it for its page: Vite serves it, the production build does not include it. It loads `@toki/tokens/tokens.css`, `@toki/ui-web/base.css`, `src/app.css` and `@toki/ui-web/utilities.css` (before every non-CSS import, TOKI-012 R29), calls `applyAppearance` from the address (`?look=calm|focus`), sets no storage, and mounts `AppShell` with fixture data read from the address: `?section=`, `?pane=` (`list`, `main`, `side`), `?panel=1`, `?sections=` (how many sections, 6 to 8) and `?toasts=1`. The data is made up: a workspace name, eight people, forty list rows (buttons), a main area with a header, a tab row of three tabs, a scroll area, an `EmptyState`, and a stand-in composer registered as R25 says, a side panel with a header and a body, and the More rows. After `pnpm --filter ./apps/web build`, `apps/web/dist` holds no file that contains `shell-fixture`, and `apps/web/dist` holds only `index.html` as a page (the check of TOKI-016 R2 holds; this ticket adds `check:no-shell-fixture`, run by the `build` script after the checks that exist). Check: the build and the check; add the page to `build.rollupOptions.input` by hand and see the check fail.
- R33. `e2e/app-shell.spec.ts` holds the browser checks of R15, R18 to R23, R27 and R29, in Chromium, in both looks, at the widths 360 (height 560), 719, 720, 800, 1099, 1100 and 1400. It reads rectangles and computed styles from the fixture and writes nothing. The numbers it expects are those of Table J and of the requirements; it fails when a value is off by more than 1 px. Check: `pnpm test:e2e` exits 0; change one value of Table C and see it fail.
- R34. `AppShell`, `SectionPage`, `TabList`, `Tab`, `SearchBox`, `UserCard` and `WorkspaceHeader` are made with `forwardRef` and forward `ref` to their root element: `AppShell` to `div.app`, `SectionPage` to `div.sechead`, `TabList` to `div.tabs`, `Tab` to its `button`, `SearchBox` to `button.srch`, `UserCard` to `div.usercard`, `WorkspaceHeader` to `div.ws`. Each passes `className` and the other attributes of that element through, except the ones it owns, and applies the owned attributes after the spread, as TOKI-012 R2 says. `SidePanel` and `BottomTabs` render parts of elements that `AppShell` owns (`aside.side`, `nav`) and take no `ref`. Check: a `ref` test and a `className` test for each.
- R35. `pnpm typecheck`, `pnpm lint`, `pnpm lint:boundaries`, `pnpm format:check`, `pnpm --filter @toki/ui-web test`, `pnpm --filter ./apps/web build` and `pnpm test:e2e` exit 0. The initial JavaScript of `apps/web` stays under the limit of TOKI-006 R10 (a larger shell is a failure of this ticket, not a reason to raise the limit). `packages/ui-web/src/shell` and `src/appearance.ts` use no API that TOKI-002 R9 bans; they use `matchMedia` and the DOM, which `ui-web` may. Check: run the commands on the finished branch.

## Design
### What the prototype does, measured
Measured in headless Chrome with a `file://` page that loads the prototype in a frame of each width (no server), with the demo bar and the device bar hidden so that the shell is the whole frame. All numbers are pixels; "main" is the main area, "side" the panel.

| Case | Calm | Focus |
| :---- | :---- | :---- |
| 1100 wide, no panel | sidebar 272; main x 272 to 1088 with 12 above and below | rail 68, conversation column 68 to 356, main 356 to 1100 |
| 1100 wide, panel open | main 444 wide, panel 360 beside it | main 384 wide, panel 360 beside it |
| 800 wide, panel open (D-068 says overlay) | main 144 wide, panel 360 beside it | main 84 wide, panel 360 beside it |
| exactly 720 wide | the narrow layout (bottom bar 62 high, one pane) | the same |
| 719 and 360 wide | the narrow layout | the same |
| 560 high, 1100 wide, home | navigation 412 high, conversation column 81 high, its list 12 high | the items run to y 649, 89 px below the window, and overlap the account card at y 496 |
| 360 wide, list pane, a toast shown | the toasts' box is at the top of the window (y 0 to 42); `--tabh` is `calc(62px + 0px)` on `.app` and empty on the toasts' container; `bottom` computes to 557 | the same |
| `body` and `.device` font size at 360 wide | 14 px, not 15 px | 14 px |

What each row means for the build:
- The panel squeezes the chat (rows 2 and 3). D-068 and NFR-01 say it overlays from 720 to 1099 px. Built: Table F. Checked on the prototype with the overlay rule injected: at 800 px the main area keeps 516 px in Calm and 444 px in Focus.
- The prototype changes layout at 720 px inclusive, with a container query on its demo frame (`@container app (max-width:720px)`, `isPhone()` uses `<= 720`). D-068 says "under 720px: one pane at a time. From 720 to 1099px: side panels overlay the chat". Decided in this spec: a window of exactly 720 px is not narrow, the layout changes at 719/720 px, and it is read from the window with `@media`, as TOKI-012 R8 does for the controls (the controls and the shell must agree on one width, and the product has no demo frame). Concern 3.
- The navigation is cut off at 560 px (row 6). In Calm the grid row of the navigation is `auto` and takes its whole content, so the conversation column gets what is left; in Focus the rail's items are not allowed to scroll and are clipped. Built: R20 and Table D.
- The toasts' rule `.toasts{bottom:calc(var(--tabh) + 14px)}` (line 562) cannot work: `--tabh` is set on `.app` (line 506) and the toasts' container `.ov` is the next element after `.app`, not inside it, so the variable is empty there and `bottom` falls back to `auto`. This is the defect the review of TOKI-013 found, and it is confirmed. Built: the toasts follow the registrations of R23 (TOKI-013 R27, R28), `--tabh` is kept for the panes inside `.app` where it works (R24), and no rule reads it from outside.
- The `body,.device{font-size:15px}` rule (line 503) is inside the same container block. A container query styles the descendants of the container and never the container itself, and `body` is not inside the frame, so both rules are dead: the prototype draws 14 px at every width. TOKI-012 hands "the 15 px body size of narrow screens" to this ticket. Decided in this spec: build 15 px under 720 px, because the narrow block of the prototype is written to give it, the other rules of the block are all in force (40 px controls, 48 px tabs, the larger title) and F38 asks for larger touch targets. The cost: at 360 px the text that has no size of its own is 1 px larger than in the prototype, so a by-eye comparison shows a difference that is known (concern 2).

### The three layouts
Markup is the same in every width, as in the prototype. Which element is where is decided by CSS:

| Element | Calm, 720 px and wider | Focus, 720 px and wider | Under 720 px |
| :---- | :---- | :---- | :---- |
| `.sidebar` | left column, 272 px: `nav`, `convs`, `usercard` in three rows | `nav` and `usercard` in a 68 px rail; on Home also the 288 px conversation column | not drawn as a column; the pieces are placed one by one |
| `nav` | top of the sidebar: workspace header, search box, items | the rail: icon items with a small label | the bottom bar, 62 px, with the tabs |
| `.convs` | below the navigation, always | on Home only, beside the rail | the list pane, one of the three panes |
| `.usercard` | foot of the sidebar | foot of the rail, avatar only | not drawn (the account is in the More sheet, TOKI-092) |
| `main` | the rest, as a card with 12 px around it | the rest, to the edges | the main pane |
| `.side` | a column of 360 px from 1100 px; an overlay over `main` from 720 to 1099 px | the same | the panel pane, full screen |

Decided in this spec: the three pieces of the Calm sidebar (`nav`, `convs`, `usercard`) are put in one `div.sidebar` with its own grid, instead of three areas of the app's grid with `.nav{display:contents}` as in the prototype. The reason is that the sidebar's rows need their own rule (the navigation may shrink and scroll, R20) and Focus needs a different grid inside the same wrapper; a `display:contents` navigation also depends on the browser keeping its role, which is not needed here. The prototype's `.navtop` is this ticket's `nav`, and the prototype's `.nav` (the Focus rail and the bottom bar) is built from the `nav` and the `usercard` by the rules of Tables E and G.

### Where the shell gets its data
The shell is a presentational component: it reads no router, no session and no network, and holds no text (R2). `apps/web/src/shell/` wires it: the section list, the translations, the router's navigation and the current path. The workspace name, the head count, the badges' numbers and the account card are props that the tickets that own that data fill in (Scope). That is also why the fixture can draw the whole shell with made-up data, and why the preview of the layouts needs no server.

### Narrow: panes and the bottom bar
- The pane shown is a pure function of four inputs (`derivePane`, R4), as in the prototype's `R.attrs`. At 719 px and below the two panes that are not shown are `visibility:hidden` and moved aside (`main` to the right, `convs` 24% to the left), and the transition is 0.18 s. The bottom bar is hidden when a conversation is open or the panel is shown, by moving it down 100% (the prototype's way) and, new, by `visibility:hidden` after the transition, so a keyboard user cannot reach a tab that is out of sight (R22).
- The panel exists only while it is open (R3), so it appears with a short slide-in (`animation`) and leaves at once; the prototype keeps it mounted and slides it out. Decided in this spec: fewer states, and the panel's content (a thread, a profile) is unmounted on close in any case.
- On a pane change at 719 px and below, focus moves to the pane (R29). Without it, the pressed row of the list becomes `visibility:hidden` and focus falls to the page; a keyboard or screen reader user would start from the top of the document. The pane has `tabIndex={-1}` and no focus ring (it is not a control).
- Safe areas: the bar's height and the panes' offsets use `env(safe-area-inset-*)` as the prototype does. They are 0 unless the page asks for the whole screen, so `index.html` gets `viewport-fit=cover` in its viewport meta (R27). Without it, an iPhone installed to the home screen (NFR-14) would show the bar under the home indicator.
- The shell root is `position:fixed; inset:0` (Table C), not `absolute` inside a frame: the product has no demo frame, and a fixed root does not depend on how high the body is (`100%` and `100dvh` differ on phones with a moving address bar).

### The sidebar scrolls
Decided in this spec, with a number the prototype does not have. The Calm sidebar's rows are `minmax(0, max-content) minmax(var(--shell-convs-min), 1fr) auto` with `--shell-convs-min: 240px`: the navigation takes its content height while there is room, the conversation column always keeps at least 240 px (its header and chips and about five rows at 32 px), and the account card keeps its own height. The part that gives way is the list of items (`.nav-items`: `flex: 0 1 auto; min-height: 0; overflow-y: auto`); the workspace header and the search box do not scroll. Checked on the prototype's markup with these rules injected, at 1100 px wide, with the prototype's ten items: at 560 px high the navigation takes 253 px, the conversation column 240 px and the account card 67 px, and the item list scrolls (158 px visible of 205); at 480 px the navigation takes 173 px (78 px of items visible); at 420 px it takes 113 px (18 px visible) and the column is still 240 px. At 560 px the six items of Calm in phase 1 need 185 px and so scroll; the seven items of the Focus rail need 356 px and fit. Below about 410 px nothing fits, which is under the smallest supported height of 560 px. In Focus the rail's items scroll between the search box and the card (`overflow-y:auto; min-height:0`): checked at 560 px with the prototype's ten items, 391 px of 430 show.

### Tabs and the section frame
- The tab row is the prototype's `.tabs` and `.tab`, with `role="tablist"` and `role="tab"` added (the prototype has them on the conversation row, line 1296) and the roving tab stop and arrow keys of the WAI-ARIA tabs pattern (R13, R14), which the prototype does not have. The tab row scrolls sideways when the tabs do not fit (`overflow-x:auto`, `scrollbar-width:none`, as in the prototype), so a mouse user without a trackpad can scroll it only with the arrow keys or Shift and the wheel; concern 6. The panel of a tab is the screen's: `aria-controls` points at it when the screen gives `panelId`.
- `SectionPage` is the prototype's `.sechead` and `.secbody` (lines 350-353, 541-542), the frame of Activity, Later, Files, People, Admin and Preferences. `.toolbar` (line 355) is the row of search and chips under the header in Files and People; it is a class and not a component, in Table H, because its content is the screen's. `.secbody.prefs` (line 809) is Preferences'.

### The look on the page
`applyAppearance` sets the three attributes (R28). The shell's layout rules depend on `[data-eff]` and the tokens' first-paint block does not: a page with no `data-eff` on a dark device shows Focus colours with the Calm layout. Calling `applyAppearance({ look: "device" })` before the app is mounted removes that case. It does not remove the difference for a person whose saved look is not the device's, before the account has loaded (concern 10).

### Utilities
Table H is the prototype's block of utility classes (lines 64-66, 122-129) as written, except `.kbd`, which belongs to the palette (TOKI-071). Some of them collide in name with a component class (`.sm` with `Button`'s `sm`): that is the prototype's and TOKI-012's concern 7, and the order of the style sheets keeps it as it is in the prototype.

### Tables
Every row gives the prototype line it comes from; "decided" is a rule or a value that the prototype does not have or that changes it. The tests of R16 hold a copy of each table.

Table C. `shell.css`, all widths.

| Selector | Declarations | Source |
| :---- | :---- | :---- |
| `.app` | `position:fixed; inset:0; display:grid; background:var(--bg); overflow:clip; grid-template-rows:minmax(0,1fr)` | 112, 797; decided: `fixed`, because the product has no frame |
| `.app > *` | `min-width:0; min-height:0` | 113 |
| `.sidebar` | `min-height:0; min-width:0` | decided |
| `.main` | `grid-area:main; display:flex; flex-direction:column; position:relative; background:var(--surface); min-height:0; min-width:0; overflow:hidden` | 154 |
| `.convs` | `grid-area:convs; display:flex; flex-direction:column; min-height:0` | 153 |
| `.side` | `grid-area:side; display:flex; flex-direction:column; width:var(--shell-panel); background:var(--surface); min-height:0` | 155; the `display:none` of the closed panel is not needed (R3) |
| `.toast-anchor` | `grid-area:main; pointer-events:none; visibility:hidden` | decided (R23) |
| `.sh` | `display:flex; align-items:center; gap:8px; padding:12px 16px; border-bottom:1px solid var(--line); min-height:52px` | 331 |
| `.sh h2` | `margin:0; font-size:15px; font-weight:700; flex:1` | 332 |
| `.sb` | `padding:14px 16px; overflow-y:auto; flex:1; min-height:0; display:flex; flex-direction:column` | 333; the flex column is decided (R15) |
| `.sechead` | `display:flex; align-items:center; gap:12px; padding:18px 24px 10px; flex-wrap:wrap` | 350 |
| `.sechead .title` | `flex:1; display:flex; align-items:center; gap:10px` | 352 |
| `.secbody` | `flex:1; min-height:0; overflow-y:auto; padding:0 24px 24px; display:flex; flex-direction:column` | 353; the flex column is decided (R15) |
| `.toolbar` | `display:flex; gap:8px; align-items:center; flex-wrap:wrap; padding:0 24px 12px` | 355 |
| `.tabs` | `display:flex; gap:2px; padding:6px 16px 0; border-bottom:1px solid var(--line); overflow-x:auto; scrollbar-width:none` | 215 |
| `.tab` | `padding:8px 12px; font-weight:500; color:var(--muted); border-bottom:2px solid transparent; margin-bottom:-1px; white-space:nowrap; display:flex; align-items:center; gap:6px; transition:color .15s` | 216 |
| `.tab:hover` | `color:var(--ink)` | 217 |
| `.tab[aria-selected="true"]` | `color:var(--ink); border-color:var(--accent); font-weight:600` | 218 |
| `.ws` | `display:flex; align-items:center; gap:10px; padding:4px 8px 10px` | 133 |
| `.ws .wsl` | `width:34px; height:34px; border-radius:10px; background:var(--accent); color:var(--on-accent); display:grid; place-items:center; font-family:"Bricolage Grotesque",sans-serif; font-weight:700; font-size:16px` | 134 |
| `.ws .wsn` | `font-family:"Bricolage Grotesque",sans-serif; font-weight:700; font-size:17px; letter-spacing:-.01em; line-height:1.1` | 135 |
| `.ws .wss` | `font-size:11.5px; color:var(--muted)` | 136 |
| `.srch` | `display:flex; align-items:center; gap:8px; height:36px; padding:0 10px; border-radius:var(--radius-sm); background:var(--surface); border:1px solid var(--line); color:var(--muted); margin-bottom:8px; width:100%; transition:border-color .15s` | 137 |
| `.srch:hover` | `border-color:var(--muted)` | 138 |
| `.srch .kbd` | `margin-left:auto; font-family:"JetBrains Mono",ui-monospace,"SF Mono",Menlo,monospace; font-variant-numeric:tabular-nums; font-size:11px; border:1px solid var(--line); border-radius:5px; padding:0 5px; background:var(--surface-2)` | 139, 64 |
| `.nav-items` | `display:flex; flex-direction:column; gap:1px; flex:0 1 auto; min-height:0; overflow-y:auto` | 140; the last three are decided (R20) |
| `.ni` | `display:flex; align-items:center; gap:10px; height:var(--row); padding:0 10px; border-radius:var(--radius-sm); color:var(--ink-2); font-weight:500; width:100%; transition:background .15s,color .15s; position:relative; text-decoration:none` | 141; `text-decoration:none` decided (a link) |
| `.ni:hover` | `background:var(--hover); color:var(--ink)` | 142 |
| `.ni[aria-current="page"]` | `background:var(--accent-soft); color:var(--accent-text); font-weight:600` | 143 |
| `.ni .cnt` | `margin-left:auto` | 144 |
| `.ni .lb` | `white-space:nowrap` | 145 |
| `.nav-tabs` | `display:none` | 146 |
| `.usercard` | `grid-area:user; padding:8px 12px 12px` | 147 |
| `.ucard` | `display:flex; align-items:center; gap:10px; padding:8px; border-radius:var(--radius-sm); width:100%; transition:background .15s` | 148 |
| `.ucard:hover` | `background:var(--hover)` | 149 |
| `.ucard .un` | `font-weight:600; line-height:1.2; display:block` | 150; `display:block` so the two lines stack |
| `.ucard .us` | `font-size:12px; color:var(--muted); display:block` | 151 |
| `.ucard .uct` | `flex:1; min-width:0` | line 1210 (`class="grow" style="min-width:0"`) |
| `.app` (custom properties) | `--shell-panel:360px; --shell-convs-min:240px` | decided: the two numbers that two rules share |
| `.convs:focus-visible, .main:focus-visible, .side:focus-visible` | `outline:none` | decided: the panes take focus from code only (R29); they are not controls |

`.app` gets its `grid-template-columns` in Tables D and G, one for each layout.

Table D. `shell.css`, `@media (min-width: 720px)`, both looks.

| Selector | Declarations | Source |
| :---- | :---- | :---- |
| `.app` | `grid-template-columns:auto minmax(0,1fr) auto; grid-template-areas:"sidebar main side"` | 152, 161 (decided: the sidebar is one area) |
| `.sidebar` | `grid-area:sidebar; display:grid` | decided |
| `.ni[data-calm-hidden]` | `display:none` | 592; the prototype hides `prefs` in Calm, where Preferences is reached from the account menu (concern 7) |
| `.sh .back-side` | `display:none` | 577 |

Table E. `shell.css`, `@media (min-width: 720px)`, Calm.

| Selector | Declarations | Source |
| :---- | :---- | :---- |
| `[data-eff="calm"] .sidebar` | `width:272px; grid-template-columns:minmax(0,1fr); grid-template-rows:minmax(0,1fr) auto; grid-template-areas:"nav" "user"` | 152; the rows are those of the sidebar with no list |
| `[data-eff="calm"] .sidebar[data-has-list]` | `grid-template-rows:minmax(0,max-content) minmax(var(--shell-convs-min),1fr) auto; grid-template-areas:"nav" "convs" "user"` | decided (R20) |
| `[data-eff="calm"] .nav` | `grid-area:nav; display:flex; flex-direction:column; gap:2px; padding:10px 12px 4px; min-height:0` | 132, 781 |
| `[data-eff="calm"] .ws` | `padding:2px 8px 8px` | 782 |
| `[data-eff="calm"] .srch` | `height:34px; margin-bottom:6px` | 783 |
| `[data-eff="calm"] .ni` | `height:30px; font-size:13.5px` | 784 (it wins over 591) |
| `[data-eff="calm"] .ni .ic` | `width:17px; height:17px` | 785 |
| `[data-eff="calm"] .usercard` | `padding:4px 0 10px; margin:0 12px; border-top:1px solid var(--line)` | 790 |
| `[data-eff="calm"] .main` | `margin:12px 12px 12px 0; border-radius:var(--radius); box-shadow:var(--shadow)` | 157, 159 |
| `[data-eff="calm"] .side` | `margin:12px 12px 12px 0; border-radius:var(--radius); box-shadow:var(--shadow); overflow:hidden` | 158 |

Table F. `shell.css`, Focus (`@media (min-width: 720px)`), and the overlay (`@media (min-width: 720px) and (max-width: 1099px)`).

| Selector | Declarations | Source |
| :---- | :---- | :---- |
| `[data-eff="focus"] .sidebar` | `width:68px; grid-template-columns:68px; grid-template-rows:minmax(0,1fr) auto; grid-template-areas:"nav" "user"` | 161 |
| `[data-eff="focus"] .app[data-section="home"] .sidebar[data-has-list]` | `width:356px; grid-template-columns:68px 288px; grid-template-areas:"nav convs" "user convs"` | 162 |
| `[data-eff="focus"] .app:not([data-section="home"]) .convs` | `display:none` | 177 |
| `[data-eff="focus"] .nav` | `grid-area:nav; display:flex; flex-direction:column; gap:4px; padding:10px 8px 0; background:var(--bg); border-right:1px solid var(--line); align-items:stretch; min-height:0; overflow:hidden` | 163, 164 |
| `[data-eff="focus"] .nav-items` | `flex:1 1 auto; min-height:0` | decided (R20) |
| `[data-eff="focus"] .ws` | `padding:0; justify-content:center; margin-bottom:6px` | 165 |
| `[data-eff="focus"] .wst` | `display:none` | 166 |
| `[data-eff="focus"] .srch` | `height:36px; justify-content:center; padding:0; background:transparent; border-color:transparent; margin-bottom:6px` | 167 |
| `[data-eff="focus"] .srch:hover` | `background:var(--hover)` | 168 |
| `[data-eff="focus"] .srch .t, [data-eff="focus"] .srch .kbd` | `display:none` | 169 |
| `[data-eff="focus"] .ni` | `flex-direction:column; justify-content:center; gap:3px; height:50px; padding:0; font-size:10.5px; font-weight:500` | 170, 796 |
| `[data-eff="focus"] .ni .ic` | `width:20px; height:20px` | 171 |
| `[data-eff="focus"] .ni .cnt` | `position:absolute; top:4px; right:auto; left:calc(50% + 5px); margin:0; min-width:16px; height:16px; font-size:10px; box-shadow:0 0 0 2px var(--bg)` | 172, 595, 795 |
| `[data-eff="focus"] .ni .cnt.mute` | `background:var(--accent); color:var(--on-accent)` | 596 |
| `[data-eff="focus"] .usercard` | `grid-area:user; padding:6px 8px 10px; background:var(--bg); border-right:1px solid var(--line)` | 173; the background and the border are the rail's (163) drawn on this cell |
| `[data-eff="focus"] .ucard` | `justify-content:center; padding:6px` | 174 |
| `[data-eff="focus"] .ucard .uct` | `display:none` | 175 |
| `[data-eff="focus"] .convs` | `border-right:1px solid var(--line); background:var(--bg)` | 176 |
| `[data-eff="focus"] .side` | `border-left:1px solid var(--line)` | 178 |
| `.app[data-panel] .side` (overlay block) | `grid-area:auto; position:absolute; top:0; right:0; bottom:0; z-index:6; width:min(var(--shell-panel),100%); box-shadow:var(--pop)` | decided (R19); `grid-area:auto` because an absolutely placed grid item takes the grid area as its containing block, which is 0 px wide when the panel is out of the grid (measured) |
| `.app[data-panel] .toast-anchor` (overlay block) | `margin-right:calc(var(--shell-panel) + 12px)` | decided (R23) |

Table G. `shell.css`, `@media (max-width: 719px)`.

| Selector | Declarations | Source |
| :---- | :---- | :---- |
| `.app` | `display:block; background:var(--bg); --tabh:calc(62px + env(safe-area-inset-bottom,0px))` | 504, 506 |
| `.sidebar` | `display:block` | decided (its children are placed one by one) |
| `.convs, .main, .side` | `position:absolute; left:0; right:0; top:0; bottom:var(--tabh); margin:0; border-radius:0; box-shadow:none; width:auto; border:0; background:var(--surface); transition:transform .18s ease,visibility .18s; visibility:hidden; display:flex` | 505; `!important` of the prototype is not needed (the wide rules are in the wide blocks) |
| `.convs` | `background:var(--bg)` | 507 |
| `.app[data-pane="list"] .convs, .app[data-pane="main"] .main, .app[data-pane="side"] .side` | `visibility:visible` | 508-510 |
| `.app[data-pane="side"] .side` | `z-index:6` | 510 |
| `.app[data-pane="list"] .main` | `transform:translateX(100%)` | 511 |
| `.app:not([data-pane="list"]) .convs` | `transform:translateX(-24%)` | 512 |
| `.app[data-chat-open] .main, .side` | `bottom:0` | 514 |
| `.side` | `animation:shell-slide-in .18s ease-out` and `@keyframes shell-slide-in` from `transform:translateX(100%)` | decided (the panel is mounted when opened, Design) |
| `.nav` | `display:block; position:absolute; left:0; right:0; bottom:0; height:var(--tabh); padding:0; background:var(--surface); border-top:1px solid var(--line); z-index:5; transition:transform .18s,visibility .18s` | 515, 517 |
| `.app[data-chat-open] .nav, .app[data-pane="side"] .nav` | `transform:translateY(100%); visibility:hidden` | 516; `visibility:hidden` is decided (R22) |
| `.nav .ws, .nav .srch, .nav-items, .usercard` | `display:none` | 518 |
| `.nav-tabs` | `display:flex; height:100%; padding:6px 6px calc(6px + env(safe-area-inset-bottom,0px)); overflow-x:auto; scrollbar-width:none` | 519; the last two are decided (a long label) |
| `.nt` | `flex:1 0 64px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; min-height:48px; border-radius:12px; font-size:11px; font-weight:500; color:var(--muted); position:relative; text-align:center; text-decoration:none` | 520; `flex-basis:64px` and `text-decoration` are decided |
| `.nt[aria-current="page"]` | `color:var(--accent-text); font-weight:700` | 521 |
| `.nt[aria-current="page"] .ic` | `stroke-width:2.2` | 522 |
| `.nt .cnt` | `position:absolute; top:2px; left:calc(50% + 4px); min-width:16px; height:16px; font-size:10px` | 523 |
| `.tabs` | `padding-left:max(10px,env(safe-area-inset-left,0px)); padding-right:max(10px,env(safe-area-inset-right,0px))` | 532 |
| `.tab` | `min-height:40px` | 538 |
| `.sechead, .secbody, .toolbar` | `padding-left:max(16px,env(safe-area-inset-left,0px)); padding-right:max(16px,env(safe-area-inset-right,0px))` | 541 |
| `.sechead` | `padding-top:max(14px,env(safe-area-inset-top,0px))` | 542 |
| `.sb, .sh` | `padding-left:max(16px,env(safe-area-inset-left,0px)); padding-right:max(16px,env(safe-area-inset-right,0px))` | 543 |
| `.sh` | `padding-top:max(12px,env(safe-area-inset-top,0px))` | 544 |
| `.sh .back-side` | `display:inline-grid` | 578 |
| `.sh .closex` | `display:none` | 578 |

`.title` has `font-size:24px` at this width: it is in Table H.

Table H. `packages/ui-web/src/styles/utilities.css`.

| Selector | Declarations | Source |
| :---- | :---- | :---- |
| `.mono, time, [data-timer]` | `font-family:"JetBrains Mono",ui-monospace,"SF Mono",Menlo,monospace; font-variant-numeric:tabular-nums` | 64 (without `.kbd`, TOKI-071's) |
| `.disp` | `font-family:"Bricolage Grotesque","Be Vietnam Pro",system-ui,sans-serif; letter-spacing:-.01em` | 65 |
| `.muted` | `color:var(--muted)` | 122 |
| `.sm` | `font-size:12.5px` | 123 |
| `.xs` | `font-size:11.5px` | 124 |
| `.grow` | `flex:1; min-width:0` | 125 |
| `.row` | `display:flex; align-items:center; gap:8px` | 126 |
| `.ell` | `white-space:nowrap; overflow:hidden; text-overflow:ellipsis` | 127 |
| `.scroll` | `overflow-y:auto; overscroll-behavior:contain` | 128 |
| `.title` | `font-family:"Bricolage Grotesque",system-ui,sans-serif; font-weight:700; font-size:22px; letter-spacing:-.015em; margin:0` | 129 |
| `.title` (`@media (max-width: 719px)`) | `font-size:24px` | 545 |

Table I. `apps/web/src/app.css`.

| Selector | Declarations | Source |
| :---- | :---- | :---- |
| `#root` | `height:100%; background:var(--bg)` | 69; the prototype's `display:flex; flex-direction:column` held its demo bar and stage and is not needed |
| `body` (`@media (max-width: 719px)`) | `font-size:15px` | 503 |

Table J. Numbers the browser test expects (R18 to R21), in both looks, with the fixture's made-up data. Heights are those of a window of the stated height.

| Check | Value |
| :---- | :---- |
| Calm sidebar width | 272 |
| Calm main area at 1100 wide: x from, to; margin top and bottom | 272, 1088; 12 |
| Focus rail width; conversation column ends at | 68; 356 |
| Panel width; main width at 1100 with and without a panel (Calm) | 360; 444 and 816 |
| Panel width; main width at 1100 with and without a panel (Focus) | 360; 384 and 744 |
| Main width at 800 with and without a panel (Calm, Focus) | 516 and 516; 444 and 444 |
| Bottom bar height under 720 | 62 |
| Conversation column height at 1100 by 560, 480 and 420 (Calm, a list given) | at least 240 |
| Calm `.nav-items` at 1100 by 560 with six sections: content and box | 185 and 158 (it scrolls) |
| Focus rail items at 1100 by 560 with seven sections | 356, no scroll |
| Body font size at 719 and at 720 | 15 and 14 |
| Control height at 719 | at least 40 |

### Layout
```
packages/ui-web/
├─ package.json            exports "./utilities.css"
└─ src/
   ├─ index.ts             adds: export * from "./shell" and export * from "./appearance"
   ├─ appearance.ts        applyAppearance
   ├─ styles/utilities.css Table H
   └─ shell/
      ├─ index.ts
      ├─ AppShell.tsx  derivePane.ts  useNarrow.ts
      ├─ BottomTabs.tsx  WorkspaceHeader.tsx  SearchBox.tsx  UserCard.tsx
      ├─ SidePanel.tsx  SectionPage.tsx  TabList.tsx
      ├─ shell.css       Tables C to G
      └─ *.test.tsx, shell.css.test.ts
apps/web/
├─ index.html              viewport meta gets viewport-fit=cover
├─ shell-fixture.html      second entry, development only (R32)
├─ package.json            build runs check:no-shell-fixture last
├─ scripts/check-no-shell-fixture.mjs
└─ src/
   ├─ app.css              Table I
   ├─ main.tsx             imports (order below), applyAppearance before mount
   ├─ routes/_app.tsx      layout route (R30)
   ├─ routes/_app/index.tsx   the index page of TOKI-006, moved
   ├─ shell/sections.ts    the section list
   ├─ shell/AppShellRoute.tsx  translations, router, current section
   └─ shell-fixture/       main.tsx, Fixture.tsx (made-up data)
packages/i18n/src/catalogs/{en,vi}/nav.ts   four keys
e2e/app-shell.spec.ts
```
Import order in `main.tsx`: `fonts.css`, `@toki/tokens/tokens.css`, `@toki/ui-web/base.css`, `./app.css`, `@toki/ui-web/utilities.css`, then every other import. The test of TOKI-012 R29 (`order.test.ts`) fails when a non-CSS import precedes one of them; this ticket extends its list by the two new files.

### Errors
- `panel` given without `panelLabel` -> a type error at `pnpm typecheck` (R3).
- A section with a `badge` of 0, a negative number or `NaN` -> no badge (R7).
- `matchMedia` missing (a test environment, an old browser) -> `useNarrow` is false and `applyAppearance` with `"device"` sets `calm` (R28, R29).
- A route that is not built is not in the section list, so there is no link to a page that does not exist (R10).
- A plain click on a section link with no `onNavigate` -> the browser navigates (R5).

## Testing
- Written first and seen to fail. Unit tests in `packages/ui-web/src/shell/*.test.tsx` and `src/appearance.test.ts`, run with `pnpm --filter @toki/ui-web test`, with Testing Library and `user-event` of TOKI-012; the CSS tests with `readCss`. Browser test `e2e/app-shell.spec.ts` against the fixture. No account, no server, no network; every text is made up.
- R1, R2: export list test; a source scan for imports; a render with empty text props.
- R3, R4, R34: DOM tests; the table test of `derivePane` over all 16 inputs; a `ref` test for each component.
- R5 to R10: DOM tests with `user-event` (click, Ctrl click, Meta click, Shift click, Alt click, Enter on a link, Space on a button); badge values 0, -1, `NaN`, 1, 100; the More button present and absent and its press; no dialog rendered by the shell.
- R11 to R14: DOM tests; the keyboard test of the tab row (ArrowRight, ArrowLeft, wrap, Home, End, other keys).
- R15 to R22, R27: the browser test, in both looks. At each width it opens the fixture with the query that sets the case, reads `getBoundingClientRect` and computed styles, and compares with Table J and the requirement (1 px of tolerance). For R22 it sets `?pane=main` and `?pane=side`, waits 300 ms, presses Tab from the top of the document 40 times and checks that focus never lands on an element of the hidden bar or of a hidden pane.
- R16, R17, R24, R26, R27: CSS tests, with the tables typed in. They also fail on `@container`, on `!important`, on a colour literal, on a custom property outside the allowed ones, on a `--tabh` read outside `.app`, and on an `opacity:0` or `display:none` in a `:hover` rule.
- R23, R25: the browser test shows three toasts through the fixture and reads each toast's rectangle against the rectangles of the bar, the stand-in composer, the sidebar, the rail and the panel, at the six widths and in both looks, with the bar shown and hidden (`?pane=main` with a conversation open); a Vitest test renders a component that calls `useToastAvoid` inside `AppShell` and checks the region's `bottom`.
- R28, R29: unit tests with a stubbed `matchMedia` (matches, does not match, changes, missing), and with a stubbed `scrollIntoView` and `focus`.
- R30, R31: a test of the list and of the layout route; a render of the layout route in `en` and in `vi`; `pnpm --filter @toki/i18n check`.
- R32, R35: `pnpm --filter ./apps/web build`, read the exit code; once by hand add `shell-fixture.html` to the `input` list and see `check:no-shell-fixture` fail and name the file; undo.
- By eye, once, recorded in the pull request (the comparison that a machine cannot make): the shell and the prototype side by side in the same window, Calm then Focus, at 360 by 560, 720, 800, 1099, 1100 and 1400 px, with the home section and with a panel open. The record is a table of twelve rows, each saying "matches" or naming the difference. The differences known beforehand are: the panel at 720 to 1099 px (the prototype squeezes), the exact 720 px width (the prototype is narrow), the 15 px text under 720 px (concern 2), the bottom tabs (F38 against the prototype), the toasts at 360 px (the prototype shows them at the top), the sections that are not in phase 1, and the scroll of the navigation at 560 px. The prototype's Look control is on its demo bar (D-145).
- A screen reader and the keyboard, by hand once with the fixture: Tab through the sidebar, the rail and the bottom bar; the landmarks (navigation, conversations, main, panel); the current item; a tab row with the arrow keys; opening a conversation at 360 px and hearing where focus lands.

## Data safety
- The shell keeps no state of its own beyond the focus it moves and the tab it selects, calls no storage or network API and puts no value in a URL or the console. `applyAppearance` writes three attributes on the page and nothing else.
- The fixture holds made-up names and no real address, key or customer data, and is not in the production build (R32).

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Blueprint work area: Design system | Planning fact; no design impact. |
| Belongs to Blueprint intent I02 design-system: every base component matches the prototype in Calm and Focus, in all three layouts | Tables C to I carry the prototype's rules with their lines; the layouts are R18 to R22; the by-eye record of Testing compares them with the prototype. The preview page itself is TOKI-016. |
| Milestone: M1, Foundation and design system | Planning fact; no design impact. |
| Size: L | The shell, nine small components, eight CSS tables, the fixture and a browser test. Concern 13 says it may take more than one session and gives an order. |
| Needs: TOKI-012 and TOKI-013 | The Button, IconButton and Badge of TOKI-012 and the Avatar, EmptyState and Toast pieces of TOKI-013 are used (R5, R8, R11, R23); the shared files and the test set-up are theirs. The plan should also list TOKI-009, TOKI-010, TOKI-011, TOKI-017, TOKI-006 and TOKI-008 (concern 11). |
| Needed by: TOKI-033 | R3 (a `list` slot), R20 (its column), R15 (its body), R30 (the route). |
| Agreed scope: three layouts, smallest size 360 x 560, side panels overlay the chat from 720 to 1099 px, the navigation and the tab row scroll, the conversation list is the main area of the sidebar | R18 (layouts), R21 (360 by 560), R19 (overlay), R20 and R14 with Table C (scroll), R20 (list is the main area). |
| No feature is hover-only or desktop-only | R17 (no hover-only rule); every entry point of the narrow layout is a link or a button (R5, R6, R11); what the wide layout keeps in the sidebar and the account card reaches a phone through the More tab, whose sheet is TOKI-092. |
| Toasts and floating bars never cover the composer or the navigation | R23, R24, R25, with the browser proof at six widths. |
| Every searchable or filterable list has an empty state centred in the content area | R15. |
| Every control is at least 40 px tall on a narrow screen | R21, Table G (`.tab` 40 px, `.nt` 48 px). |
| Every phase 1 screen is checked at 360 x 560, 719, 720, 1099 and 1100 px: nothing clipped, nothing unreachable | R18 to R21 and R33 for the shell; the screens add their own checks, using the fixture's widths. |
| Phase 1 has Home, Activity, Later, Files, People, Preferences, the command palette and the Admin page; the others are later | R10 and the table in Scope. |
| Both looks are built, English is the default language and every text is translated | R17 (both looks), R2 and R31 (no text in the shell, keys in both catalogs). |
| Look, accent and density apply at once; "Match my device" follows the device | R28; the saving to the account is TOKI-078. |
| The web styling is the prototype's CSS on CSS variables; no Tailwind and no runtime styling library | Tables C to I; R17. |
| The initial JavaScript stays under 200 KB compressed | R35. |
| TOKI-014 and TOKI-016 are written at the same time | The lines are drawn once in Scope (stacking, Escape, the More tab and the sheet that is TOKI-092's, the preview). |
| M1 exit check: the preview page matches the prototype at all three layouts | The components are TOKI-012, TOKI-013, TOKI-014 and the page TOKI-016; the shell's layouts are compared here (Testing, by eye; R33). |

## Open questions from the intent
- What does the shell build, and what does it leave to the screens that sit inside it? Answered: Scope, with an owner for each piece; the frames the screens share are built here (R11, R12, R13, R15). Decided in this spec.
- What does "narrow" measure, and is exactly 720 px narrow? Answered: the window, and no (R16, Design, "What the prototype does"). Decided in this spec. See concern 3.
- What does the shell build in place of the prototype's toast rule, the squeezed chat and the clipped navigation? Answered: R23 and R24; R19; R20. Decided in this spec, from measurements of the prototype.
- Which navigation items and tabs exist in phase 1, and what about F38 against the prototype? Answered: R5, R6, R10 and the table in Scope: the bar is Home, Activity, Later, Files, More (F38, D-091); the rows for features of later phases stay out. Decided in this spec. See concern 7.
- Who sets look, accent and density, and what shows before the account has loaded? Answered: R28, `applyAppearance`, called with the device's setting before the app is mounted; the account's values arrive with TOKI-078. Not answered: how to avoid the difference before the account loads (concern 10).

## Areas of concern
1. One number is not in the prototype or the log and was chosen to meet D-068: the Calm conversation column's floor of 240 px (its header and chips and about five rows). It was tested on the prototype's markup (Design, "The sidebar scrolls"). Its cost is that at 560 px the six Calm items scroll (185 px of items in 158 px); a floor of 200 px would let them fit and leave the list about 126 px of rows. Which of the two the product owner wants is a choice, not a fact. Owner: Thanh Truong.
2. The 15 px text under 720 px is built from a prototype rule that never applies: the prototype draws 14 px at every width (measured). Decided in this spec: build 15 px, because the rule is written in the prototype's narrow block and F38 asks for larger touch targets. It is not in the decision log, so it is a proposal for the product owner; if the answer is 14 px, remove the second row of Table I and the `font-size` check of R27. A by-eye comparison at 360 px will show the 1 px difference. Owner: Thanh Truong.
3. "Narrow" is the window width, and 720 px is not narrow (the prototype changes at 720 inclusive, with a container on its demo frame). Decided in this spec from D-068's wording "under 720px". It also settles concern 8 of TOKI-012: the base components and the shell use the same window width, so a preview that shows the shell at another width needs a window of that width, not a frame. Owner: Thanh Truong.
4. The side panel overlay (R19) has no scrim and no outside-click close: the chat behind it stays readable and usable beside it, the panel closes with its own button, and Back closes it first (D-089, TOKI-045). The log says "overlay" only. A scrim, if wanted, is a new rule. Owner: Thanh Truong.
5. The overlay panel covers the right 360 px of the chat, including the right part of the composer, from 720 to 1099 px. The toasts stay in the visible left part (R23), and a composer's send button may sit under the panel. The composer's layout in that case belongs to TOKI-043; the shell offers no variable for it. Not decided in the log. Owner: Thanh Truong.
6. The tab row hides its scroll bar, as the prototype does, so a mouse user without a trackpad scrolls it only with the keyboard or Shift and the wheel. With the three tabs of phase 1 the row does not overflow at 360 px in English; a longer Vietnamese label, or the custom tabs of phase 2, may. Proposal, not a decision: keep as the prototype; add a fade or arrows when a tab is cut off. Owner: Thanh Truong.
7. The bottom bar follows journey F38 (accepted in D-091), which differs from the prototype (Meet and Mail in the bar; Later, Files, Calendar, Tasks in More). The More tab appears only when TOKI-092 gives the shell its sheet; until then the bar has four tabs. F38 also lists "Search" in the More sheet, which the prototype's sheet does not have; that is TOKI-092's. Preferences is shown in the Focus rail and hidden in the Calm sidebar, as the prototype does (it is reached from the account menu in Calm, journey F06); no decision says Calm should hide it. Owner: Thanh Truong.
8. Four navigation keys are added with Vietnamese texts that no decision gives: `nav.main` "Điều hướng chính", `nav.accountMenu` "Menu tài khoản của bạn", `nav.back` "Quay lại", `nav.closePanel` "Đóng bảng bên". They are proposals (D-139: wording that the prototype does not contain; the prototype has the English only, as `aria-label`s). The Vietnamese of the ten existing `nav.*` keys it uses is the i18n spec's concern 2. Owner: Thanh Truong.
9. The account card, the workspace header and the head count are drawn from props and wired by other tickets: the signed-in person and the status or role line by TOKI-099, the head count by TOKI-033 (with the bootstrap store), the badges' numbers by TOKI-054. None of those plan lines says so. Until they are built the shell shows no card, no head count and no badge. Plan change requested: TOKI-099 needs TOKI-015; TOKI-033 and TOKI-054 name the shell's props. Owner: Thanh Truong.
10. The first paint. `tokens.css` follows the device before `data-eff` is set; `applyAppearance({ look: "device" })` runs before the app is mounted but after the first paint can happen, so a person whose saved look differs from the device may see the other look for a moment, as the tokens spec (concern 10) and the prototype do. This spec adds no inline script and no copy of the last look in the browser; the inline script would need a content security policy decision that the Blueprint does not make. The platform spec leaves the reading of the device's light or dark setting to TOKI-078; this ticket needs it earlier (the Focus layout depends on `data-eff`), so `applyAppearance` reads it, and TOKI-078 uses the same function. Owner: Thanh Truong.
11. The plan lists only TOKI-012 and TOKI-013 as needs. Decided in this spec, plan change: TOKI-015 also needs TOKI-009 (tokens), TOKI-010 (fonts), TOKI-011 (icons), TOKI-017 (keys), TOKI-006 (router) and TOKI-008 (Playwright). It does not need TOKI-014: the shell mounts no overlay. TOKI-092 (More sheet) and TOKI-099 need TOKI-015; the plan lists TOKI-071 and TOKI-076 for TOKI-092. The TOKI-013 spec's concern 9 says TOKI-016 needs TOKI-015; the TOKI-016 spec says it does not, and this spec agrees with it: the page is beside the shell. Owner: Thanh Truong.
12. This spec changes four files of earlier tickets: `index.html` (viewport meta, TOKI-006), the index route's place (TOKI-006; its page is unchanged), `main.tsx` (imports and one call; TOKI-012 R29, TOKI-018 R26) and the catalogs of TOKI-017. The order test of TOKI-012 R29 is extended by two files. Owner: Thanh Truong.
13. The size. The Blueprint says L; this spec has 35 requirements, eight CSS tables, a fixture page and a browser test. Proposal, not a decision: build in this order and stop after any step if needed: `utilities.css`, `app.css`, `applyAppearance`; the wide layouts and the section list; the narrow layout and the bottom bar; the panel overlay, the navigation scroll, and the toast places; the tab row, the section page and the side panel frame; the fixture and the browser test. Owner: Thanh Truong.
14. The sections' paths (`/activity`, `/later`, `/files`, `/people`, `/preferences`, `/admin`) are chosen here so that the tickets agree; the log says only that every section has its own address (D-089). The prototype's hashes are `#prefs` and the others by name; `/preferences` follows the label. The conversation and thread paths belong to TOKI-033 and TOKI-045. Owner: Thanh Truong.
15. Utility classes keep the prototype's short names, and `.sm`, `.xs`, `.row` and `.title` can collide with component classes (`.btn.sm`, `.chip.sm`) and with the screens' CSS. Accepted, as TOKI-012 concern 7. `.kbd` is left to TOKI-071; the search box's `.srch .kbd` carries the font itself. Owner: Thanh Truong.
16. The shell root is `position:fixed` and the narrow rules use the safe-area insets, which need `viewport-fit=cover`. This was not tried on a real phone while writing this spec; the browser test uses insets of 0. Proposal: look once on an iPhone installed to the home screen (D-108) before M1 is closed. Owner: Thanh Truong.
17. The bottom bar is hidden with `visibility:hidden` after its transition, which is new against the prototype (it stays reachable by keyboard while moved out of sight). A screen reader user at 360 px in a conversation therefore has no tabs until Back. That is the intent of F38 ("hides the tab bar") but is not stated for assistive technology. Owner: Thanh Truong.
