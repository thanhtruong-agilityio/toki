# Accessibility pass design

Date: 2026-11-26 · Status: draft for review
Intent: docs/intents/accessibility-pass.md (Thanh Truong)
Ticket: TOKI-083

## Goal
A person who uses only a keyboard, a screen reader or a device set to reduce motion must be able to do everything in phase 1 that a person with a mouse can (outcome I14: "usable by keyboard, with a state for every situation"). The pieces of the app already carry their own rules (names, focus traps, arrow keys, a live region for toasts). This ticket looks at the finished app as a whole: it builds the audit that proves those rules hold on every screen, closes the gaps that only show in the whole (a screen change that is silent, focus that is not moved after a jump, a motion that is not stopped), and writes down what it cannot fix without a product decision.

## Scope
- In:
  - The audit: an axe scan of every screen and state of Table A in the browser runner of TOKI-008, in both looks, both languages and two widths (R1 to R4); the contrast of the token pairs, computed (R5).
  - Keyboard-only runs: each dialog and menu of Table C (R6, R7), the keys of Table B (R8), reachability with no trap (R9), a visible focus that is not covered (R10).
  - Three small builds: focus to the message after a jump (R11), an announcer for a screen change (R12) with the unread count at an opening (R13, a proposal).
  - Reduced motion: a test of every motion in Table F (R14), no scripted smooth scrolling (R15), the flash of a jump under reduced motion (R16, a proposal).
  - Live regions: which exist and which must not (R17).
  - The manual screen reader pass and its record (R18); where findings go (R3, R19).
- Out (not now):
  - Changing a colour. The prototype's colours are the tokens (TOKI-009 concern 5); a target that needs a colour changed is a change of `@toki/tokens` in its own ticket after the owner decides (concern 2).
  - New shortcuts, a shortcut help screen, a skip link (Design, "Decided in this spec").
  - `forced-colors`, `prefers-contrast`, 400% zoom, the text-spacing override and reflow at 320 px (concern 1).
  - Firefox and WebKit in the runner (TOKI-008 concern 5); a screen reader is used by hand (R18).
  - The Meet, Mail, Tasks and other later-phase screens of the prototype (scope box "Later phases"), the Guest portal (D-152), and every demo-only piece (D-145).
  - Every text of the interface: this ticket adds no visible text (R12, R13 reuse existing keys).

## What each owner keeps
- The per-component rules stay with the ticket that builds the component: names, focus trap and return (TOKI-014 R5, R12, R13, R20 to R22), the tab keys (TOKI-015 R14), the palette's combobox (TOKI-071 R3), the composer's Enter (TOKI-043 R2), the mention list (TOKI-050 R14), the message list's scroller (TOKI-041 R24), the row and its bar (TOKI-042 R19, TOKI-052 R5, R7, R21), the toast region (TOKI-013 R19, R21, R23), the status lines of extra states (TOKI-082 R2, R5, R8). This ticket does not rewrite them. It tests them in the whole app, and a failure it finds is fixed in the code of that component, in this ticket's pull request, when the fix keeps the decided look, text and behaviour (R19).
- The `lang` attribute and its switch: TOKI-078 R10. This ticket checks it (R4).
- The jump and its flash: TOKI-068. The focus after the jump and the flash under reduced motion are handed to this ticket by TOKI-068 (Scope, Out; concern 4 there); R11 and R16 build them.
- The tab title: TOKI-054 R5. This ticket changes nothing there (concern 6).

