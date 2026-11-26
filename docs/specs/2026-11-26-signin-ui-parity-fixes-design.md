# Sign-in card parity design

Date: 2026-11-26 · Status: draft for review
Intent: docs/intents/signin-ui-parity-fixes.md (Thanh Truong)
Ticket: TOKI-136

## Goal
A person who signs in to Toki sees a card that looks like the prototype's guest sign-in card, the design the sign-in spec (TOKI-023) follows. A run of the UI parity check on the sign-in page found four differences that no spec decided: the shadow of the card, the size of the workspace name, the size of the heading of the code step, and the placeholder of the code field. Two more differences are not in the sign-in spec either, the second line "on Toki" and the place of the link 'Use a different email'. After this change the card shows none of them, and each difference that stays is recorded with its reason.

## Scope
- In: the shadow of the card (R1), the workspace name and the line under it (R2, R7), the heading of the code step (R3), the placeholder of the code field (R4), the place of the link (R8), the record of the differences that stay (R5), and the tests (R6).
- Out (not now):
  - A text, a button or a behaviour that the sign-in spec decided: 'Send code', 'Resend code', the line 'The code works for 10 minutes', the disabled 'Sign in', the card near the top of a narrow screen, the focused field (`docs/specs/2026-11-16-sign-in-screens-design.md`, R4, R8, R36 and "Layout at the three widths").
  - The pages after sign-in, the session-ended modal, the join page, and the check itself.

## Requirements
- R1. The card of the sign-in page draws the shadow of the token `--shadow`, as the prototype's card does, and not `--pop`. In Focus the token is none, so the card has no shadow there. Check: a test reads `packages/ui-web/src/sign-in/sign-in.css` and finds `box-shadow: var(--shadow)` in the rule `.gcard`; a Focus row of the UI parity check no longer frames the shadow.
- R2. The row of the logo and the workspace name is drawn as the prototype's card draws it: the name is 14px and bold, in the body font; the space between the logo and the name is 8px; the space under the row is 14px. Check: a test reads the rules `.gws` and `.gws .gwn` of `sign-in.css` and finds `gap: 8px`, `margin-bottom: 14px`, `font-size: 14px` and `font-weight: 700` and no `font-family`.
- R3. The heading of the code step ('Check your email') is 22px with a margin of 4px above and 6px below, as the prototype's heading is. Check: a test reads the rule `.gcard h1` of `sign-in.css` and finds `font-size: 22px` and `margin: 4px 0 6px`.
- R4. The code field shows a placeholder of `codeLength` zeros (`000000` for the 6 digits of the shared constant), in the style of the code field. The label 'Code' stays: the placeholder is not the name of the field. Check: a component test of `CodeField` finds the field by its label 'Code' and checks that it has the attribute `placeholder="000000"` (`codeLength` zeros), both when the field is empty and when it holds a digit, because the attribute stays whatever the value is. That the browser hides the placeholder once the first digit is typed is browser behaviour, not asserted by the component test (jsdom does not render it); it is seen in the check of the UI parity run and in the sign-in end-to-end case.
- R5. After this change, each row of the UI parity check for the email step and the code step of the sign-in page (Calm and Focus, wide, mid and narrow: 12 rows) is `match`, or is listed in `e2e/parity/known-differences.ts` with a reason that names the requirement of the sign-in spec that decided the difference, and the ticket `accepted` (concern 3). Check: a run of the check lists no new difference for these rows.
- R6. The existing tests of the sign-in components, of the login route and of the sign-in end-to-end cases pass without a change to what they expect, except the tests of the card that R7 and R8 change: no other text, button or behaviour changes. Check: `pnpm test`, and `pnpm exec playwright test e2e/sign-in.spec.ts`.
- R7. When the card shows the workspace name, it shows a second line under the name, `on Toki` in English and `trên Toki` in Vietnamese, from a text key of `packages/i18n` (`signIn.card.platform`), in 11.5px and the muted colour, as the prototype's card does. When the name is not known (it loads, or the read failed) the card shows the logo alone, as it does today, and no second line. Check: a component test of `SignInCard` finds the line with a name and finds none without; the English and Vietnamese catalogues have the key (`pnpm i18n:check`).
- R8. In the code step the link 'Use a different email' is at the left of the card, with 10px above it, as the prototype's card has it. Check: a test reads the rule `.gcard .glinks` of `sign-in.css` and finds `text-align: left` and `margin-top: 10px`.

