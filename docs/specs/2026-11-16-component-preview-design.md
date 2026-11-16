# Component preview page design

Date: 2026-11-16 · Status: draft for review
Intent: docs/intents/component-preview.md (Thanh Truong)
Ticket: TOKI-016

## Goal
The builder needs one page that shows every component, icon, font and token of the design system together, in Calm and in Focus, so that the milestone M1 exit check "the component preview page matches the prototype in Calm and Focus at all three layouts" can be done by a person who did not build the components, and can be repeated after any later change.
After this change `apps/web` has a second page, served in development only, that renders what `@toki/ui-web/examples` lists, the 43 icons, the seven font faces and the 32 tokens; a browser test checks what a machine can check; and the pull request records the rest, which is compared with the prototype by eye, state by state.

## Scope
- In:
  - The page: `apps/web/preview.html` and `apps/web/src/preview/`; its controls for look, accent and density; its sections (tokens, fonts, icons, one section per entry of `componentExamples`, live toasts).
  - Keeping the page out of the production build, and a check that proves it (`check:preview-excluded`).
  - The list of what the page must show, counted from the specs of TOKI-009 to TOKI-014 (Table A, Table B), and the record of where each piece is in the prototype (`references.ts`).
  - The checks: one Playwright test file `e2e/component-preview.spec.ts`, one Vitest file for the page's pure functions and file-reading checks, the build check, and the by-eye comparison recorded in the pull request (R21).
- Out (not now):
  - The components, the icons, the fonts and the tokens: TOKI-012, TOKI-013 and TOKI-014 (components and their `examples` files), TOKI-011 (icons), TOKI-010 (fonts), TOKI-009 (tokens). This ticket adds no file under `packages/` and edits no shared file of theirs (R19). A component that the page lacks is added by its own ticket, with its folder, one line in `components/index.ts` and one entry in `src/examples.ts` (TOKI-012 R31).
  - The AppShell, its three layouts and the bottom tabs: TOKI-015. The page is drawn beside the shell, not inside it (Design, "Beside the shell"). The comparison of the shell's own layouts with the prototype belongs to TOKI-015.
  - Placement of toasts above the composer and the bars: TOKI-013 R29 and the tickets that register those elements. The page does not register any.
  - Test harness, Playwright configuration and CI workflow: TOKI-008 and TOKI-007. This ticket adds one test file that those pick up (TOKI-008 R12) and edits no configuration.
  - Screenshot comparison, Storybook or any other new tool (Design, "What 'matches the prototype' means here").
  - Copying the prototype into the repository: the Blueprint stays outside the repository (TOKI-095 spec, concern 4).
  - A text catalogue for the page (R18).
- Plan change: TOKI-016 needs TOKI-009, TOKI-010, TOKI-011, TOKI-012, TOKI-013, TOKI-014 and, for its browser test, TOKI-008; the plan lists only TOKI-012. It does not need TOKI-015 (the TOKI-013 spec, concern 9, says it will; the shell is not on this page).

## Requirements
In the checks below, "the page" is `http://localhost:5173/preview.html` served by `pnpm --filter ./apps/web dev`, and "the browser test" is `e2e/component-preview.spec.ts` run by `pnpm test:e2e` (Chromium only, TOKI-008 R10, R21).

