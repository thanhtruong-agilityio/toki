# Look and scheme model design

Date: 2026-11-26 · Status: draft for review
Intent: docs/intents/look-and-scheme-model.md (Thanh Truong)
Ticket: TOKI-142

## Goal
A person must be able to choose how Toki is laid out and, separately, whether it is light or dark. Today one choice sets both: Calm is roomy and light, Focus is dense and dark, and "Match my device" picks one of the two from the system's dark mode. The owner's look settings have three looks (Calm, Focus, Classic) that each "work with light and dark". Once TOKI-142 is developed, the specs describe two independent choices, a look and a colour scheme, and the six combinations they make. The tickets that follow (the prototype, the appearance code, the Classic sidebar, the Look cards) build on this one description.
This ticket changes specs only, in two pull requests. This pull request adds the intent and this spec, which write the model. The development of TOKI-142, in its own pull request after this one is merged, edits the decided specs that name two looks or tie a look to a colour scheme, so that none of them contradicts the model.

## Scope
- In, this pull request: the model (two attributes, their values, the six states); what is saved and where; the first paint; the move of a person's saved look to the new model; the words of the Look cards in Preferences.
- In, the development of TOKI-142 (a later pull request): the wording changes in the decided specs of the shell (TOKI-015), the tokens (TOKI-009), the Preferences screen (TOKI-078) and the UI parity check (TOKI-109) that follow from the model (R10).
- Out (not now): any code, CSS or token value; the colour values of the four new states (the prototype ticket draws them, and the tokens ticket copies them); the content of the Classic sidebar, its rows, header and rail buttons (the shell and list specs keep R10 and D-155 until the ticket that builds that sidebar changes them); a fourth look; a custom accent per look.