## Requirements
- R1. The states. `e2e/accessibility/states.ts` exports `STATES`, one entry for each row of Table A: an `id`, the route, the `look`-independent steps that reach the state (stubbed network answers of `e2e/support`, the stubs of TOKI-041 R25, the keyboard or pointer steps to open an overlay), and the signed-in role. A unit test (`apps/web/tests/a11y/states.test.ts`) fails when a row of `sections` in `apps/web/src/layout/sections.ts` has no state whose route matches it, when a route of `router.tsx` has none, and when two states share an id. A new section or route therefore cannot be added without a state.
- R2. The scan. `e2e/support/axe.ts` exports `expectNoViolations(page, label, stateId)`. It runs `AxeBuilder` of `@axe-core/playwright` (already a dev dependency, used by `e2e/sign-in.spec.ts` and `e2e/join.spec.ts`) with the tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` and `best-practice` and with the rule `label-content-name-mismatch` switched on. It drops the violations that the register of R3 lists for `stateId`, and fails with one line `rule: selector` for each that is left. `e2e/accessibility/axe.spec.ts` calls it for each state of R1 in each cell of Table E. The two older specs import the helper in place of their own copy of the tag list (the only change to them).
- R3. The register. `e2e/accessibility/known-findings.ts` holds the findings that this ticket does not fix, one entry each: `state` (an id of R1), `rule` (the axe rule id), `target` (a selector, optional), `reason` (what and why), `owner` (a person or ticket) and `concern` or `ticket` (where the fix is decided). A unit test fails for an entry with a missing field, with a `state` that is not in R1, and for an entry whose `rule` is one of `button-name`, `link-name`, `input-button-name`, `label`, `select-name`, `aria-input-field-name`, `aria-toggle-field-name`, `aria-command-name`, `aria-dialog-name`, `image-alt`, `role-img-alt`, `html-has-lang` and `html-lang-valid`: a missing name or language is never waived (D-075, NFR-03, NFR-05). The scan of R2 also fails when an entry for its state matched nothing ("no longer a finding: remove the entry"), so the register cannot go stale. The register is empty when the ticket is built if every finding was fixed.
- R4. Language. For each state, one cell of Table E runs with the account's language `vi`. The test also checks `document.documentElement.lang` is `en` for English and `vi` for Vietnamese in the same run, and that after the language is changed in Preferences without a reload it changes with it (TOKI-078 R10). `html-has-lang` and `html-lang-valid` are in the scan and cannot be waived (R3).
- R5. Contrast of the tokens. `packages/tokens/tests/contrast.test.ts` (Vitest, no browser) computes the WCAG contrast ratio `(L1 + 0.05) / (L2 + 0.05)`, `L = 0.2126 R + 0.7152 G + 0.0722 B` on linearised sRGB, for each pair of Table D in Calm and Focus and, for the pairs that use an accent, for each of the four accents, from the values of `packages/tokens/src/tokens.ts`. A pair that has a translucent colour is composed over its surface first. It fails when a pair is under its target (4.5 for text, 3 for a focus ring and a boundary of a control; concern 1) and it is not listed in `packages/tokens/tests/contrast-known.ts` with its ratio and its owner, and fails when a listed pair is now at or above the target. The browser scan of R2 reads the real rendered colours (`color-contrast`); this test reads the tokens, so a colour that no state of Table A shows is still checked.
- R6. Dialogs. `e2e/accessibility/overlays.spec.ts`, for each dialog of Table C (O01 to O11): the dialog is opened with the keyboard only (Tab to the opener, Enter or Space; for the palette Ctrl+K); focus is inside the dialog at once, on the element TOKI-014 R11 or the owner chose; Tab and Shift+Tab pressed more times than the dialog has tab stops never leave it (TOKI-014 R12); Esc closes it, except where Table C says the owner asks first or ignores Esc; and after closing, `document.activeElement` is the opener, or, where Table C names a fallback (the opener left the page), the element with `data-focus-fallback`. In every case `document.activeElement` is never `document.body` after a close. For O10 (the "session ended" cover) Esc does nothing and focus stays inside. NFR-03's "keyboard-only run of each modal and menu" is this requirement and R7.
- R7. Menus. For each menu of Table C (M01 to M06), opened by keyboard: focus is on the first item that is not disabled (TOKI-014 R20); ArrowDown and ArrowUp move and wrap; Home and End go to the first and the last; a disabled item is reached and Enter on it does nothing; Enter and Space choose the focused item and focus goes to the opener (TOKI-014 R21) unless the choice opens a dialog, which then returns focus to that opener (R6); Esc closes the menu and focus is on the opener. A source test lists every file of `apps/web/src` and `packages/ui-web/src` that renders `Menu` or calls `useMenuTrigger` and fails for a file that no row of Table C names, so a new menu cannot ship without its run.
- R8. Keys and keyboard-only runs. `e2e/accessibility/keyboard.spec.ts` follows Table B row by row and checks each result in the browser (a key, where, what happens). It then does the ten tasks of Table G with the keyboard alone (no pointer event is sent: the test fails if the page receives one) from a signed-in start, in Calm at 1280 px; a task that needs a second person uses the stubs.
- R9. Reachability, no trap. For each state of R1 with no overlay open, the test presses Tab from the top of the page until focus leaves the document or returns to the first stop, with a limit of the number of focusable elements plus 5, and records the elements focused. It fails when the limit is reached (a trap) and when a visible, enabled element that is a tab stop by its role is not in the record. The elements that are not tab stops by design are listed by role, not by selector: the tabs of a `tablist` that are not selected, `menuitem` and `option` rows (TOKI-015 R14, TOKI-014 R20, TOKI-071 R3). An element with `aria-disabled="true"` is a tab stop (TOKI-014 R18; TOKI-078 notes on `aria-disabled`). The same walk runs at 360 by 560 px, where the panes that are not shown have `visibility:hidden` and must not be in the record (TOKI-015 R22).
- R10. Focus is visible and not covered. For each stop of the walk of R9: the focused element has an outline of at least 2 px or a box shadow (the base rule `:focus-visible`, `2px solid var(--accent)`, TOKI-012), except the panel of a dialog (`.modal:focus-visible`, TOKI-014 Table A) and the elements in one list in the test with the reason; and the point at the centre of its box, after the browser has scrolled it into view, is the element or inside it (`document.elementFromPoint`), so no sticky bar, bottom tab bar, toast or strip covers it (WCAG 2.2 criterion 2.4.11, concern 1).
- R11. Focus after a jump. In `apps/web/src/conversation/jump/`, when `startFlash` sets a flash (TOKI-068 R9, R10) and the row has drawn `data-target="true"`, an effect of `JumpProvider` calls `.focus({ preventScroll: true })` on `.message-outer[data-target="true"] > .message` (the inner box of the row, a tab stop with `role="group"` and a name, TOKI-052 R7). It does not do so when an element with `aria-modal="true"` is in the document, and does nothing when no such row is found. The jump never scrolls twice: `preventScroll` keeps the position that the list chose (TOKI-041 R14). A screen reader reads the name of the group (author and time, TOKI-042) and then the text; no extra text is spoken. Check: a jump from the palette, from a search result and from a file card ends with `document.activeElement` equal to that box and the box in view; with a dialog open nothing moves.
- R12. The announcer. `apps/web/src/a11y/` holds `Announcer.tsx`, `useAnnounce.ts` and `useScreenName.ts`. `AppShellRoute` mounts one `AnnouncerProvider` that renders its children and, after them, one `div.sr` with `role="status"` that is in the document from the first render and empty. `useAnnounce()` returns a stable `announce(text)` that sets the text of that region. A `ScreenAnnouncer` inside the provider watches the location. When the screen changes, it calls `announce` with the name of the new screen: the page's own name when the page called `useScreenName(name)` (the conversation page calls it with the conversation's display name, as the header draws it, once the store holds it; the not-found view of TOKI-082 calls it with its title), otherwise `t(row.labelKey)` of the row of `sections.ts` whose `match` takes the path. The screen is the section, and for Home the conversation: opening or closing a thread, changing the tab of a conversation, and a change of the query do not announce. The first render after sign-in does not announce (a page load is announced by the browser). No focus is moved (the shell already moves focus on narrow screens, TOKI-015 R29, and this ticket leaves it as it is). The region is outside every `aria-hidden` and `inert` area: it is skipped by the isolation of TOKI-014 R15 like the toast region (`data-layer-skip`, TOKI-014 R34), so a screen change made while an opaque cover is open is still announced. Check: render tests of the provider (empty region from the first render, one announce sets the text, a second replaces it) and of the watcher with a memory router (Activity then Later gives the two labels; `/c/a` then `/c/a/t/m` gives one; a conversation whose name arrives late announces when it arrives); and the browser test (R17).
- R13. The unread count at an opening (proposal, concern 4). When the conversation page opens a conversation and `useNewDivider` (TOKI-054 R7) gives a `newFromId` and the slot count is above 0, the page calls `useScreenName(name, detail)` with `detail` `t("common.unreadCount", { count })` (the key of TOKI-054 R11, "{count} unread") and the announcer says `{name} · {detail}`, with the separator the prototype uses between a name and its detail. Nothing is announced for a message that arrives while the conversation is open (concern 4). No new key. Check: render test with a count of 3, one, and none.
- R14. Reduced motion, every motion. `e2e/accessibility/motion.spec.ts` emulates `reducedMotion: "reduce"` and triggers each row of Table F. For each, `document.getAnimations()` holds no animation or transition whose computed duration is above 0.01 ms or whose iteration count is above 1. A control run without the emulation, for the skeleton, the toast and the shell panel, finds an animation longer than 100 ms, so the check proves that it can see these motions. The test also reads the stylesheet of the page and fails when a rule that sets `animation` or `transition` is not under the global rule of `base.css` (TOKI-012 Table J) or its own `prefers-reduced-motion` block: that is, it lists every `animation-name` in use and checks each is covered by the global rule. No row of Table F is checked with a real timer: time is moved with `page.clock` as `e2e/parity/screens.spec.ts` does.
- R15. No scripted motion. A source test (`apps/web/tests/a11y/no-smooth-scroll.test.ts`) fails when a file of `apps/web/src` or `packages/ui-web/src` contains `behavior: "smooth"`, `behavior: 'smooth'` or `scroll-behavior: smooth` (the CSS rule of `base.css` cannot stop a script's scroll, so scripted smooth scrolling is not allowed unless it first reads `matchMedia("(prefers-reduced-motion: reduce)")`; a file that does so is listed in the test with the line). Check: the test finds a planted `scrollTo({ behavior: "smooth" })` in a temporary file.
- R16. The flash under reduced motion (proposal, concern 3). In `flash.css` of TOKI-068, a block `@media (prefers-reduced-motion: reduce)` gives `.message-outer[data-target="true"] > .message` `animation: none` and `background-color: var(--accent-soft)`. The tint stays as long as the attribute does (2 seconds, TOKI-068 R9) and is gone with it. Without the preference nothing changes. Check: with reduced motion emulated and a jump, the computed background of the row is the `--accent-soft` of the look while `data-target` is set, `getAnimations()` has no `toki-flash`, and after the clock has moved 2 seconds the background is the row's own; without the emulation the animation `toki-flash` runs.
- R17. Live regions. A browser test counts, in each state of R1, the elements with `aria-live`, `role="status"`, `role="alert"` or `role="log"` and compares them with the expectation of the state: the toast region (one, `aria-live="polite"`, in the document from the first render, TOKI-013 R21), the announcer (one, R12), `role="alert"` on the error of a field or a dialog line (TOKI-012 R17, D-104), `role="status"` on a loading or offline line (TOKI-082 R5, R8), a filtered empty state (TOKI-013 R15) and the archived notice (TOKI-101). It fails for a live region the expectation does not list, and fails when the message list's scroller or `.typing` (the typing line) holds one: the list is not a live region and not `role="log"` (TOKI-041 R24) and the typing line has no `role` and no `aria-live` (TOKI-044 R15). It also checks that a toast shown while an opaque dialog is open is in the region (TOKI-014 R34).
- R18. The manual pass. Once, before the pull request is ready, with VoiceOver in Safari on macOS and NVDA in Firefox on Windows, in English and Vietnamese, the builder does the eight tasks of Table H, writes the result for each (heard, not heard, wrong) and files it in the QA record `docs/qa/TOKI-083.md` (layer `manual`). A task whose result is "not heard" or "wrong" is fixed or written in the register of R3 with the reader and version. Evidence holds no customer data.
- R19. Where the findings go. A finding of R2 to R10 and R17 is handled in this order: (1) fixed in the code that owns it, in this ticket's pull request, when the fix changes no decided look, text, size or behaviour; (2) otherwise written in the register of R3 with an owner and the concern or ticket that decides it; (3) the pull request lists the count of each and the entries of the register for the reviewer. A fix is never made by lowering an expectation, by adding a selector to an exclusion that the test does not already list with a reason, or by `aria-hidden` on a control to silence a rule. Check: the register unit test of R3 and a review of the pull request.
- R20. The runner and the cost. The audit files are ordinary Playwright files in `e2e/accessibility/` and run in the `end-to-end` job of TOKI-007 and TOKI-008 R14 by `pnpm test:e2e` (Chromium only, no extra job, no new command); `contrast.test.ts` and the unit tests run in `pnpm test`. The scan runs the cells of Table E in parallel with the runner's workers. A cell that fails prints its state id, look, width and language. Check: a throw-away branch with one unnamed icon button makes the job red and names the state.

## Design

### What is audited and what is built (Decided in this spec)
| Check | Audited by a tool | Built or fixed here |
| :---- | :---- | :---- |
| Names, roles, labels, `lang`, landmarks, tab order basics | axe in the browser (R2, R4) | Only a defect that the scan finds |
| Colour contrast | axe on rendered colours (R2) and the token pairs (R5) | Nothing: a colour change is its own ticket (concern 2) |
| Keys, focus trap, focus return, reachability, no trap | Playwright keyboard runs (R6 to R10) | Defects found |
| Focus after a jump | Playwright (R11) | R11 |
| Screen change and unread count announced | Playwright and render tests (R12, R13, R17) | R12, R13 |
| Reduced motion | Emulated media and `getAnimations()` (R14), source test (R15) | R16 (proposal) |
| What a screen reader actually says | Nobody: by hand (R18) | Defects found |

Reasons, all Decided in this spec. axe runs in the browser and not in jsdom because contrast, visibility and focus need real layout; `@axe-core/playwright` is already a dev dependency and the tag list is the one `e2e/sign-in.spec.ts` already uses, so the audit extends what exists. `eslint-plugin-jsx-a11y` is not added: `icon-only-button-name` already exists and was chosen over it because the plugin cannot know that an `Icon` component draws a hidden image (TOKI-012 R22 and its concern), the plugin's supported ESLint versions were not checked against the ESLint of this repository, and the audit sees the rendered result that a static rule cannot. `jest-axe` is not added for the same layout reason.

### Screens in scope (Table A)
Every screen of phase 1 and each state that has its own markup, in the roles that see it. "Skeleton, empty, failed" are the states of TOKI-082 R8 to R10.

| Id | Screen or state | Route | Role | Specs it comes from |
| :---- | :---- | :---- | :---- | :---- |
| S01 | Sign-in: email step, code step, code step with a message, "session ended" cover | `/login` | none | TOKI-023 (already scanned there; kept here so the matrix is whole) |
| S02 | Join page (invitation) | `/join` | none | TOKI-097 |
| S03 | Emergency access page | `/emergency` | none | TOKI-026 |
| S04 | Conversation list: Calm sidebar, Focus column, narrow list pane; skeleton, empty, failed | `/` | Member | TOKI-033, TOKI-082 |
| S05 | A channel: Messages tab with the New divider, a pending and a failed message, a deleted one, the typing line; skeleton | `/c/:id` | Member | TOKI-041, 042, 043, 054, 044 |
| S06 | Files tab, Pinned tab of a channel | `/c/:id` | Member | TOKI-063, TOKI-048 |
| S07 | A direct message; the person is paused; the other person is deactivated | `/c/:id` | Member | TOKI-035, TOKI-076 |
| S08 | Thread panel; details panel; profile panel | `/c/:id/t/:rootId` | Member | TOKI-045, 100, 035 |
| S09 | A channel not joined; a private channel with no access; an archived channel | `/c/:id` | Member | TOKI-034, TOKI-101, TOKI-082 R9 |
| S10 | Activity: each filter chip, empty, snoozed view | `/activity` | Member | TOKI-066 |
| S11 | Later: each chip, empty | `/later` | Member | TOKI-067 |
| S12 | Files section | `/files` | Member | TOKI-063 |
| S13 | People; a person's panel | `/people`, `/people/p/:id` | Member | TOKI-079 |
| S14 | Preferences, in full, in each look and with each accent chosen | `/prefs` | Member | TOKI-078, TOKI-099 |
| S15 | Admin: Members, Channels, the disk notice | `/admin` | Admin | TOKI-025, TOKI-103 |
| S16 | Not-found and no-access page | any unknown address | Member | TOKI-082 R9 |
| S17 | Strips: Pause or Focus, offline, update available, archived notice | on S04 and S05 | Member | TOKI-076 R18, TOKI-082 R5, TOKI-104 |
| S18 | Toasts: plain, with Undo, three at once | on S05 | Member | TOKI-013, TOKI-093, TOKI-075 |
| S19 | The More sheet and the bottom bar | `/` at 360 px | Member | TOKI-092, TOKI-015 |
| S20 | Every dialog and menu of Table C, open | on the screens above | Member, Admin | Table C |

The component preview page of TOKI-016 is a development page that the production build does not include (`check-no-dev-pages.mjs`); it is not scanned. A state that a spec of this wave adds after this one is written (extra states, the update strip, People, the More sheet) is in the table by the name its spec gives it; if a name differs when they are built, the row follows the built name (R1's unit test is the net).

### The matrix (Table E)
Every state of Table A runs in the cells marked "all". The widths are 1280 by 800 (wide) and 360 by 560 (narrow, the smallest supported size, NR2; the three bands of D-068 are the parity check's, TOKI-109, and not repeated). English unless the cell says `vi`. The accent is teal and the density the look's default unless the cell says otherwise.

| Cell | Look | Width | Language | Accent and density | States |
| :---- | :---- | :---- | :---- | :---- | :---- |
| E1 | Calm | wide | en | default | all |
| E2 | Focus | wide | en | default | all |
| E3 | Calm | narrow | en | default | all except S19 is narrow only |
| E4 | Focus | narrow | en | default | all |
| E5 | Calm | wide | vi | default | all (R4) |
| E6 | Calm and Focus | wide | en | each of indigo, clay, violet | S05, S10, S14, S18 |
| E7 | Calm | wide | en | compact density | S04, S05, S13 |

That is 4 cells of all states, 1 in Vietnamese, 6 accent runs of 4 states and one density run. Density is not offered on a narrow screen (TOKI-078 R5), so it has no narrow cell.

### Keyboard map (Table B)
What the app's keys are, from the specs, and what R8 checks. There are no other shortcuts: the log has none beyond Ctrl+K (F29), and the text tools have none (TOKI-049 Scope). Nothing here is new.

| Key | Where | Result | Source |
| :---- | :---- | :---- | :---- |
| Tab, Shift+Tab | Everywhere | Moves between tab stops in the document order; no stop is skipped (R9); a dialog traps them | TOKI-014 R12 |
| Ctrl+K, Cmd+K | Anywhere, a text field too; not while another dialog or menu is open | Opens the palette; the same key closes it | TOKI-071 R1 |
| ArrowDown, ArrowUp | Palette | Next and previous result, wrapping; the field keeps focus; Enter runs it; Home and End stay with the field | TOKI-071 R3 |
| Enter, Esc | Palette | Run the active row and close; close | TOKI-071 R3, R9 |
| Esc | Any dialog or menu | Closes the top layer only; focus returns (R6, R7) | TOKI-014 R9 |
| Esc | Side panel (thread, details, profile) | Closes it when no menu or dialog is above | TOKI-015 R11 |
| ArrowDown, ArrowUp, Home, End, Enter, Space | Menus | As R7 | TOKI-014 R20, R21 |
| ArrowRight, ArrowLeft, Home, End, Enter, Space | Tab row (`tablist`) | Moves focus without selecting; Enter or Space selects; only the selected tab is a tab stop | TOKI-015 R14 |
| Enter | Composer | Sends; Shift+Enter makes a line; an Enter that ends an input-method word never sends | TOKI-043 R2 |
| ArrowDown, ArrowUp, Enter, Tab, Esc | Mention list in the composer | Move, insert, close the list only | TOKI-050 R14 |
| Arrows, Page Up, Page Down, Home, End | Message list (the scroller is a tab stop) | Scroll; End loads and reaches the end | TOKI-041 R24 |
| Tab into a message | Message row | The row takes focus, its action bar shows (`:focus-visible`) and its buttons are the next stops | TOKI-052 R5, R7 |
| ContextMenu, Shift+F10 | A reaction chip | Opens the list of who reacted | TOKI-046 R18 |
| Enter, Space | A row that is `role="button"` (Activity, Later) | Do what a press does; a press on a button inside the row does not | TOKI-066 R9, TOKI-067 R18 |
| Enter, Space | Chips, Look cards, accent swatches, switches | Press; `aria-pressed` or `aria-checked` follows | TOKI-012, TOKI-078 R3, R4 |
| Tab | A toast | The pointer over it or focus in it holds its timer; leaving restarts the full time | TOKI-013 R23 |
| Enter, Esc | Attachment window | Press the focused button; close, focus to the card (or the fallback) | TOKI-062 R19 |
| Tab into the last row | Admin and People lists | Asks for the next page, so a keyboard reaches every row | TOKI-025 R9, TOKI-079 R8 |

### Dialogs and menus (Table C)
| Id | Layer | Opened from | Notes for the run |
| :---- | :---- | :---- | :---- |
| O01 | Command palette | Ctrl+K; the Search box; the More row | Returns to the element that had focus (or the More tab) after the close-then-run rule (TOKI-071 R9) |
| O02 | Browse channels | The list's header button and the "+" | `returnFocusRef` is the pressed control (TOKI-033) |
| O03 | New message (people picker) | The list's "+" | Same |
| O04 | Create channel | Admin only; the list and the palette | The guard asks first when the form has content (TOKI-093); Esc then opens the confirmation and the answer returns focus |
| O05 | Set status | The account menu or the More sheet | Returns to the account card, or the More tab on narrow |
| O06 | Invite | Admin members section | Guard as O04 |
| O07 | Confirm (leave, archive, deactivate, delete a message, end other sessions) | The menu or button that asked | The opener may leave the page (a deleted row): the fallback of `data-focus-fallback` (TOKI-042 R9) |
| O08 | Attachment window | A file or image card, a row of Files | The card may be unmounted (virtual list): the fallback (TOKI-062 R10) |
| O09 | More sheet | The More tab, narrow only | Returns to the More tab (TOKI-092 R2) |
| O10 | "Session ended" cover | A 401 | Opaque, no close button, Esc ignored, no focus return, focus inside (TOKI-023, TOKI-014 R15, R16) |
| O11 | Reaction picker | The action bar and a chip's "+" | A frame of Menu with its own keys (TOKI-046); run as a dialog for focus return |
| M01 | Account menu | The account card | Entries of TOKI-099 R3 |
| M02 | Message More menu | The action bar | TOKI-052 |
| M03 | Admin row menu | A row of Members or Channels | TOKI-025 (`RowMenu`) |
| M04 | Time choices (Snooze, Remind) | Activity and Later rows, the action bar | TOKI-066 and TOKI-067 shared menu body |
| M05 | Conversation row menu | The list's row actions (`list-actions.tsx`) | TOKI-033 |
| M06 | Details panel menus (notification level, member row) | The details panel | TOKI-035, TOKI-100 |

The list is the first draft: the source test of R7 is the guard, and the build adds a row for any menu it finds that is not here.

### Contrast pairs (Table D)
Targets are proposals until concern 1 is answered: 4.5 to 1 for text, 3 to 1 for a focus ring and the edge of a control. Ratios below were computed in preparing this spec from `tokens.ts` with the formula of R5 and are the first values of the test; the build recomputes them.

| Pair | Calm | Focus | Target |
| :---- | :---- | :---- | :---- |
| `ink` on `bg` | 15.07 | 15.91 | 4.5 |
| `muted` on `bg`, `surface`, `surface2` | 5.40, 5.98, 5.61 | 7.13, 6.57, 6.02 | 4.5 |
| `ink2` on `surface` | 9.96 | 11.16 | 4.5 |
| `accentText` on `surface` (every accent) | 7.74 to 9.93 | 11.64 to 12.74 | 4.5 |
| `onAccent` on `accent` (every accent; the primary button) | 4.99 to 6.29 | 8.02 to 11.56 | 4.5 |
| `accent` on `bg` (the focus ring, every accent) | 4.50 to 5.68 | 9.45 to 12.73 | 3 |
| `danger` on `dangerSoft` and on `surface` | 5.58, 6.57 | 5.78, 6.23 | 4.5 |
| `mentionInk` on `mentionBg` over `surface` | 8.08 | not computed (translucent) | 4.5 |
| `onLive` on `live` | 5.18 | 8.49 | 4.5 |
| The toast's action label on the toast (`--ink`) | `accentSoft`: 13.40 to 13.97 | `accent`: 1.25 (teal), 1.68 (indigo), 1.41 (clay), 1.56 (violet) | 4.5 |

The one pair that fails is the Undo label of a toast in the Focus look (the colours are the prototype's, TOKI-013 R20 and its concern 3). It goes in `contrast-known.ts` with owner Thanh Truong and concern 2. The pair `muted` on `hover` and the other pairs that draw a translucent colour over a surface are computed over the surface in the test; the numbers are not given here.

### Motion (Table F)
| Row | Motion | Source | What the run does |
| :---- | :---- | :---- | :---- |
| F1 | Every `animation` and `transition` | Global rule of `base.css` (TOKI-012 Table J) | Reads the sheet (R14) |
| F2 | Skeleton pulse `sk-pulse` | TOKI-082 R2 | Opens a state with a skeleton (S04) |
| F3 | Toast slide-in `tin`, 0.18 s | TOKI-013 R20 | Shows a toast |
| F4 | Side panel `shell-slide-in` and the pane transitions, 0.18 s | TOKI-015 R22 | Opens the thread panel; narrow: a pane change |
| F5 | The typing line's blinking dots | The typing line (TOKI-044 R15) | Opens S05 with a person typing |
| F6 | The flash of a jump, `toki-flash` | TOKI-068 R11 | A jump (R16) |
| F7 | The shake of the code field | TOKI-023 R16, R33 | A wrong code |
| F8 | Hover and press transitions of buttons, chips, rows, switches | The prototype's `.15s` rules | A hover and a press on each kind |

### The announcer and the focus call
`apps/web/src/a11y/` is a new folder of three small files. The provider and the region are mounted once by `AppShellRoute`, beside `AccountHost`, inside the shell's toast provider. The watcher uses the router's location and the `sections` list; the conversation page and the not-found view are the only callers of `useScreenName`. The region's text is the name of a screen that already exists on the screen (a section's label, a conversation's name), so no text is added, and it is read in the language of the page. The jump's focus call is one effect in `JumpProvider.tsx` that reads the flash store; it adds no state to the store.

### Decided in this spec
- No skip link. The shell has landmarks (`nav`, `aside`, `main` with `tabIndex={-1}`, TOKI-015 R3), which satisfy bypassing blocks, and axe's `bypass` rule passes on a page with a `main` landmark. A skip link is a visible element the prototype does not have (D-139) and every landmark can already be reached by a screen reader.
- No focus move on a screen change on wide screens. The announcer says where the person is; moving focus away from the list when the person presses an item of it would break arrowing through conversations. On narrow screens the shell moves focus to the pane (TOKI-015 R29), unchanged.
- No new shortcuts. The log has Ctrl+K only; any other (Undo, composer focus, list arrows) is a feature and is concern 5.
- The register lives in code (`known-findings.ts`, `contrast-known.ts`) and is read by the tests, the way `e2e/parity/known-differences.ts` is, so a finding is tied to a state and an owner and goes stale loudly.
- Chromium only in the runner; the screen readers by hand (R18). A cell fails the job; there is no "warning" level.

## Testing
- Written first: the register test (R3), the states test (R1), the contrast test with a planted failing pair (R5), the source tests (R7's list, R15 with a planted file), the announcer render tests (R12, R13), and a Playwright test of the audit against a page with one unnamed button to see it fail.
- R2, R4: `e2e/accessibility/axe.spec.ts`, the cells of Table E. R6, R7: `overlays.spec.ts`. R8 to R10: `keyboard.spec.ts`. R11 to R13, R17: `announce.spec.ts` (a jump from the palette, a search result and a file card; a screen change by the sidebar, the palette and the bottom bar; counting live regions). R14, R16: `motion.spec.ts` with `page.clock`. No real timer is used for any time rule; the toast hold (Table B) uses the clock to move 10 seconds with focus inside and 5 seconds after it leaves.
- Each requirement has at least one failing case before the build: R3 a missing field, R6 a dialog that returns focus to `body`, R9 a `tabindex` trap, R10 a fixed bar over a focused element, R14 a transition with no reduced-motion rule, R15 a planted smooth scroll.
- R18 is by hand and recorded (Table H). R20 is checked by a throw-away branch with one unnamed icon button, which turns the `end-to-end` job red and names the state.
- Fake data only; the stubs of `e2e/support`.

### The ten keyboard-only tasks (Table G)
1. Open a conversation from the list and send a message with Enter; add a line with Shift+Enter.
2. Open the palette with Ctrl+K, search, choose a result with the arrows and Enter; focus ends on the message (R11) or the page.
3. Tab to a message, open its More menu, choose Edit, press Esc.
4. Open a thread from a message, reply, close the panel with Esc.
5. Open the reaction picker, choose an emoji, then list who reacted with Shift+F10.
6. In Activity, open an item with Enter and another with Space; mark one done.
7. Open Preferences, change the look with Space, turn a switch on and off.
8. As an Admin, open Invite, fill the address, send, and be back on the opener.
9. Open a file in the Files tab, close the window with Esc, be back on its row.
10. At 360 px, open the More sheet, choose Preferences, hear the screen's name (R12).

### The manual pass (Table H)
With VoiceOver and Safari, then NVDA and Firefox, in English, and tasks 1, 2 and 7 again in Vietnamese: (1) sign in and hear the heading; (2) move through the list and hear a conversation's name and its unread count; (3) read a channel: author, time, text, a day line and the New line; (4) send a message; (5) hear a toast with Undo added; (6) open and close a dialog and hear its name and the return; (7) change screen by the sidebar and hear the name (R12); (8) read a form error under a field.

## Data safety
- The audit and the manual pass use fake accounts and the stubs; no screenshot or trace of real data is kept. Playwright's traces already go to the ignored `e2e/assets/` folder.
- The announcer region holds a conversation's display name and no message text. It is not logged.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Icon-only buttons are named; a modal traps focus and returns it; menus use arrows; a keyboard-only run of each (D-075, NR9, NFR-03) | R2, R3 (name rules cannot be waived), R6, R7, R9 |
| No feature is hover-only or desktop-only (D-067, NFR-02) | R8 (the ten tasks with no pointer), R10 (the bar is reached by `:focus-visible`), Table B |
| English and Vietnamese, both looks; every text through i18n; a wording the prototype lacks is a proposal (D-018, NFR-05, D-139) | R4 (the `vi` cell and `lang`), R12 and R13 add no key, Table E |
| The smallest window is 360 by 560 (NR2) | Table E (narrow cells), R9, R10 |
| The prototype's colours stay and no target is set (TOKI-009 concern 5) | R5 audits and does not change; Out; concern 2 |
| The toast timer holds while the pointer is over it or focus is in it (TOKI-013 concern 2) | Table B and Testing (checked with the clock) |
| The tab title is `(3) Toki` (D-122) | Unchanged; the announcer is separate; concern 6 |
| Outcome I14: usable by keyboard; milestone M6, size M | R6 to R10 and Table G |

## Open questions from the intent
- Which level is the target, and does it include reflow at 320 px? Not answered. Carried forward as concern 1.
- What is audited and what is built, and which screens are in scope? Answered: Design, "What is audited and what is built", and Table A (R1).
- What are the keys, and are shortcuts beyond Ctrl+K wanted? Answered for the keys that exist (Table B); Not answered for new shortcuts. Carried forward as concern 5.
- Where do the findings go, and who changes a colour that is too faint? Answered for where they go (R3, R19); Not answered for the colour. Carried forward as concern 2.
- What does a screen reader hear on a screen change, a new message, an unread count and a toast? Answered for a screen change and a toast (R12, TOKI-013 R21); Not answered for the unread count and a new message. Carried forward as concern 4.
- What does the flash, the skeleton and a toast do under reduced motion? Answered for the skeleton and the toast (R14, TOKI-082 R2, the global rule); Not answered for the flash. Carried forward as concern 3.
- Does focus move to the message after a jump? Answered: R11, concern 7.
- Does each screen get its own tab title? Not answered. Carried forward as concern 6.

## Areas of concern
1. The target level. The log sets none (NFR-03 and D-075 are the floor). `e2e/sign-in.spec.ts` and `e2e/join.spec.ts` already scan with the tags for WCAG 2.2 AA, which is the only level in the repository. Not decided. Proposal, not a decision: WCAG 2.2 level AA is the target for R2, R5 and R10 (4.5 to 1 for text, 3 to 1 for the focus ring and a control's edge, a target at least 24 px, a focus not covered), with the narrow smallest window of 360 px (NR2) used for reflow instead of 320 px, so criterion 1.4.10 is claimed at 360 px and not at 320 px. A different level changes the tag list in one place (`e2e/support/axe.ts`) and the numbers of R5. Owner: Thanh Truong (product owner).
2. Contrast and the prototype's colours. TOKI-009 concern 5 left open whether a target may change a colour. With the proposal of concern 1 one pair fails: the Undo label of a toast in Focus (1.25 to 1.68; TOKI-013 concern 3 recorded the same numbers). Not decided. Proposal, not a decision: change it in its own ticket to draw the label in the Focus look with `--accent-soft` on the toast, as in Calm (about 10.4 to 11.7 to 1 for the four accents, computed from the tokens), which departs from the prototype in one colour; until then the pair stays in `contrast-known.ts` and the build is green with it listed. Owner: Thanh Truong (product owner).
3. The flash of a jump under reduced motion (carried from TOKI-068 concern 4). The global rule cuts the 2 second animation to 0.01 ms, so a person who asks for no motion sees no flash at all. Not decided. Proposal, not a decision (R16): a still tint of `--accent-soft` for the same 2 seconds with no animation. The alternative is to keep the prototype's behaviour (nothing seen), with focus on the message (R11) as the only sign. Owner: Thanh Truong (product owner).
4. Announcing the unread count and arriving messages. The log has no rule. A message that arrives in the open conversation is spoken nowhere: the list is not a live region (TOKI-041 R24, so that a page of older messages is not read), and the toast host does not toast the open conversation (TOKI-073). Not decided. Proposal, not a decision: say the unread count when a conversation opens with a New divider (R13, text `{name} · {count} unread` from existing keys) and announce nothing for an arriving message, because a busy channel would flood a screen reader. The alternative is one polite line per arriving message from another person ("{name}: {start of the text}"), with a limit of one line every 5 seconds. Owner: Thanh Truong (product owner).
5. Shortcuts and Undo by keyboard. The log has Ctrl+K only. A toast with Undo lasts 5 seconds (D-069), holds while focus is in it (TOKI-013 concern 2) and is last in the document, so a keyboard person reaches it only by tabbing to the end of the page; while a dialog is open the trap holds focus (TOKI-093 concern 8). Not decided. Proposal, not a decision: build none in this ticket; the cost of a person who misses Undo is the action done again. Options for the owner: a shortcut that presses Undo while a toast shows, a way to move focus to the toast region, arrow keys in the conversation list, a key to focus the composer. Each is a feature the prototype does not have (D-139). Owner: Thanh Truong (product owner).
6. The tab title for each screen. D-122 gives `(3) Toki` for the unread count and TOKI-054 R5 keeps one constant base for every screen; a page title that names the screen helps a screen reader user and WCAG criterion 2.4.2 asks for a title that describes the purpose. Not decided. Proposal, not a decision: keep it as it is (the announcer of R12 says the screen; axe's `document-title` rule passes with `Toki`); if the owner wants `(3) Activity · Toki`, it is one change of `baseTitle` into a function of the route in `tab-title.ts`, as TOKI-054 R5 says a later ticket may do, and it changes the text of D-122. Owner: Thanh Truong (product owner).
7. Where the focus goes after a jump (handed over by TOKI-068, Scope, Out). Decided in this spec: it moves to the message's box with `preventScroll`, unless a modal layer is open (R11), because the box is already a tab stop with a name (TOKI-052 R7), the alternative leaves a keyboard person at the control they pressed and far from the message, and moving focus to a message is the same outcome as a pointer person's eyes landing on the flash. A reply opened in the thread panel (TOKI-068 concern 5) is not covered by this ticket and keeps the focus the thread panel gives. Owner: Thanh Truong.
8. The announcer's choices. Decided in this spec: one region for the whole app, polite, in the document from the first render, with the screen being the section (and, for Home, the conversation) so that a thread, a tab or a query does not talk (R12). Reason: a region that is added on demand is often not announced by screen readers, which is why TOKI-013 R21 has its region in the document from the first render; a thread or a tab already has its own name on screen. Owner: Thanh Truong.
9. What is not covered. Decided in this spec: no work for `forced-colors`, `prefers-contrast`, 400% zoom, the text-spacing override, captions (no audio or video in phase 1) or WebKit and Firefox in the runner, because the log asks for none and each adds a look or a browser to maintain; they are named so that nobody reads the audit as covering them. Owner: Thanh Truong.
10. Hand-offs written at the same time as this spec. TOKI-092 (More sheet) and TOKI-104 (update strip), 078 (Preferences), 079 (People), 080 (translation), 082 (extra states) are drafts: their states in Table A and the names in R17 follow their texts of today and are corrected when they are built (R1's unit test fails for a missing state). Decided in this spec: this ticket is built after them and after the whole of M3 to M5 UI, because it needs the finished screens. Owner: Thanh Truong.
