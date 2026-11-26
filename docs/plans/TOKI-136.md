# TOKI-136 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use cl-dev:executing-plans to implement this plan task-by-task.

**Goal:** The sign-in card matches the prototype's guest sign-in card where the sign-in spec decided nothing: shadow, workspace name and its second line, heading, code placeholder and link place.

**Spec:** docs/specs/2026-11-26-signin-ui-parity-fixes-design.md (tier M)

## Design

Everything is in `packages/ui-web/src/sign-in/` and `packages/i18n`; no page, route or behaviour changes.

**D1. Style values** (`sign-in.css`, R1 to R3, R8). The values are those of the spec; nothing is added:
- `.gcard`: `box-shadow: var(--shadow)` (was `var(--pop)`). In Focus the token is `none`, so no shadow.
- `.gws`: `gap: 8px`, `margin-bottom: 14px` (were 10 and 16).
- `.gws .gwn`: `font-size: 14px`, `font-weight: 700`, no `font-family` (the body font of `fonts.css` applies), no `letter-spacing` (it was for the display font).
- `.gcard h1`: `font-size: 22px`, `margin: 4px 0 6px` (were 20 and `0 0 4px`). The display font stays.
- `.gcard .glinks`: `text-align: left`, `margin-top: 10px` (were centre and 12px). The rule `.gcard .linkbtn` of narrow screens (40px tall) stays.

**D2. The second line** (`SignInCard.tsx`, R7). When there is a name, the name and a second line are in one block next to the logo:
```tsx
{name !== undefined ? (
  <div className="gwt">
    <span className="gwn">{name}</span>
    <span className="gwp xs muted">{t("signIn.card.platform")}</span>
  </div>
) : null}
```
`.gwt` is a column (`display: flex; flex-direction: column`); `.gwp` is `display: block`. `.xs` (11.5px) and `.muted` already exist in `styles/utilities.css`, so no new colour or size. With no name nothing of this is drawn: the logo (the bolt) stands alone as today. `SignInCard` calls `useTranslation()` (it works with no provider, in English, as the other steps do). The existing test finds `.gwn` and `.gwl`; both stay, and `.gwn` stays a direct text holder of the name.

**D3. The placeholder** (`CodeField.tsx`, R4). `<Field ... placeholder={"0".repeat(codeLength)} />`: `Field` passes unknown props to the `<input>`, and `.inp.code` and `.inp::placeholder` (`Field.css`) already draw it in the code face and the muted colour. The label `Code` is untouched, so the field keeps its accessible name; a placeholder is not a name. No literal text: the zeros are built from `codeLength`, so the "no literal user text" test of `sources.test.ts` still holds.

**D4. The text key** (`packages/i18n/src/messages/{en,vi}/signIn.ts`, R7). `card: { platform: "on Toki" }` in English and `card: { platform: "trên Toki" }` in Vietnamese. `pnpm i18n:check` requires both.

**D5. Known differences** (`e2e/parity/known-differences.ts`, R5). After D1 to D4, run the check. A sign-in row that is within the limit leaves the list (the report says "no longer a difference" for it until the entry is removed). A row that stays above it keeps an entry whose reason names what the sign-in spec decided (the wording and the extra buttons: R4, R8, R36; the card near the top on a narrow screen: "Layout at the three widths"; the focused field) and whose ticket is `accepted`; the part of the reason that said "fixed by TOKI-136" goes. The note about the prototype's frame, link and purple note stays, since those are still in its picture.

**Not done here:** no change to a text that the sign-in spec decided, to the disabled 'Sign in', to the 'Resend code' button, to the narrow layout or to the focused field.

**What can break:** (1) the heading's 22px with a 4px top margin moves the code step down by 2px and may change a layout test of height at 360 x 560 (R29: no scroll); (2) a two-line name block is taller than the 34px logo (14px + 11.5px lines, about 36px), so the row grows by about 2px; (3) `sources.test.ts` forbids colour literals and literal text, which the design respects; (4) the e2e sign-in cases read the placeholder nowhere, but the login route tests may query the code input by role.
