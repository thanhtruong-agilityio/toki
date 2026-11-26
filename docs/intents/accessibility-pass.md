# Intent: Accessibility pass
Author: Thanh Truong

## Problem
Every screen of phase 1 is specified on its own, and most specs already say how their pieces behave for a keyboard and a screen reader: names on icon buttons, a focus trap in dialogs, arrow keys in menus, a live region for toasts. Nobody yet looks at the finished app as a whole. A control can be built to its own spec and still be unreachable in the page, a screen change is silent to a screen reader, a dialog can return focus to a button that has left the page, a colour pair can be too faint, and an animation can keep running for a person who asked the device for none. Two specs also hand questions to this ticket and wait for it: moving focus to a message after a jump, and what the jump's flash does under reduced motion.
The decision log fixes only three rules (D-075, NFR-03): every icon-only button has a name, a modal traps focus and returns it to the opening button, and menus work with arrow keys. It sets no level (for example WCAG 2.2 AA), no contrast target and no rule for live regions or reduced motion beyond what the prototype's one global rule does.

## Proposed outcome
After this change a person who uses only a keyboard can do everything a mouse can do in phase 1 (outcome I14 of the plan: "usable by keyboard"), a screen reader says where the person is and what changed, focus is never lost, and nothing moves when the device asks for no motion. The proof is not a promise: an automated audit with axe in the browser runner of TOKI-008 scans every screen and state in both looks, both languages and both widths and fails the build on a violation; keyboard-only runs check each dialog, each menu and the keys of the composer, the palette and the lists; a source test and an emulated-motion test check reduced motion. What cannot be automated (what a screen reader says) is a manual pass with VoiceOver and NVDA that is recorded. A finding that the ticket cannot fix without a product decision (a colour that must change) is written in a register with its owner, not left out.

## Affected users and systems
- Every Member and Admin who uses a keyboard, a screen reader, a magnifier, a switch device or a device set to reduce motion. A Guest is a phase 5 role (D-090, D-152) and is not built.
- The web app (`apps/web`) and `packages/ui-web`: small additions only (one announcer, a focus call after a jump, one motion rule); the screens themselves are not redesigned.
- The browser runner of TOKI-008 (`e2e/`), where the audit and the keyboard runs live, and `pnpm test`, where the contrast of the tokens is computed.
- The specs that name this work: the jump to a message (TOKI-068), extra states (TOKI-082), the preferences screen (TOKI-078).
- No server code, no table and no route.

## Constraints
- Every icon-only button has a name for screen readers (lint checks it). A modal traps focus and returns it to the opening button. Menus work with arrow keys. Measure: an automated check finds no unnamed button, and a keyboard-only run of each modal and menu. Source: D-075, NR9, NFR-03.
- No feature is hover-only or desktop-only. Source: D-067, NFR-02.
- English by default and Vietnamese, both fully translated; both looks. Every text goes through i18n, and a wording the prototype lacks is a proposal. Source: D-018, NFR-05, D-139.
- The smallest supported window is 360 by 560. Source: NR2 (plan, TOKI-015).
- The prototype's colours are taken unchanged and no contrast target is set; a target set later changes the tokens package in its own ticket. Source: TOKI-009 concern 5.
- The toast timer stops while the pointer is over a toast or focus is inside it. Source: TOKI-013 concern 2.
- The browser tab title is `(3) Toki` for unread mentions and direct messages. Source: D-122.
- Outcome I14: "usable by keyboard, with a state for every situation". Milestone M6, size M. Source: Toki Blueprint, ticket TOKI-083.

## Open questions
- Which level is the target (for example WCAG 2.2 AA), and does it include reflow at 320 px when the smallest window is 360 px?
- What is audited with a tool and what is built, and which screens are in scope?
- What are the keys of the app, and are shortcuts beyond Ctrl+K wanted (for example for Undo)?
- Where do the findings go, and who changes a colour that is too faint?
- What does a screen reader hear on a screen change, a new message, an unread count and a toast?
- What does the flash of a jump, the skeleton and a toast do for a person who reduces motion?
- Does focus move to the message after a jump?
- Does each screen get its own tab title?
- Is a skip link wanted, for a person who uses only the keyboard?
