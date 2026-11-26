# TOKI-142 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use cl-dev:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Edit the decided specs so that none says `data-eff` or ties a look to a colour scheme, as the model of `docs/specs/2026-11-26-look-and-scheme-model-design.md` (R1 to R11) says.

**Architecture:** Documents only, no code. The edits are grouped by spec family into four tasks that touch disjoint files, then one task checks the whole set. Rules of rewriting are in Design.

**Tech Stack:** Markdown specs; `.github/scripts/spec-lint.sh`, `spec-ready.sh`; `grep`.

**Spec:** docs/specs/2026-11-26-look-and-scheme-model-design.md (ticket TOKI-142, merged in PR #441).

## Global Constraints
- `data-eff` stays in `docs/specs` only in the model spec itself and in "was ... now ..." phrases of the edited specs (model R1). `docs/intents` and `docs/plans` are out of the check.
- Layout is selected by `data-look` (`calm`, `focus`, `classic`) and never by `data-scheme`; colours by `data-scheme` (`light`, `dark`) through the tokens; `data-accent` and `data-density` stay (model R1).
- "Match my device" is the value `device` of the scheme, not a look (model R3). Defaults: look Calm, scheme `device` (model R7, concern 2).
- Table J, the Classic row equals the Focus numbers (rail 68 px, column 288 px, 356 px on Home) (model R5, concern 3).
- A spec's readiness must not change: `spec-ready.sh` gives the same exit code and the same gap lines before and after (a spec with an open concern keeps it open, and no word "Decided" is added for an owner who did not decide).
- No change of any requirement number, ticket number, or of a requirement that has nothing to do with the look.

## How This Plan Was Created
1. **Spec provided:** docs/specs/2026-11-26-look-and-scheme-model-design.md
2. **Scan:** a read-only scan found 115 lines in 29 files with `data-eff`, "Match my device", the value `"device"`, or Calm/Focus tied to light/dark (class L layout, C colour, B both, P prose, D device).
3. **Recommended execution:** `cl-dev:subagent-driven-development`, one subagent per task (disjoint files), then the verifier.

## AC -> step -> test
| AC (model) | Step | Test |
| :---- | :---- | :---- |
| R1: two attributes; `data-eff` only in allowed places | T1 to T4 edit, T5 searches | `grep -rn "data-eff" docs/specs` lists only the model spec and lines that contain "was" in the same sentence |
| R2: six states, tests that can fail | T2 (tokens R11 to R16, QA spec) | tokens spec lists six blocks and a test that fails on a missing property, a non-literal value, or two equal blocks |
| R3: scheme `device`, `applyAppearance({ look, scheme, accent, density })` | T1 (shell R28, Design, concern 10) | `grep -n "scheme" docs/specs/2026-11-16-app-shell-design.md` shows R28 with both `look` and `scheme` values |
| R4: Look cards Calm, Focus, Classic, four texts, no "Match my device" card | T3 (preferences R3, Table B keys) | preferences R3 names the three cards and the four texts; `grep -n "Match my device" ` finds it only as the scheme option |
| R5: layouts; Classic row in Table J equals Focus | T1 (R18, Table J) | Table J has a Classic row and the Classic numbers equal the Focus column (read by eye and by `grep`) |
| R6: saved `look` and `scheme`, copy of both for first paint | T3 (preferences R2, R6, R8) | the three requirements name both values and the copy holds both |
| R7: first paint, device block `:root:not([data-scheme])`, 78 states | T2 (tokens R11, R12, R16 and Testing) | tokens R16 counts 78 states and R12 names the selector |
| R8: move of a saved look, where it runs, old copy, old client | T3 (preferences, new requirement and table) | preferences has the table, the place, the rule for a saved `scheme`, the old client rule |
| R9: scheme control in Preferences | T3 (preferences, new requirement) | requirement with words, three options, "Currently light" and "Currently dark", a render test |
| R10: each edited line says what it was and what it is | T1 to T4 | per edited requirement: "(was ...)" in the line; per table of CSS rows: one note under the table (see Design) |
| R11: parity check takes look and scheme; Calm light, Focus dark, Classic dark | T3 (ui-parity-check R2 and screens) | the parity spec's declaration lists `look` and `scheme`; the reference images are not changed |
| No readiness change | T5 | `spec-ready.sh` before and after, same output for each edited spec |

## Design
### Rewriting rules
1. **CSS selector tables (class L and B).** `[data-eff="calm"]` becomes `[data-look="calm"]` and `[data-eff="focus"]` becomes `[data-look="focus"]` in every row. The rules and their values do not change. A rule that is B (layout and `var()` colours) keeps its `var()`: the tokens give the value for each scheme (model, "Selectors"). Under each table one note says: "TOKI-142: every selector of this table was `[data-eff=...]` and is now `[data-look=...]`".
2. **Selector-ban lists (class P).** "`data-eff`, `data-look`, `data-accent` or `data-density`" becomes "`data-look`, `data-scheme`, `data-accent` or `data-density`" (was `data-eff`), in the requirement and in its QA copy.
3. **Colour uses (class C).** A token block or a colour statement that named `data-eff` names the new block (`:root[data-look="calm"][data-scheme="light"]` for the first one and so on), with one "was" phrase.
4. **Device uses (class D).** "Match my device" and `look: "device"` become the scheme value `device`. Where a sentence said the device chooses Calm or Focus, it says the device chooses the scheme, and the look is the saved one.
5. **Requirements that change in substance** (shell R17, R18, R28, Table J; tokens R10 to R16 and the first-paint text; preferences R2, R3, R6, R8, R9, R20, R24; parity R2): rewritten by hand with the numbers of the model; each edited line ends with "(was ...)" in one phrase (R10).
6. **New requirements** in the preferences spec: the move of a saved look (model R8) and the scheme control (model R9), numbered after the last requirement so no number changes.

### Interpretation of R10
"Each edited line says what it was and what it is now in one phrase" is read as: each edited requirement line carries its "(was ...)" phrase, and a table of CSS rows that were all renamed the same way carries one note under the table. A line-by-line note on 33 renamed selector rows would be longer than the table.

### What is left alone
- The model spec; the intents; `docs/plans/*` (historical: TOKI-009, TOKI-025 and TOKI-109 plans keep their words).
- Open concerns of the preferences spec that name "Match my device" (concerns 1, 4, 14): the text is reworded to the scheme, the status word is not changed (no decision is added for an owner who did not decide).
- Prototype `data-look` words that describe the prototype itself (tokens line 48, parity R2's `applyLook` list): kept, with the new names beside them.

## Tasks (disjoint files)
### Task 1: App shell spec
**Files:** `docs/specs/2026-11-16-app-shell-design.md`
- [ ] Rename the selectors of Table C (lines 267 to 308 and the sentences of Scope 14, 41 and R17 at 93, "The three layouts" at 141) by rule 1.
- [ ] Rewrite R28 (108), "The look on the page" (187), Errors (433), the constraint row (473) and concern 10 (496) by rule 5 and 4: `applyAppearance({ look, scheme, accent, density })`, `scheme` in `light | dark | device`, `data-look` and `data-scheme`, `main.tsx` calls `applyAppearance({ look: "calm", scheme: "device" })` (was `{ look: "device" }`).
- [ ] R18 and Table J: three looks; add the Classic row equal to the Focus numbers (the shell's Table F has no column per look); the narrow layout keeps the bottom bar for all three.
- [ ] Check: `grep -c "data-eff" ...` only in "was" phrases; `spec-lint.sh`; `spec-ready.sh` same as the baseline.
- [ ] Commit: `docs(spec): the shell selects its layout by data-look (TOKI-142)`.

### Task 2: Tokens family
**Files:** `docs/specs/2026-11-16-tokens-package-design.md`, `2026-11-25-tokens-package-qa-design.md`, `2026-11-25-pwa-design.md`, `2026-11-23-text-formatting-design.md`, `2026-11-16-base-components-1-design.md`, `2026-11-25-base-components-1-qa-design.md`, `2026-11-16-base-components-2-design.md`, `2026-11-16-component-preview-design.md`, `2026-11-25-component-preview-qa-design.md`, `2026-11-16-platform-package-design.md`
- [ ] Tokens R10 to R16, Scope 14, Design "Layout" (136, 137, 143), Testing (161), constraint row (183), concern 10 (210): six blocks `:root[data-look="<look>"][data-scheme="<scheme>"]`, the bare `:root` is Calm light, the dark device block is `:root:not([data-scheme])` in the dark query holding the dark values of Calm, accents by `[data-look][data-scheme][data-accent]` blocks, 78 states (72 with both attributes plus 6 without), the test of the six blocks fails on a missing property, a non-literal value or two equal blocks (model R2, R7).
- [ ] The tokens QA spec (43) says the 78 states; pwa (28, 33, 130) uses the new block names and the scheme; text-formatting (45), base-components-1 and 2 (Scope, R6, R20, 401, 454, 504, 70, 103), component-preview (34, 210, 295) and its QA (41), platform (27, 136) by rules 2 to 4.
- [ ] Check: as Task 1 for each file; the tokens spec states the number 78.
- [ ] Commit: `docs(spec): the tokens are written for a look and a scheme (TOKI-142)`.

### Task 3: Preferences and appearance consumers
**Files:** `docs/specs/2026-11-26-preferences-screen-design.md`, `2026-11-23-command-palette-design.md`, `2026-11-16-sign-in-screens-design.md`, `2026-11-25-app-shell-qa-design.md`, `2026-11-24-ui-parity-check-design.md`
- [ ] Preferences: Goal (9); R2 (`look` `calm | focus | classic`, new `scheme`); R3 (three cards with the four owner's texts, no "Match my device" card); R6 and R8 (apply and first paint with both values; the old-shape copy is mapped by the table); R20 and R24; Table B keys (157 to 159 become the scheme option's keys "Match my device", "Currently light", "Currently dark" and new keys for the Classic card); constraint rows (212, 220); open questions (231, 236, 239); concern 14 (249): rewritten with the scheme; no status word added.
- [ ] Add the new requirements: the scheme control (model R9) and the move of a saved look (model R8, with the table and the old client rule), numbered after the last requirement.
- [ ] Command palette (188), sign-in (341), shell QA (52): rule 4. Parity check R2 and the screens: `look` and `scheme` (model R11): Calm light, Focus dark, Classic dark; reference images unchanged.
- [ ] Check: as Task 1; `spec-ready.sh` for the preferences spec gives the same gaps as the baseline.
- [ ] Commit: `docs(spec): preferences choose a look and a scheme (TOKI-142)`.

### Task 4: Layout tables and selector bans
**Files:** `2026-11-17-conversation-list-design.md`, `2026-11-17-archive-restore-channel-design.md`, `2026-11-17-conversation-header-details-design.md`, `2026-11-23-composer-design.md`, `2026-11-25-pause-focus-time-design.md`, `2026-11-16-overlays-design.md`, `2026-11-16-destructive-patterns-design.md`, `2026-11-25-destructive-patterns-qa-design.md`, `2026-11-17-add-remove-people-design.md`, `2026-11-17-admin-page-design.md`, `2026-11-17-browse-channels-people-picker-design.md`, `2026-11-26-people-screen-design.md` (all under `docs/specs/`)
- [ ] Rule 1 for the CSS tables (conversation-list 56, 123, 129, 156 to 159, 277; archive 136; conversation-header 214; composer 106; pause-focus-time 59) with the note under each table.
- [ ] Rule 2 for the selector-ban lines (overlays 92, destructive 35 and its QA 41, add-remove 57, admin 91, browse 64, people 51).
- [ ] Check: as Task 1.
- [ ] Commit: `docs(spec): layout selectors name data-look (TOKI-142)`.

### Task 5: Whole-set check
**Files:** none edited except fixes the check finds.
- [ ] `grep -rn "data-eff" docs/specs` finds only the model spec and "was" phrases; `grep -rn "Match my device" docs/specs` finds it only as the scheme option, in concern text or in a "was" phrase.
- [ ] `spec-lint.sh` on every edited spec reports no gap; `spec-ready.sh` output equals the baseline saved before Task 1 (`<git common dir>/dev-state/TOKI-142.ready-before.txt`: 21 specs exit 0, 7 exit 1: text-formatting, composer, preferences, people, command-palette, pause-focus-time, pwa).
- [ ] `git diff --stat github/main` lists only the 28 specs of Tasks 1 to 4 and the plan and state files.
- [ ] Verifier agent with this plan, the diff and the AC table; `/code-review`.

## What can break (grilling round 1)
- Riskiest step: Task 3 (the preferences spec is the longest and has open concerns; a reword can read as a new decision) and Task 2 (the count of states and the block selectors must agree with the model). Mitigation: baseline of `spec-ready.sh` before each task; the model's numbers are copied, not recomputed.
- A selector rename is not a pure rename for B rules (layout rule with colour). Mitigation: Design rule 1 says the `var()` stays and the tokens give the scheme's value.
- A spec that is not in the scan but names the old attribute under another spelling (`data-look="calm"` in a bash example, `[data-eff]` in code blocks). Mitigation: the final grep in Task 5 covers `data-eff` anywhere; the scan covered the four spellings; `eff=` is also grepped.
- Parallel tasks and one file: the file lists are disjoint (checked: 28 specs, each in one task).
