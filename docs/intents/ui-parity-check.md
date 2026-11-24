# Intent: UI parity check
Author: Thanh Truong

## Problem
Every screen of Toki has to look like the prototype, and the plan checks this at the end of M1 and again in every ticket that builds a screen. Today a machine does not do that comparison. The component preview page (TOKI-016) checks colours against values written by hand in the spec, takes screenshots that are compared with its own earlier screenshots, and leaves "matches the prototype" to a person who opens both pages side by side. A typo in a written value, or a later change to the prototype, goes unnoticed, and each later ticket (M2 to M6) repeats the by-eye work for its own screens.
Source: spec TOKI-016, Design "What 'matches the prototype' means here", R11, R15, R21, R24; ticket TOKI-090 "12 end-to-end flows: Complete at desktop and phone widths".

## Proposed outcome
- The builder can run one check that compares a built screen with the same screen of the prototype, in Calm and in Focus, at the desktop and the phone width, and when it fails the builder can see where the two differ.
- The design values (colours, radii, spacing, density) of the app are compared with the values of the prototype itself, not with a copy written by hand.
- Each later ticket that builds a screen adds its screens to this check, and does not build its own way of comparing with the prototype.
- The check gives the same result on the builder's machine and in CI.
Source: the requirement of this run.

## Affected users and systems
- Users: the builder (one person building with Claude) and the reviewer of a pull request, who today does the comparison by eye. End users of Toki are not affected directly.
- Systems: the web app, the Playwright end-to-end tests (TOKI-008), the component preview page (TOKI-016), the self-hosted fonts (TOKI-010), the prototype seed data (TOKI-081), and the CI end-to-end job.

## Constraints
- Needs the Playwright setup of TOKI-008, the design tokens and the preview page of TOKI-016, and the self-hosted fonts of TOKI-010 (all merged). A screen with data needs the prototype seed data of TOKI-081 (spec open).
- Does not change the specs of TOKI-008, TOKI-016 or TOKI-010. It adds a check beside theirs.
- The prototype to compare with is "Toki Prototype (Copy)" (https://claude.ai/artifact/QD2GPdeoxM8nMfsuxDtjDn). It is not yet known whether it is the same as the prototype of the Toki Blueprint that the TOKI-016 spec cites by line number.
- The TOKI-016 spec records that the prototype stays outside the repository (TOKI-095 spec, concern 4). CI cannot open a claude.ai link, which needs a sign-in.
- Browser: Chromium only, as decided for TOKI-008 (its concern 5). Widths: desktop and phone, as in TOKI-090.
- The check runs in the end-to-end job of CI (TOKI-007, TOKI-008, TOKI-107), and a failed run keeps its images (TOKI-107).
- Source: specs TOKI-008, TOKI-010, TOKI-016, TOKI-081; TOKI-090 in the Blueprint plan.

## Open questions
- Where does the prototype live for the check to read it, given the decision that it stays outside the repository and that CI cannot open the link? Keep that decision and read it from the Blueprint folder, or reverse it and keep a fixed copy in the repository?
- Is "Toki Prototype (Copy)" the same as the Blueprint's `docs/blueprint/prototype/index.html`? If not, which one is the reference?
- How much difference between the prototype and the app counts as a match for images (text rendering and animation make a perfect match unlikely)?
- Are all combinations of look, accent and density compared, or only a chosen few? TOKI-016 already lists the values for them.
- How is the reference kept up to date when the prototype changes, and who decides that a change is wanted?
- Does this check replace the by-eye comparison of TOKI-016 R21 and its own-images test R24 for later tickets, or does it sit beside them?
- Which milestone and which ticket number does it get, and which existing ticket must wait for it?