Page and build
- R1. `apps/web/preview.html` is a second entry of the web app. Opening the page returns HTTP 200, shows an element `data-testid="preview-root"`, and the document `title` is `Toki component preview`. `/` still shows the app of TOKI-006. Check: the browser test opens both.
- R2. The page is not in the production build. After `pnpm --filter ./apps/web build`, `apps/web/dist` holds exactly one `.html` file, `index.html`; no file in `dist` contains the text `preview-root`; `vite.config.ts` sets no `build.rollupOptions.input`. The script `check:preview-excluded` (`apps/web/scripts/check-no-preview.mjs`) checks these three and exits non-zero, naming the file or the setting, when one fails. The `build` script of `apps/web` runs it after `check:fonts`, so TOKI-007's build check fails when the page leaks. The initial JavaScript is still under the limit of TOKI-006 R10. Check: run the build and read the exit code; add `preview.html` to the Vite `input` by hand and run again: the check exits non-zero and names `preview.html`; undo.
- R3. Styles load in this order: `preview.html` links `/src/fonts/fonts.css` with a `link rel="stylesheet"`; `src/preview/main.tsx` imports `@toki/tokens/tokens.css`, then `@toki/ui-web/base.css`, before any other non-CSS import (the rule of TOKI-012 R29), and `src/preview/preview.css` after them. No `.ts` or `.tsx` file under `apps/web/src` other than `main.tsx` imports `fonts.css` (TOKI-010 R7 stays true). Check: a Vitest test reads `preview.html` and `src/preview/main.tsx` as text and fails on a different order, and reads the files of `apps/web/src` for `fonts.css`; `check:fonts` still exits 0.
- R4. The page has three controls, each a native `select`: look (`calm`, `focus`), accent (`teal`, `indigo`, `clay`, `violet`) and density (the look's own, `comfortable`, `compact`), with the values of `looks`, `accents` and `densities` of `@toki/tokens` (TOKI-009 R1). The page sets `data-eff` and `data-accent` on the root element to the chosen look and accent, and `data-density` to the chosen density; for "the look's own" it sets no `data-density` (TOKI-009 R14: Calm then shows Comfortable and Focus Compact). It sets `data-eff` always, so the device's light or dark setting never decides the look. Changing a control changes the attributes at once with no reload and writes the three values to the address as `?look=&accent=&density=` with `history.replaceState`. Opening an address with those values applies them; a missing or unknown value gives `calm`, `teal` and "the look's own". The page writes nothing to `localStorage`, `sessionStorage` or a cookie. Check: a Vitest test of the pure function `readControls(search)` (valid, missing, unknown and repeated values) and the browser test (change each control and read the three attributes and the address; open `?look=focus&accent=clay&density=compact` and read them).

Sections
- R5. The page has these sections in this order, each a `section` with a heading and `data-section`: `tokens`, `fonts`, `icons`, then one `section` with `data-component="<name>"` for each entry of `componentExamples`, in the order of the list, then `live-toasts`. Check: the browser test reads the order.
- R6. Each example of an entry is drawn in a `figure` with `data-example="<component>/<id>"` and a `figcaption` holding the `title` of the example. The number of figures of an entry equals the number of its examples; the page shows each `element` as the examples file gives it and adds nothing around it but the figure and a panel whose background is `var(--surface)`. Check: the browser test counts figures per entry against `componentExamples`, which it reads from the page through a `data-count` attribute that each section carries.
- R7. Each figure sits in an error boundary. When an example throws, the figure shows the message and carries `data-failed="true"`, and the rest of the page still renders. Check: a Vitest test with Testing Library of the figure component with a throwing element; the browser test fails when any `[data-failed]` exists, or when the page logs a console error or warning.
- R8. Every selector of Table B matches at least one element inside a `figure`, in both looks. Table B is the set of prototype class names and attributes that the specs of TOKI-012 and TOKI-013 give to each state; a selector that matches nothing names a state that the examples do not draw. The test also requires an entry for each of `Button`, `IconButton`, `Chip`, `Switch`, `Field`, `Select`, `Tag`, `Badge`, `Avatar`, `PresenceDot`, `EmptyState`, `Toast`, `Menu`, `Modal` and `Sheet`, each with at least one figure. Check: the browser test holds Table B and fails naming the component and the selector.
- R9. The `icons` section draws `<Icon name={n} />` for each `n` of `iconNames` of `@toki/ui-web`, each in a cell whose caption is the name, and one row of the first icon at the sizes 12, 18, 24 and 30. The number of icon cells equals `iconNames.length`, and the test requires that number to be 43 (TOKI-011 R2). Check: the browser test.
- R10. The `fonts` section shows the seven faces of TOKI-010 Table A, one row each, with the family, the weight and the sample line of TOKI-010 (Testing, R13) set in that face. Check: the browser test finds seven rows and, after `document.fonts.ready`, `document.fonts.check` returns true for each of the seven family and weight pairs, which proves that `fonts.css` is loaded on this page.
- R11. The `tokens` section lists the 32 custom properties of TOKI-009 R10, one row each, with the name and the value that the browser computes for it on the root element now; a value that is a colour also shows a swatch. The rows change when a control changes. Check: the browser test finds 32 rows with a non-empty value and, with Calm and teal, `--accent` is `#0F766E`; with Calm and indigo it is `#4F46E5`; with Focus and indigo it is `#A5B4FC`.
- R12. The page mounts one `ToastProvider` (TOKI-013 R21), so the page has one `aria-live="polite"` region. The `live-toasts` section has three native buttons that call `useToasts().show`: one toast without an action, one with an action, and three toasts in a row. The action's `onPress` adds one to a counter that the section shows. Check: the browser test presses each; the plain toast is in the region and gone within 4 s (it lasts 2800 ms, TOKI-013 R23); the toast with an action is gone within 7 s (5000 ms) or at once when its button is pressed, after which the counter reads 1; the three toasts appear in the order shown.
- R13. Each of `Menu`, `Modal` and `Sheet` is drawn as its entry of `componentExamples` gives it, and the page adds no provider, router or shell for it. Check: the browser test presses the first `button` in the first figure of each of the three entries; an element with role `menu` (Menu) or `dialog` (Modal, Sheet) appears; Escape removes it and focus is back on that button (the behaviour of TOKI-014, proved here in a real browser).

Looks, density and layouts (browser test, Chromium)
- R14. In each look, with teal and no density chosen, the computed values of Table C equal the hexadecimal values given there. Table C is the table "Look in Calm and Focus" of TOKI-012, row for row (12 rows), resolved from TOKI-009 Tables A and B. Check: the browser test, for the first matching element inside a figure.
- R15. Accent and density reach the components. With Calm and indigo: `.btn.primary` has the fill `#4F46E5`; `.chip[aria-pressed="true"]` has the fill `#E3E5FB` and the text `#3730A3`. With Focus and indigo: `.btn.primary` has the fill `#A5B4FC` and the text `#1E1B4B`; the chip has `#25285A` and `#C7D2FE` (the prototype's lines 49 and 52). The `.av` that has no `size` is 36 px wide in Calm and 30 px in Focus with no density chosen, 30 px in Calm with `compact`, and 36 px in Focus with `comfortable`; an `.av` with a `size` keeps it. Check: the browser test.
- R16. At the widths 360, 900 and 1280 px, in both looks, the page has no horizontal scroll (`scrollWidth` not above `innerWidth`) and no figure is wider than the window; 360 by 560 is the smallest supported window (D-068). At 719 px every `.btn`, `.ib`, `.chip`, `.inp`, `.sel`, `.field` and `.toast button` on the page is at least 40 px tall, except `.linkbtn` and `.sw` (TOKI-012 R8, concern 2). At 720 px an `.btn` with neither `sm` nor `wide` is 34 px tall, an `.btn.sm` 28 px, an `.ib` 34 px and a `.chip` 28 px. Check: the browser test.
- R17. Each `section` that has `data-component` or is `tokens`, `fonts` or `icons` shows one line `data-prototype-ref` with the lines of the prototype to compare with (Table D), taken from `src/preview/references.ts`, a plain object from the section's name to a string. The object holds no list of components of its own. An entry of `componentExamples` with no key in it makes the line read `No prototype reference recorded` and the browser test fails. Check: the browser test reads the line of every section and compares it with the list of Table D.

Page quality
- R18. The words on the page itself (headings, the three control labels, the three toast buttons, the label of the counter) are English literals in `apps/web/src/preview/`; the page imports nothing from `@toki/i18n` and mounts no `I18nProvider`. The page's own CSS (`preview.css`) has only selectors that start with `.pv-`, plus `body` and `:root`, so it cannot restyle a component. Check: a Vitest test reads the files of `src/preview/` and fails on an `@toki/i18n` import or a selector of another form.
- R19. This change adds no file under `packages/` and no export to any package. From `@toki/ui-web` the page imports only `componentExamples` (through `@toki/ui-web/examples`), `Icon`, `iconNames`, `ToastProvider` and `useToasts`; from `@toki/tokens` only `looks`, `accents`, `densities` and the two CSS files. No file outside `apps/web/src/preview/` imports `@toki/ui-web/examples` or anything under `src/preview/`. Check: `git diff --stat` against `main` lists no path under `packages/`; a Vitest test reads the imports of the page's files.
- R20. Loading the page in each look gives no console error or warning, and every request goes to the page's own address (no other host). Check: the browser test records both.
- R21. The pull request that builds this ticket records the by-eye comparison of Design, "What 'matches the prototype' means here", point 2: one table with six rows (Calm and Focus at 360, 900 and 1280 px), each row saying for every component, icon, font and token section that it matches, or naming the difference and whether it is accepted. Differences that are known beforehand are in Design, Table E. Check: read the description of the pull request.
- R22. `pnpm lint`, `pnpm lint:boundaries`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` and `pnpm --filter ./apps/web build` exit 0 on the finished branch. The files of the page follow the rules of TOKI-002 and TOKI-012 R24 (no inline `eslint-disable`, icon-only buttons have a name).

## Design
### What the page must show
Counted from the specs of TOKI-009 to TOKI-014; "item" is one value or state that must be drawn at least once. The examples files of TOKI-012 (R26) and TOKI-013 (R30) already have to hold these values; this table is what the page is checked against, and what the by-eye comparison walks through.

Table A. Items.

| Piece | Items | Count | Source |
| :---- | :---- | :---- | :---- |
| Button | variants default, primary, danger, ghost, link; sizes md, sm; full width; disabled button; disabled link; with an icon and text | 11 | TOKI-012 R10, R11, R26, Tables A, C |
| IconButton | sizes md, sm; pressed true; pressed false; disabled | 5 | R12, R26, Table D |
| Chip | sizes md, sm; pressed true; pressed false; disabled; ChipGroup | 6 | R13, R26, Table E |
| Switch | checked true; checked false; disabled | 3 | R14, R26, Table F |
| Field | forms: label with input; code; textarea; input with no visible label; search with an icon; search without an icon; states error, read-only and disabled on the default form and the same three on the search form | 12 | R15 to R18, R26, Table H |
| Select | with a label; with no visible label; wide; error; disabled | 5 | R16, R17, Table H |
| Tag | the one look | 1 | R19 |
| Badge | default; mute; mention; with an accessible label | 4 | R20, Table G |
| Avatar | no size; size 46; presence active, away, do not disturb; one-word name; long name | 7 | TOKI-013 R6, R10, R30 |
| PresenceDot | three states, each with and without a label | 6 | R11, R14, R30 |
| EmptyState | with an action; without | 2 | R15, R30 |
| Toast | no action; with an action; long text | 3 | R19, R30 |
| **Components, groups 1 and 2** | | **65** | |
| Menu, Modal, Sheet | counted from the TOKI-014 spec; at least one figure each | not counted here | R8, R13 |
| Icons | `iconNames`, plus one size row (12, 18, 24, 30) | 43 and 4 sizes | TOKI-011 R2 |
| Fonts | Be Vietnam Pro 400, 500, 600, 700; Bricolage Grotesque 600, 700; JetBrains Mono 500 | 7 | TOKI-010 Table A |
| Tokens | 17 base colours, 4 accent values, 4 avatar tints, 3 density numbers, 2 radii, 2 shadows | 32 | TOKI-009 R7, R10 |
| Looks, accents, densities | 2, 4 and 3 (the look's own, comfortable, compact) | 24 combinations | TOKI-009 R1, R14 |
| Layouts | 360, 900 and 1280 px (R16) | 3 | D-068 |

The page draws each item in the look, accent and density chosen on the page. So the full comparison is 65 component items by 2 looks by 3 widths. The accent and density are compared on the pieces that use them: the primary button, the pressed icon button and chip, the checked switch, the default badge, the active dot, the empty-state icon box, the toast button and the default avatar (9 pieces) in the three other accents, and the avatar in both densities.

Named in a spec and not in the examples, so not on the page unless the page adds it (gaps, concern 6): the live behaviour of toasts (R12 covers it with the page's own buttons); the avatar sizes the screens use other than 46 (TOKI-013, Design: 18 to 64 and 34); hover, active and focus-visible states (they need a pointer or a key; by eye, R21); the 360 px toast placement, which TOKI-013 R27 builds on purpose differently from the prototype.

Table B. Selectors that must match inside a figure (R8). All are the prototype's class names and attributes (TOKI-012 Table B, TOKI-013 R6 to R20).

| Component | Selectors |
| :---- | :---- |
| Button | `.btn`, `.btn.primary`, `.btn.danger`, `.btn.ghost`, `.btn.sm`, `.btn.wide`, `.btn[disabled]`, `.btn .ic`, `.linkbtn`, `.linkbtn[disabled]` |
| IconButton | `.ib`, `.ib.sm`, `.ib.on`, `.ib[aria-pressed="false"]`, `.ib[disabled]` |
| Chip | `.chips`, `.chip`, `.chip.sm`, `.chip[aria-pressed="true"]`, `.chip[aria-pressed="false"]`, `.chip[disabled]` |
| Switch | `.sw[aria-checked="true"]`, `.sw[aria-checked="false"]`, `.sw[disabled]` |
| Field | `label.lbl + input.inp`, `.inp.code`, `textarea.inp`, `.inp:not(.code)` with no `label.lbl` before it, `label.field .ic`, `label.field` with no `.ic`, `.inp.invalid`, `.inp[readonly]`, `.inp[disabled]`, `.field.invalid`, `.field.readonly`, `.field.disabled`, `.gerr[role="alert"]` |
| Select | `.sel`, `.sel.wide`, `.sel.invalid`, `.sel[disabled]`, `.lbl + .sel` |
| Tag | `.tag` |
| Badge | `.cnt`, `.cnt.mute`, `.cnt.mn`, `.cnt .sr` |
| Avatar | `.av`, `.av[style*="--s"]`, `.pdw .av` |
| PresenceDot | `.pd`, `.pd.away`, `.pd.dnd`, `.pd[role="img"]`, `.pd[aria-hidden="true"]` |
| EmptyState | `.empty .eic .ic`, `.empty` holding a `button`, `.empty` holding none |
| Toast | `.toast`, `.toast button` |

Table C. Resolved values the browser must draw (R14). From TOKI-012, "Look in Calm and Focus". "First match" is the first element of the selector inside a figure.

| Piece (selector, property) | Calm | Focus |
| :---- | :---- | :---- |
| `.btn`, `border-radius` | 10px | 8px |
| `.btn` with no modifier: `background-color`, `color`, `border-top-color` | `#FFFFFF`, `#16201D`, `#E0E5DF` | `#161B1E`, `#E8EDEB`, `#283035` |
| `.btn.primary`: fill, text | `#0F766E`, `#FFFFFF` | `#5EEAD4`, `#04201C` |
| `.btn.danger`: fill, text | `#B42318`, `#FFFFFF` | `#F97066`, `#161B1E` |
| `.ib` not `.on`: text | `#3A4541` | `#C9D1CE` |
| `.ib.on`: fill, text | `#DCEFEA`, `#0B5D56` | `#123B36`, `#7EF0DE` |
| `.chip[aria-pressed="true"]`: fill, text | `#DCEFEA`, `#0B5D56` | `#123B36`, `#7EF0DE` |
| `.sw[aria-checked="false"]`, `.sw[aria-checked="true"]`: track | `#E0E5DF`, `#0F766E` | `#283035`, `#5EEAD4` |
| `.inp`: border; focused: border, the third colour of `box-shadow` | `#E0E5DF`; `#0F766E`, `#DCEFEA` | `#283035`; `#5EEAD4`, `#123B36` |
| `.gerr`: fill, text | `#FCE8E6`, `#B42318` | `#3A1614`, `#F97066` |
| `.cnt`: fill, text | `#0F766E`, `#FFFFFF` | `#5EEAD4`, `#04201C` |
| `.cnt.mn`: fill, text | `#B42318`, `#FFFFFF` | `#F97066`, `#161B1E` |
| `.tag`: fill, text | `rgba(22,32,29,0.055)`, `#3A4541` | `rgba(232,237,235,0.07)`, `#C9D1CE` |

Table D. Prototype lines to compare with (`docs/blueprint/prototype/index.html` of the Toki Blueprint). They are the lines that the specs of TOKI-009 to TOKI-013 cite; `references.ts` holds them as strings. Menu, Modal and Sheet get theirs from the TOKI-014 spec.

| Section | Lines |
| :---- | :---- |
| Button | 82-93, 309, 714 |
| IconButton | 94-97 |
| Chip | 98-101, 185 |
| Switch | 338-341 |
| Field | 186-189, 345-348, 715, 716 |
| Select | 344, 701 |
| Tag | 121 |
| Badge | 102-104, 586 |
| Avatar | 115-120, 529, 599-600 |
| PresenceDot | 115-120, 599-600 |
| EmptyState | 363-366 |
| Toast | 419-423 |
| tokens | 6-56 |
| icons | the `ICONS` table at about line 835 |
| fonts | the font link of the prototype's `head`; the families in TOKI-010 Table A |

### What "matches the prototype" means here
Decided in this spec. The prototype is a single HTML file outside the repository (TOKI-095, concern 4), it draws no sheet of components, and no spec in this repository sets up a screenshot tool: TOKI-008 brings Vitest and Playwright (one sample test, Chromium) and says nothing of screenshots. A screenshot comparison would also need a reference image that does not exist, and a baseline made from this page would only prove that the page does not change. So "matches" is made of two checks, each with its limit.

1. The machine check (R2, R6 to R16, R20). It runs in CI in the end-to-end job of TOKI-008. It proves: the page lists every component and every state that the specs require (Table B is the prototype's own class names and attributes); nothing on the page fails or logs an error; in both looks the browser draws the colours that the specs resolved from the prototype (Table C), through the real load order of the style sheets; accent and density reach the components; the narrow-screen rules of TOKI-012 hold at 719 and 720 px; the seven fonts load on this page; the page does not scroll sideways at 360, 900 and 1280 px. It does not prove: that the tables of TOKI-009 and TOKI-012 equal the prototype (those tests prove the CSS equals the tables, and the tables equal the prototype only by review, TOKI-012 concern 11); anything about a property that Table C does not list (spacing, type size, shadow, line height); hover, active and focus-visible states; Safari and Firefox.
2. The by-eye comparison (R21). The reviewer opens the page and the prototype side by side in the same window size, at 360, 900 and 1280 px, Calm then Focus (the prototype's Look control is on its demo bar, D-145), and walks through Table A with Table D's lines open. The result goes in the pull request: six rows, one for each look and width, saying "matches" or naming the difference and whether it is accepted. The comparison is done in Chrome, which the machine check also uses, and once in Safari and once in Firefox for D-108; a native `select` and a focus ring look different in each browser and are accepted (TOKI-012 concern 15). It proves that a person looked at each named state; it does not prove pixel equality.

States the prototype does not draw cannot be compared with it, only with the specs: the error box under a field and the invalid, disabled and read-only controls (TOKI-012 concern 1), the disabled link button, the disabled chip, switch, icon button and select, the Away dot's grey ring on a profile (TOKI-013 Design, PresenceDot), the one-word initials, and the toast at 360 px. Table E lists them so that the reviewer does not look for a match that cannot exist.

Table E. Known differences from the prototype, accepted by the specs.

| Piece | Difference | Source |
| :---- | :---- | :---- |
| Field, Select | error box, invalid, disabled and read-only looks are decided, not drawn | TOKI-012 concern 1 |
| Button link, Chip, Switch, IconButton, Select | disabled look is decided (opacity .5) | TOKI-012 Tables C to F |
| Select | the browser's own arrow and list | TOKI-012 concern 15 |
| Avatar | one-word names show one letter, not two | TOKI-013 Design, Avatar |
| PresenceDot | Away keeps its grey ring where the prototype overrides the border on profile panels | TOKI-013 Design, PresenceDot |
| Toast | no `role="status"` on each toast; colour of the label in Focus; placement at 360 px | TOKI-013 R19, R20, R27 |
| Narrow rules | the viewport width, not a container query on the demo frame | TOKI-012, Table I note |

### Beside the shell
Decided in this spec. The page does not render inside the AppShell. The shell fills the window, needs the router, the sign-in state and the data of the app, and sets layout rules (`#root`, the content area, `--tabh`) that would change how the components are placed; the page's job is to show components alone, on a `--surface` panel, so that what differs from the prototype is the component. The page therefore needs from TOKI-015 nothing but this: the shell may set `data-eff`, `data-accent` and `data-density` on the root element in the same way as the page does (TOKI-009), and the page sets them itself in `controls.ts` (a few lines). If TOKI-015 or Preferences (TOKI-078) exports one function that sets the three attributes, the page should call it instead of keeping its own copy; this spec does not depend on it. The shell mounts the one `ToastProvider` of the app (TOKI-013); the page mounts its own, because it has no shell (R12). The page registers no toast anchor and no element to avoid, so its toasts sit 20 px above the window's bottom edge (TOKI-013 R27); the placement against a composer and the tab bar is checked by TOKI-013 R29 and the tickets that register them.
"All three layouts" of the M1 exit check, read for this page, means the three widths of Table A (D-068): narrow (under 720 px), 720 to 1099 px, and 1100 px and wider. Components change only at 719 px (TOKI-012 R8), so the three widths show the narrow rules, the normal sizes, and the page at both ends. The layouts of the shell itself (Calm, Focus, narrow) are TOKI-015's to compare with the prototype.
The page has one look at a time, chosen by a control, and not two looks side by side: the tokens select a look by an attribute on the root element (TOKI-009), so two looks cannot share a document, and two frames of the page would add a second mode for the same result. The width is the browser window's, and has no control, because the component CSS reads the viewport (TOKI-012, Table I note) and not a container.

### Dev only
The page is a builder's tool and is not in the production build (R2). The mechanism: Vite builds only the inputs it is given, and `apps/web` gives it `index.html` only (TOKI-006 sets no `input`); `preview.html` sits in the project root next to `index.html`, so the dev server serves it and the build ignores it, with no flag, no route and no change to the router (TOKI-006 R3) or to `routeTree.gen.ts`. Nothing that the app imports imports the page (R19), so its code and `@toki/ui-web/examples` never enter a chunk of the app. `check:preview-excluded` proves it on every build.
Whether the page ships is not decided by the Blueprint (concern 1); this spec builds to the proposal that it does not.

### Layout
```
apps/web/
├─ preview.html                 second entry: title, fonts.css link, root element, loads src/preview/main.tsx
├─ package.json                 build ends with check:fonts then check:preview-excluded
├─ scripts/check-no-preview.mjs R2
└─ src/preview/
   ├─ main.tsx                  styles in the order of R3, applies the controls, mounts the page inside ToastProvider
   ├─ controls.ts               readControls(search), applyControls(...): the three attributes and the address
   ├─ PreviewPage.tsx           header with the three selects, then the sections
   ├─ TokensSection.tsx  FontsSection.tsx  IconsSection.tsx  LiveToasts.tsx
   ├─ ExampleSection.tsx        one entry of componentExamples: heading, reference line, the figures
   ├─ ExampleFigure.tsx         figure, caption, error boundary (R7)
   ├─ references.ts             section name to prototype lines (Table D)
   ├─ preview.css               .pv-* rules only (R18)
   └─ preview.test.ts           R3, R4 (readControls), R7, R18, R19
e2e/component-preview.spec.ts   R1, R5, R6, R8 to R17, R20
```
- Decided in this spec: the page's controls are native `select` elements and its buttons native `button` elements with `pv-` classes, not the components under test, so that a broken component cannot break the controls used to inspect it.
- Decided in this spec: `fonts.css` is loaded by a `link` in `preview.html`, because TOKI-010 R7 says that only `main.tsx` imports it. The alternative, changing that sentence of TOKI-010 so that the preview entry may import it too, is simpler to read and is in concern 3.
- Decided in this spec: the browser test holds Tables B and C as data, as the font and token checks hold their tables, and reads the examples through the page, so it needs no import from `packages/`.
- Assumption: Vite serves `/preview.html` in development and leaves it out of the build when `input` is not set, and the TanStack Router plugin does not touch it. The builder confirms it on the pinned versions; R2 proves the second half on every build.

### Errors
- An example throws -> its figure shows the message, the page goes on, the browser test fails (R7).
- A component with no entry in `componentExamples` -> it is not on the page; TOKI-012 R31's test fails first. A component with an entry and no line in `references.ts` -> the page says so and the browser test fails (R17).
- An unknown value in the address -> the default for that control (R4).
- The page opened from a production build -> not found: the app's not-found view (R2).

## Testing
- Tests are written first and seen to fail, then the page is built until they pass.
- Vitest (`apps/web/src/preview/preview.test.ts`, node environment, with Testing Library for R7 only): R3 (read `preview.html` and `main.tsx` as text), R4 (`readControls`), R7 (a throwing element), R18 and R19 (read the files of `src/preview/` for imports and selectors).
- Playwright (`e2e/component-preview.spec.ts`, Chromium, against the dev server that `pnpm test:e2e` starts): R1, R4 (attributes and address), R5, R6, R8 to R17, R20, in both looks, at the widths of R16. It sets look, accent and density through the address, so it needs no clicks on the selects except the one test of R4.
- R2: the build and `check:preview-excluded`, then the one by-hand proof that the check fails when `preview.html` is added to `input`.
- R12 waits on the real timers (2800 ms and 5000 ms) with Playwright's auto-waiting; no fake clock.
- R21 is by hand: the six rows go in the pull request.
- R22: run the commands on the finished branch.
- The browser test uses only the page's own data and the demo words of the examples files; no account, no server, no network.

## Data safety
- The page holds no personal data and no real account: the people and texts are the prototype's samples inside the examples files (TOKI-012, TOKI-013).
- It stores nothing in the browser (R4) and makes no request to another host (R20).
- It is not in the production build (R2), so it adds nothing to what a person using Toki downloads.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| One page that lists every component in both looks, for comparison with the prototype | R4 to R9, R17; Table A; "Beside the shell" for the one-look-at-a-time choice |
| M1 exit check: the page matches the prototype in Calm and Focus at all three layouts; the three layouts are Calm, Focus and narrow under 720 px (D-068) | R14 to R16 and R21; "What 'matches the prototype' means here"; for this page the three layouts are the three widths of Table A, and the layouts of the shell are TOKI-015's (concern 4) |
| The prototype is the only design source (D-019); where it draws nothing Claude decides | R17 and Table D name the lines; Table E lists what has no prototype look |
| Size: S | The page is a set of small files; the checks reuse Vitest and Playwright from TOKI-008. Concern 9 says the count of requirements is large for an S |
| Needs TOKI-012; the specs of TOKI-012 and TOKI-013 say it also needs TOKI-013 | Scope, plan change: it needs TOKI-009 to TOKI-014 and TOKI-008. It reads only `@toki/ui-web/examples` (R19) |
| English is the default interface language and every interface text goes through i18n (D-018, D-064) | R18: the page is not part of the interface, so its words are literals; concern 2 says why and what the alternative costs |
| Demo-only controls never ship (D-145); no decision says whether a builder's page ships | R2 builds to the proposal that it does not ship; concern 1 |
| No component holds a text; examples carry demo words | The page adds none to a component; the figure shows the example as given (R6); the page's own words are R18 |
| Smallest window 360 by 560; under 720 px every control at least 40 px (D-068, F38) | R16 |

## Open questions from the intent
- Does the page ship in the production build, or is it for development only? Not answered by the Blueprint. This spec builds to the proposal "development only" (R2, Design, "Dev only"). Carried forward as concern 1.
- What does "matches the prototype" mean in a way that can be checked? Answered in Design, "What 'matches the prototype' means here": a machine check of what the specs fix, and a by-eye comparison recorded in the pull request, each with what it does not prove. Decided in this spec. The remaining limits are concerns 5 and 6.
- Which are the three layouts for a page of components, and is "both looks" two looks side by side or one at a time? Answered in Design, "Beside the shell": three window widths, and one look at a time. Decided in this spec; concern 4.
- Which of the page's own words go through i18n? Answered: none (R18). Decided in this spec; concern 2.

## Areas of concern
1. The Blueprint does not say whether the preview page ships in the production build. No row of the decision log is about builder tools; D-145 ("demo-only controls never ship") is about the prototype's demo bar and is the nearest, not an answer. Proposal, not a decision: it does not ship (R2). If the owner wants it in production, one `input` line is added and `check:preview-excluded` is removed; the page then needs a route guard against signed-out visitors, which this spec does not design. Owner: Thanh Truong.
2. Every text goes through i18n, but this page is not interface. Decided in this spec: its words are literals (R18), because it is not in the production build, no person using Toki reads it, and a key would go into the catalogue that every user loads and would need a Vietnamese text for each (D-064). This departs from the letter of "every text goes through i18n"; if the owner prefers the letter, the cost is a `preview` namespace of about ten keys in both languages. TOKI-080's literal-text rule is proposed for `packages/ui-web` only (TOKI-017 concern 6), so it does not reach this page. Owner: Thanh Truong.
3. TOKI-010 R7 says only `main.tsx` imports `fonts.css`, so the page loads it through a `link` in `preview.html` (R3). Simpler would be to let the preview entry import it too, which changes that requirement and the list that `check:fonts` scans. Decided in this spec: the `link`, so that TOKI-010 is not edited. Owner: Thanh Truong.
4. The Blueprint does not say what the "three layouts" are for the preview page. Decided in this spec: three window widths, 360, 900 and 1280 px (R16, R21), and one look at a time (Design, "Beside the shell"). The layouts of the AppShell are not on the page; the TOKI-013 spec (concern 9) says TOKI-016 will need TOKI-015, which this spec does not. If the owner wants the shell on the page, the page would render the AppShell with fake data, which needs TOKI-015's contract. Also, TOKI-014 and TOKI-015 were written at the same time as this spec; what they say about open overlays, roles and their examples (R13) and about how the shell sets the look is to be agreed when they are read together. Owner: Thanh Truong.
5. The prototype is not in the repository and no screenshot tool exists, so the comparison with it is by eye (R21) and the colour check proves the specs' resolved values, not the prototype (Design). A step toward more automation, not proposed here: a screenshot test with Playwright of the page in six views, with images committed as references after the by-eye check passes, which would catch later changes and not early mistakes. It adds binary files, depends on fonts and Chromium versions, and needs the owner's decision. Owner: Thanh Truong.
6. Gaps found in the specs, none of them a decision of this ticket. (a) The examples of TOKI-013 do not show the avatar sizes the screens use (18 to 64 and 34); only no size and 46 (R30). (b) The live behaviour of toasts is not an example, so the page adds three buttons (R12). (c) Icons, fonts and tokens are not in `componentExamples`, so the page reads their own exports (R9 to R11). (d) The `id`s of the examples are not fixed by TOKI-012 or TOKI-013, so the test uses the prototype's class names (Table B) and not ids. (e) No count of items exists yet for Menu, Modal and Sheet. (f) Hover, active and focus-visible states are not drawn on the page. Proposal, not a decision: TOKI-013 adds avatar examples for 18, 24, 30 and 64 px. Owner: Thanh Truong.
7. The browser test runs in Chromium only (TOKI-008, concern 5, against D-108) and against the development server: if TOKI-008 starts a built app instead, the page does not exist there (R2) and R1 to R17 fail. This spec assumes the dev server (TOKI-008 R10 says it "starts the web app"). Owner: Thanh Truong.
8. The page sets `data-eff` always, but TOKI-009 concern 10 (the first paint before a script sets it) does not apply to a page that sets it in the entry before it renders. If the shell later keeps a copy of the last look, the page does not read it. Accepted. Owner: Thanh Truong.
9. Size. The Blueprint says S; this spec has 22 requirements, most of them browser checks, and Tables A to E. Proposal, not a decision: build in this order and stop after any step if needed: the entry, the build exclusion and the controls (R1 to R4); the component sections with Table B (R5 to R8); icons, fonts, tokens and live toasts (R9 to R12); the colour, accent, density and layout checks (R14 to R16); the references and the by-eye record (R17, R21). Owner: Thanh Truong.
10. The colour check (R14) holds Table C twice more, in the browser test: TOKI-009, TOKI-012 and this test each copy the values. It is the only check that proves them through the real style sheet order in a browser; the cost is that a deliberate change of a colour touches three tests. Accepted. Owner: Thanh Truong.
11. Table A counts 65 items by reading the requirements of TOKI-012 and TOKI-013, which say "each state of its state props" without listing the items; the count is this spec's reading (for example that the disabled look is shown for the link button, the chip, the switch, the icon button and the select as well as the button). If the examples files differ, Table B is the check, and Table A is changed to match. Owner: Thanh Truong.
