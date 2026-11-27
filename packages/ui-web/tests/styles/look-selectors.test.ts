import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { readCss } from "../support/css";

// TOKI-143 R8 and R9: the five style sheets that name a look. Their rules that name a look set
// sizes, spacing and layout, or take colours from variables that follow the scheme, so none of
// them sets a literal colour; the one rule that picks a colour by the colour of its background,
// the Toast button's, names the scheme.
const root = resolve(import.meta.dirname, "../../../..");
const files = [
  "packages/ui-web/src/layout/shell.css",
  "packages/ui-web/src/conversation-list/conversation-list.css",
  "packages/ui-web/src/components/Toast/Toast.css",
  "apps/web/src/conversation/conversation.css",
  "apps/web/src/channel-archive/archive.css",
].map((f) => resolve(root, f));

const literalColour = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;

describe("the rules of the five style sheets that name a look (TOKI-143 R8, R9)", () => {
  const rules = files.flatMap((file) => readCss(file));
  const byLook = rules.filter((r) => /data-look/.test(r.selector));
  // The list of the three looks that share the frame (TOKI-145).
  const frame =
    ':is([data-look="calm"], [data-look="focus"], [data-look="classic"])';

  test("there are such rules, and each names calm, focus or classic", () => {
    expect(byLook.length).toBeGreaterThan(30);
    for (const r of byLook)
      expect(r.selector, r.selector).toMatch(
        /\[data-look="(calm|focus|classic)"\]/,
      );
  });

  test("a rule that names a look sets no literal colour", () => {
    for (const r of byLook)
      for (const value of Object.values(r.declarations))
        expect(value, `${r.selector} ${value}`).not.toMatch(literalColour);
  });

  test("a look selector names Focus together with Classic, because Classic has the frame of Focus", () => {
    // Every mention of Focus is in a shared list: the pair, or the three looks of the frame
    // (TOKI-145). A rule of Classic's own (TOKI-144) names Classic alone, which the next test checks.
    const pair = ':is([data-look="focus"], [data-look="classic"])';
    for (const r of byLook)
      expect(
        r.selector.split(frame).join("").split(pair).join(""),
        r.selector,
      ).not.toMatch(/"focus"/);
  });

  test('a rule of the Classic sidebar names [data-look="classic"] alone (TOKI-144 R10)', () => {
    // The rules that are Classic's own: a selector with the look Classic outside the shared
    // :is(focus, classic) of the frame. Calm and Focus are not named by them.
    const pair = ':is([data-look="focus"], [data-look="classic"])';
    const own = byLook.filter((r) =>
      r.selector
        .split(frame)
        .join("")
        .split(pair)
        .join("")
        .includes('[data-look="classic"]'),
    );
    expect(own.length).toBeGreaterThan(10);
    for (const r of own)
      for (const part of r.selector.split(/,\s*/))
        expect(part, r.selector).toMatch(/^\[data-look="classic"\] /);
    for (const r of own)
      expect(r.selector, r.selector).not.toMatch(/"calm"|"focus"/);
    // They are all in the wide window: the narrow layout has no Classic rule.
    for (const r of own) expect(r.media, r.selector).toBe("(min-width:720px)");
  });

  test("no rule names the old attribute", () => {
    const old = new RegExp(["data", "eff"].join("-"));
    for (const r of rules) expect(r.selector).not.toMatch(old);
  });

  test("the Toast button picks its colour by the scheme", () => {
    const bySchemeRules = rules.filter((r) => /data-scheme/.test(r.selector));
    expect(bySchemeRules.map((r) => r.selector)).toEqual([
      '[data-scheme="dark"] .toast button',
    ]);
  });
});
