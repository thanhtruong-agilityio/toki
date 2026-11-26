# Intent: Separate the look of Toki from light and dark
Author: Thanh Truong

## Problem
Toki has one setting for two different things. The attribute that the page carries (`data-eff`, set by `applyAppearance`) is `calm` or `focus`, and each value brings both a layout and a set of colours: Calm is the roomy layout with a 272 px sidebar and the light colours, Focus is the dense layout with a 68 px rail and a conversation column and the dark colours. The choice "Match my device" picks one of the two from the dark mode of the system. So a person cannot have the dense layout in light, or the roomy layout in dark.

The owner's look settings need more. They have three looks, each with its own description, and say that a look "works with light and dark" and "follows you to your other devices":
- Calm: "Airy and soft: light cards, rounded corners, roomy rows."
- Focus: "Dense and dark first: tight rows, messages up front."
- Classic: "Toki as it has always been: dark sidebar, compact rows."

The prototype has two looks and no Classic, and the specs say two: the Look cards of the Preferences screen are Calm, Focus and "Match my device" (TOKI-078 R3), `applyAppearance` takes `look` as `calm`, `focus` or `device` (TOKI-015 R28), the tokens are written for these two (TOKI-009), and the three layouts of the shell are Calm, Focus and the narrow one (TOKI-015 R18, Table F). The tickets that build the Classic sidebar and the new Look cards cannot start until these decisions say what a look is.
Source: the owner's picture of the look settings (2026-11-26); `packages/ui-web/src/appearance.ts`; `packages/tokens/src/tokens.css`; `docs/specs/2026-11-16-app-shell-design.md` (R18, R10); the spec of TOKI-078 (R3).

## Proposed outcome
- A person chooses one of three looks, Calm, Focus or Classic, and, separately, light, dark or the setting of the device.
- Each look is defined in light and in dark, so every combination is a state that the product supports.
- The look and the colour scheme are saved for the person, and follow them to their other devices; the page shows them from the first paint.
- The decided specs that name two looks, or tie a look to a colour scheme, say the new model, so that the tickets that follow (the prototype, the appearance code, the Classic sidebar, the Look cards) build on one description.
Source: the requirement of this run.

## Affected users and systems
- Users: every person who signs in to Toki, on any device; the builders of the screens, who draw a screen in each look.
- Systems: the specs of the shell (TOKI-015), the Preferences screen (TOKI-078), the design tokens (TOKI-009) and the UI parity check (its looks are Calm and Focus, mapped to light and dark). This work is a decision and a change of specs; it changes no code.

## Constraints
- What the shell spec decided about the layouts stays unless this work says otherwise: Calm has the sidebar of 272 px, Focus the rail of 68 px and the column of 288 px, and the narrow layout has the bottom bar.
- The names and the descriptions of the three looks, and the line "Only you see your look. It works with light and dark, and follows you to your other devices.", are the owner's wording.
- A person who has saved one of today's looks keeps a look that is as close as the new model allows; no one is left without a look.
Source: `docs/specs/2026-11-16-app-shell-design.md` (R18); the owner's picture of the look settings.

## Open questions
- Does a person choose light, dark or the setting of the device in their own section of Preferences, or does the product follow the device only?
- What colour scheme does each look have for a person who has chosen none?
- Is the layout of Classic the rail and the column of Focus, with other colours and rows, or its own layout? The owner's picture of the Classic sidebar shows a rail of 68 px with labels under the icons and a column.
- What does a person who has saved "Match my device" become: a look (which one) with the scheme of the device?
- Is each decided requirement amended in its own spec, or is one new spec the source of the model and the older ones point to it?
