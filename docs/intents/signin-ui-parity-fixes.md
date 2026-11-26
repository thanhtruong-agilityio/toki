# Intent: Make the sign-in card match the prototype
Author: Thanh Truong

## Problem
The UI parity check compared the sign-in page of the app (`/login`) with the prototype's guest sign-in card, the design the sign-in spec follows. Every one of the 12 rows (the email step and the code step, in Calm and Focus, at 1280, 900 and 390 px wide) is above the limit of different pixels (0.03 to 0.17 against a limit of 0.02). Part of the difference is decided in the sign-in spec (the wording, the extra buttons, the card near the top on a narrow screen, the focused field). The rest is not, and a person who looks at the two pictures sees it:
- The shadow of the card is heavier in the app than in the prototype, and in Focus the app draws a shadow where the prototype has none.
- The workspace name is larger in the app, and the prototype shows a second line, "on Toki", under it that the app does not.
- The heading of the code step is smaller in the app than in the prototype.
- The code field of the prototype shows the placeholder "000000"; the field of the app is empty.
- The link "Use a different email" sits at the left of the card in the prototype and at the centre in the app.
Source: the report and the images of a run of the UI parity check on the sign-in page (2026-11-26); `docs/specs/2026-11-16-sign-in-screens-design.md` (R4, R8, "Layout at the three widths").

## Proposed outcome
- The sign-in card, in both steps and both looks, shows no difference from the prototype's card other than those that the sign-in spec decided.
- The differences that the sign-in spec decided stay as they are.
- Each difference that is kept on purpose is recorded with its reason, so that a later run of the check lists it as known and not as new.
Source: the requirement of this run.

## Affected users and systems
- Users: everyone who signs in to Toki, on a desktop or a phone. The reviewer, who compares the screen with the prototype.
- Systems: the sign-in components of `packages/ui-web/src/sign-in/` and their styles, the texts of `packages/i18n`, and the list of known differences of the UI parity check.

## Constraints
- A text, a button or a behaviour that the sign-in spec decided is not changed by this work.
- The pages keep working with the keyboard and a screen reader; the placeholder does not replace the label.
- Calm and Focus both follow the design tokens of the app.
Source: the sign-in spec; `docs/specs/2026-11-16-sign-in-screens-design.md`, "Keyboard and screen readers".

## Open questions
- Is the second line "on Toki" under the workspace name a part of the design to build, or something the prototype shows that the app leaves out? The sign-in spec does not mention it.
- Does the link "Use a different email" stay at the centre of the card, as it is, or move to the left, as the prototype has it? The sign-in spec does not say.
- Where the app differs from the prototype and the sign-in spec decided it, is the difference recorded as known in the check, or left as it is?
