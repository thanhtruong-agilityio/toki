# Intent: Make the app follow the look and scheme model
Author: Thanh Truong (lead).

## Problem
The specs now say that a look (Calm, Focus, Classic) and a colour scheme (light, dark, device) are two choices, with six supported states (`docs/specs/2026-11-26-look-and-scheme-model-design.md`, and the specs it amended), and the prototype draws all six (PR #443). The code still has the old model: one attribute, `data-eff`, set by `applyAppearance` to `calm` or `focus`, where each value brings both a layout and a set of colours. The design tokens have the colours of two states, the style sheets of the shell and the screens name `[data-eff="calm"]` and `[data-eff="focus"]`, and the tests and the e2e support read the same two values. Until the code follows the model, no ticket can build the Classic sidebar, the Look cards or the account setting on top of it, and the app cannot show Calm in dark or Focus in light.
Source: `packages/ui-web/src/appearance.ts`; `packages/tokens/src/tokens.css` and `css.ts`; `packages/ui-web/src/layout/shell.css`; `apps/web/src/main.tsx`; the prototype of PR #443.

## Proposed outcome
- The page carries the look and the scheme as two attributes, and each of the six states shows its own colours, from the first paint to a change of the device's setting.
- The design tokens hold the six states and the accent presets of each scheme, with the values the prototype draws, and the package that exposes them for code takes the look and the scheme.
- The layouts that exist today (Calm, Focus, the narrow one) keep looking as they do in their own state: Calm in light and Focus in dark are unchanged; the new states are the ones the prototype shows.
- Every style sheet, test and e2e helper that named the old attribute names the new ones, so that no place in the code reads `data-eff`.
- A person who has no saved choice sees Calm in the scheme of their device.
Source: the requirement of this run; the model spec (R1 to R7, R10).

## Affected users and systems
- Users: everyone who opens the app; the builders of the next tickets (Classic sidebar, Look cards, the account setting).
- Systems: `packages/tokens` (the blocks, the accent presets, the theme function, its tests and the token list the e2e reads), `packages/ui-web` (`applyAppearance`, the shell and screen style sheets, their tests), `apps/web` (the entry that calls `applyAppearance`, the preview page and its controls, screen style sheets and their tests), and the e2e support and specs that set or read the look.
- Not touched: the Classic sidebar itself, the Look cards and the scheme control of Preferences, saving to the account and the server rule for old clients, the first-paint copy of the choice kept on the device. The specs give those to later tickets, and none of that code exists yet.

## Constraints
- The model spec decided the attribute names, the six states, the default (Calm, scheme of the device) and the numbers (78 states of the tokens); the code follows it and changes none of it.
- The values of the four new states come from the prototype as drawn; a value the prototype does not draw is not invented.
- Calm light and Focus dark keep today's values, and the narrow layout keeps its rules.
- The UI parity check keeps working: it is the check that the app matches the prototype, so the looks it draws map to the new attributes.
- The package that holds the tokens has no dependency on the UI packages (TOKI-009).
Source: `docs/specs/2026-11-26-look-and-scheme-model-design.md`; `docs/specs/2026-11-16-tokens-package-design.md`.

## Open questions
- The model spec leaves `getTheme(look, scheme, accent, density)` to this ticket: what does it return for Classic, which the code has not had?
- Which tickets build the saved copy on the device and the first-paint script, and does this ticket have to put the default (Calm and the device's scheme) on the page before they exist?
- The prototype draws extra colours for the Classic sidebar (`--side-*`) that are not among the 32 properties of the tokens: does the app carry them as properties of the Classic states, or does the ticket that draws the sidebar decide?
- The pwa spec's theme colour for the manifest (`#0E1214`) was a Focus value: is it Calm dark's value now?