## Requirements
- R1. Two attributes. The page has `data-look` (`calm`, `focus` or `classic`) and `data-scheme` (`light` or `dark`) on the root element. They replace `data-eff`, which no spec names once TOKI-142 is developed, except in the places listed in the check. `data-look` selects the layout, the sizes of rows and radii, and what the look draws (the shell's selectors, TOKI-015 R17). `data-scheme` selects the colours. `data-accent` and `data-density` stay as they are. Check, in the development pull request of TOKI-142: a search over `docs/specs` finds `data-eff` only in three places: the Problem of `docs/intents/look-and-scheme-model.md`, this spec, and the "was ... now ..." phrases that R10 requires in the edited specs; nowhere else.
- R2. Six supported states. Every combination of a look and a scheme is a supported state of the product. Each state has its own full set of the design system's 32 properties (TOKI-009 R10), so the colours of one look in light and in dark are separate values and a look is never "the other look's colours with a filter". Calm light and Focus dark are the values of today's Calm and Focus. Calm dark, Focus light, Classic light and Classic dark are new and come from the prototype (the prototype ticket). Check: the tokens spec lists six blocks, each declaring the 32 properties.
- R3. The scheme choice. The colour scheme is `light`, `dark` or `device`. With `device`, `data-scheme` is `dark` when `matchMedia("(prefers-color-scheme: dark)")` matches and `light` otherwise, and follows the device's setting while the app runs. "Match my device" is no longer a look: it is the value `device` of the scheme. The look is never chosen by the device. Check: the shell spec's R28 describes `applyAppearance({ look, scheme, accent, density })` with `look` in the three values and `scheme` in the three values.
- R4. The looks and their words. The Look cards are Calm, Focus and Classic, in this order, with the owner's descriptions: Calm "Airy and soft: light cards, rounded corners, roomy rows."; Focus "Dense and dark first: tight rows, messages up front."; Classic "Toki as it has always been: dark sidebar, compact rows." The section ends with "Only you see your look. It works with light and dark, and follows you to your other devices." Check: the Preferences spec's R3 names these three cards and these four texts, and no card "Match my device".
- R5. The layouts. Calm keeps the sidebar of 272 px, and Focus the rail of 68 px and the conversation column of 288 px, as TOKI-015 R18 decided; the narrow layout (719 px and below) keeps the bottom bar in all three looks. Classic has the frame of the owner's picture: a rail of 68 px with the workspace tile, the section buttons with labels under their icons, and the account at the bottom, and a column with the workspace header, the search and the conversation list. Its sizes are decided with the ticket that builds it (concern 3). Check: the shell spec's R18 and Table F name the three looks; Classic's rows say "as Focus unless that ticket says otherwise".
- R6. What is saved. The account saves two values, `look` (`calm`, `focus` or `classic`) and `scheme` (`light`, `dark` or `device`), next to `accent` and `density`. They are the person's own choice: they follow the person to every device and no one else sees them. The device keeps a copy of both for the first paint (TOKI-078 R8), so that a person whose saved look and scheme differ from the device's setting sees their own from the first paint of a visit. Check: the Preferences spec's R6, R7 and R8 name both values and the copy holds both.
- R7. The first paint before any script. A page that has not set `data-look` and `data-scheme` yet shows the look Calm (concern 2) in the scheme of the device: the device block of the tokens (TOKI-009 R12) changes to `:root:not([data-scheme])` inside the dark media query and holds the dark values of the look Calm, a new set that the prototype ticket draws, so the tokens ticket depends on the prototype ticket; the light values are the bare `:root` block. Check: the tokens spec's R11 and R12 say so, and its test of the 30 states (TOKI-009 R16: 24 with `data-eff`, 6 without) becomes a test of 78 states: 72 with both attributes (3 looks x 2 schemes x 4 accents x 3 densities) plus 6 without them (a light and a dark device x 3 densities, no accent attribute).
- R8. A person who saved a look before this change. No one is left without a look, and the first visit after the change looks as close as it can to the one before (concern 4): a person with Focus on a dark device and a person with Calm on a light device see no change of layout or colours. Where it runs: on the client, once, because the account holds one `look` for all devices and only the device in the person's hand knows its own light or dark setting. When the app has loaded the account's preferences and finds a saved look of the old kind (`calm`, `focus` or `device`) with no saved `scheme`, it works out the pair by the table below and saves it once with the ordinary save of TOKI-078 R7 (`{ look, scheme }`). A load that finds a saved `scheme` does nothing, so the first device to load decides and every later device reads the result. The table: `calm` becomes look `calm` with scheme `light`; `focus` becomes look `focus` with scheme `dark`; `device` becomes scheme `device` and the look that the device shows at that moment, as today's rule gives it (Focus when `matchMedia("(prefers-color-scheme: dark)")` matches, Calm otherwise), which then stays. The first paint: the device's copy of the old shape (its old version number, R6) is not read as absent. The first-paint script maps it by the same table, with `device` resolved by `matchMedia` at that moment, so no one sees the default look before the account has loaded; the app then writes the copy of the new shape. A copy that is absent or unreadable gives the default of R7, as before. Check: the Preferences spec has the table, the place the move runs and the rule that a saved `scheme` stops it; tests for each of the three moves, for `device` on a dark and on a light device, for a second device that loads after the move and changes nothing, and for the first-paint script reading each old copy.
- R9. The scheme control. The person can choose `light`, `dark` or `device` in Preferences (concern 1). It is a control of three options in the section Look, below the cards, with `device` named "Match my device" and showing "Currently light" or "Currently dark". Check: the Preferences spec has the requirement, its words and a render test for the three pressed states.
- R10. The decided specs that change. The development of TOKI-142 edits, in place, in its own pull request after this one is merged: TOKI-015 (R17, R18, R28, Table F and the lines that say `data-eff`); TOKI-009 (R10 to R16, the layout paragraph and the first-paint block); TOKI-078 (R3, R6, R7, R8, and the concerns that name "Match my device"); TOKI-109 (the screens' `looks` and the name of the two looks in its reference images). Each edited line says what it was and what it is now in one phrase, so a reader of the diff sees the move. The five specs keep their ticket numbers and their other requirements. Check: the diff of that development pull request touches only these files and lines, and `spec-lint.sh` and `spec-ready.sh` still pass on each.
- R11. The parity check. The check's screens take a look and a scheme, not a look that stands for both. It keeps drawing Calm and Focus in their default schemes (light and dark) and adds Classic in its default scheme, Classic dark; drawing all six on every screen is not asked for (concern 7). Check: the UI parity spec's declaration lists `look` and `scheme`, and the reference images are unchanged for Calm light and Focus dark.

## Design
### Attributes and values
| Attribute | Values | Sets |
| :---- | :---- | :---- |
| `data-look` | `calm`, `focus`, `classic` | layout, row sizes, radii, what the look draws |
| `data-scheme` | `light`, `dark` | the 32 colour properties and `color-scheme` |
| `data-accent` | `teal`, `indigo`, `clay`, `violet` | accent properties (unchanged) |
| `data-density` | `comfortable`, `compact` or none | row sizes (unchanged) |

### The six states
| | light | dark |
| :---- | :---- | :---- |
| Calm | today's Calm | new |
| Focus | new | today's Focus |
| Classic | new (a dark sidebar in a light page: concern 6) | new |

### Selectors
The tokens use `:root[data-look="<look>"][data-scheme="<scheme>"]` for the six blocks and the accent blocks add `[data-accent]` as they do now. The shell's CSS keeps selecting layout by `data-look` and never by `data-scheme`; a rule that differs only by colour belongs to the tokens. The tokens' bare `:root` is the default look in light.

### Saved values
The account's preferences carry `look` and `scheme`. The device's copy (TOKI-078 R8) is a JSON value with both, under a new version number so an old script reads an old copy as absent.

### Move of a saved look (R8)
| Saved before | Look now | Scheme now |
| :---- | :---- | :---- |
| `calm` | `calm` | `light` |
| `focus` | `focus` | `dark` |
| `device` | Focus on a dark device, Calm on a light one, at the first load (once) | `device` |

## Testing
- The edited specs pass `spec-lint.sh` and `spec-ready.sh` once their own open items are answered.
- After the development pull request of TOKI-142, a search of `docs/specs` finds `data-eff` only in the Problem of the intent, in this spec and in the "was ... now ..." phrases of R10, and finds "Match my device" only where R3 and R9 allow it (the scheme value `device`).
- The tables above are the source for the tests of the tickets that follow: the six token blocks, the 78 states (72 + 6), the three moves of R8, the three pressed states of R9.
- No code is changed, so no code test is added or run.

## Data safety
- The two saved values are a person's own display choice; they hold no personal data and are saved with the account's existing preferences route.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| What the shell spec decided about the layouts stays: Calm 272 px, Focus rail 68 px and column 288 px, narrow layout with the bottom bar | R5; Classic's sizes are the only thing left to decide (concern 3) |
| The names, the descriptions and the closing line of the look settings are the owner's wording | R4 |
| A person who saved one of today's looks keeps a look as close as the model allows; no one is left without a look | R8 and its table |

## Open questions from the intent
- Does a person choose light, dark or the device's setting in their own section of Preferences, or does the product follow the device only? Answered in concern 1: yes, in Preferences.
- What colour scheme does each look have for a person who has chosen none? Answered in concern 2: Calm with the scheme `device`.
- Is the layout of Classic the rail and the column of Focus with other colours and rows, or its own layout? Answered in concern 3: the same frame as Focus; sizes settled by the Classic ticket.
- What does a person who saved "Match my device" become? Answered in concern 4: the look the device shows at the first load, with the scheme `device`.
- Is each decided requirement amended in its own spec, or is one new spec the source and the older ones point to it? Answered in concern 5: amended in place.

## Areas of concern
1. Whether the person chooses the scheme in Preferences (R9) or the product follows the device only. The owner's picture says a look "works with light and dark" and has no scheme control, but the picture has a sun button in the rail that looks like a toggle. Decided: Preferences has the control of R9, and the sun button of the Classic rail changes the scheme as the control does. Decided by Thanh Truong (lead, as product owner) on 2026-11-26. Owner: Thanh Truong.
2. The default for a person who has chosen nothing: which look, and which scheme. The proposal is the look Calm and the scheme `device`, because the first paint already follows the device (R7). Decided: the look Calm and the scheme `device`. Decided by Thanh Truong (lead, as product owner) on 2026-11-26. Owner: Thanh Truong.
3. The sizes of Classic: the same rail and column as Focus (68 px and 288 px, 356 px on Home) or its own. The picture shows labels under the rail icons, which may need a wider rail. Decided: Classic has the same rail and column as Focus (68 px and 288 px, 356 px on Home); the ticket that builds it may change the numbers if the labels under the icons need a wider rail, and says so in its spec. Decided by Thanh Truong (lead, as product owner) on 2026-11-26. Owner: Thanh Truong.
4. The move of a saved "Match my device" (R8). The first choice, the look Calm with the scheme `device`, changed the layout of a person who has Focus on a dark device today, which the constraint "as close as the model allows" does not allow. Changed after the review of the pull request: a saved `device` becomes the look that the device shows at the first load (Focus on a dark device, Calm on a light one) with the scheme `device`, and that look is saved once and then stays. Decided by Thanh Truong (lead, as product owner) on 2026-11-26, after the review of PR #441. Owner: Thanh Truong.
5. Whether the older specs are amended in place (R10) or one source spec is written and the older ones point to it. The proposal is in place, with this spec as the description of the model, because the ticket developers read one spec per ticket. Decided: the older specs are amended in place (R10). Decided by Thanh Truong (lead, as product owner) on 2026-11-26. Owner: Thanh Truong.
6. What Classic is in the light scheme. "Dark sidebar" is the owner's description, so in light the sidebar may stay dark over a light page, or the look may be light as a whole. The answer sets the Classic light values the prototype draws. Decided: in the light scheme Classic keeps its dark sidebar over a light page; only the content area follows the scheme. Decided by Thanh Truong (lead, as product owner) on 2026-11-26. Owner: Thanh Truong.
7. How much of the parity check covers the six states (R11): the default scheme of each look (three images per screen) or all six. All six doubles the images and the run time. Decided: the check draws the default scheme of each look, three images per screen: Calm light and Focus dark, as the owner decided, and a third image for Classic. Not decided by the owner: which scheme is Classic's default. Classic dark was proposed by the author, because its sidebar is dark. Accepted: Classic dark, until the owner says otherwise. Decided by Thanh Truong (lead, as product owner) on 2026-11-26 for the check's use of one default scheme per look. Owner: Thanh Truong.