## Design
The change is in `packages/ui-web/src/sign-in/` and nothing else of the app:
- `sign-in.css`: `.gcard` takes `box-shadow: var(--shadow)` (line 20 today `var(--pop)`); `.gws` takes `gap: 8px` and `margin-bottom: 14px` (today 10px and 16px); `.gws .gwn` takes `font-size: 14px` and loses its `font-family` (today Bricolage Grotesque at 17px, line 44); `.gcard h1` takes `font-size: 22px` and `margin: 4px 0 6px` (today 20px and `0 0 4px`, line 50); `.gcard .glinks` takes `text-align: left` and `margin-top: 10px` (today centred, 12px); a new rule for the second line (R7).
- `SignInCard.tsx`: the name and the second line are in one block next to the logo; the second line is drawn only when there is a name (R7). `packages/i18n`: the key `signIn.card.platform` in `en` and `vi`.
- `CodeField.tsx`: the field gets `placeholder={"0".repeat(codeLength)}`. The `.inp.code` style already draws it in the monospace face with the spacing of the code (`Field.css`, `.inp.code` and `.inp::placeholder`).
- `e2e/parity/known-differences.ts`: one entry for each row that still differs after the change, with the reason (R5).

What the prototype draws, for the values above: the card has `box-shadow: var(--shadow)` (`e2e/prototype/index.html:709`), its heading is `.gcard h1` at 22px (line 710), its workspace name is a `<b>` in the body, which is 14px (line 60), and its code field has the placeholder `000000` (function `guestHtml`).

### Layout
```
packages/ui-web/src/sign-in/sign-in.css     R1, R2, R3
packages/ui-web/src/sign-in/CodeField.tsx   R4
packages/ui-web/src/sign-in/SignInCard.tsx  R7
packages/i18n/src/messages/{en,vi}/         R7 (the key signIn.card.platform)
packages/ui-web/tests/sign-in/              tests of R1 to R4, R7, R8
e2e/parity/known-differences.ts             R5
```

## Testing
- The tests of R1 to R4, R7 and R8 are written first and seen to fail, in `packages/ui-web/tests/sign-in/` (the component tests of the code field and of the card, and a test of the style rules that reads the CSS file).
- This ticket is built after the one that declares the sign-in screens in the check (TOKI-137, concern 4). Then the check is run in the container before and after: the report lists the rows of R5, and the difference of the shadow, of the name, of the heading and of the link is no longer framed in the picture of the difference.
- Data used is fake only: the addresses of the stubs of the check (`example` domains) and the made-up code.

## Data safety
- No data is read, stored or sent by this change; it draws a card.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| A text, a button or a behaviour that the sign-in spec decided is not changed | Scope, Out; R6; the only new text is the second line of R7, which the sign-in spec does not decide |
| The pages keep working with the keyboard and a screen reader; the placeholder does not replace the label | R4 (the label stays; a test finds the field by it) |
| Calm and Focus both follow the design tokens | R1 (the token `--shadow`, none in Focus), R2, R3 |

## Open questions from the intent
- Is the second line "on Toki" under the workspace name a part of the design to build, or something the prototype shows that the app leaves out? Answered: it is built (R7). Decided by Thanh Truong (lead, as product owner) on 2026-11-26. See concern 1.
- Does the link "Use a different email" stay at the centre of the card, as it is, or move to the left, as the prototype has it? Answered: it moves to the left (R8). Decided by Thanh Truong (lead, as product owner) on 2026-11-26. See concern 2.
- Where the app differs from the prototype and the sign-in spec decided it, is the difference recorded as known in the check, or left as it is? Answered: recorded as known, with its reason (R5). Decided by Thanh Truong (lead, as product owner) on 2026-11-26. See concern 3.

## Areas of concern
1. The second line "on Toki" under the workspace name. The prototype draws it in `.xs muted` (11.5px); the sign-in spec lists exactly the logo and the workspace name for the email step (R4) and does not mention it. It needs a text key in `packages/i18n` in English and Vietnamese. Decided by Thanh Truong (lead, as product owner) on 2026-11-26: it is built (R7); it is drawn with the name and not without it, because a line 'on Toki' beside a logo with no name would say nothing; the Vietnamese wording `trên Toki` is checked by the reviewer of the pull request. Owner: Thanh Truong.
2. The alignment of the link 'Use a different email'. The prototype draws it at the left of the card; the app centres it in `.glinks` (`text-align: center`), and the sign-in spec lists the link without saying where. Decided by Thanh Truong (lead, as product owner) on 2026-11-26: it moves to the left, as the prototype has it (R8). Owner: Thanh Truong.
3. Recording the differences that stay (R5). The sign-in spec decided the wording, the extra buttons, the card near the top on a narrow screen and the focused field, so those rows keep differing; each is recorded as known with its reason, as the Admin rows are. Decided by Thanh Truong (lead, as product owner) on 2026-11-26 (R5). Owner: Thanh Truong.
4. The order of the tickets. The 12 rows of R5 exist only when the sign-in screens are declared in the check, which another ticket (the app root of the check, TOKI-137) builds. Until it is on `main`, R5 is proved by a run of the check made by hand with that change. Decided by Thanh Truong (lead, as product owner) on 2026-11-26: TOKI-137 is built first, and this ticket is proved by the check once that change is on `main`. Owner: Thanh Truong.
