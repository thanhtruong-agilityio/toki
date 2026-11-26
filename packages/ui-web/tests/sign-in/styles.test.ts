// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

// The look of the sign-in card follows the prototype's guest sign-in card (TOKI-136). These tests
// read the rules of `sign-in.css` by their selector and their property, not by line or spacing.
const css = readFileSync(
  `${import.meta.dirname}/../../src/sign-in/sign-in.css`,
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

// The declarations of the first rule with this selector, as a map of property to value.
function rule(selector: string): Record<string, string> {
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[1]!.trim().replace(/\s+/g, " ") !== selector) continue;
    const out: Record<string, string> = {};
    for (const declaration of m[2]!.split(";")) {
      const [property, ...value] = declaration.split(":");
      if (property?.trim()) out[property.trim()] = value.join(":").trim();
    }
    return out;
  }
  throw new Error(`no rule ${selector} in sign-in.css`);
}

describe("the style of the sign-in card (TOKI-136)", () => {
  test("the card draws --shadow, not --pop (R1)", () => {
    expect(rule(".gcard")["box-shadow"]).toBe("var(--shadow)");
  });

  test("the logo row and the name follow the prototype (R2)", () => {
    expect(rule(".gws").gap).toBe("8px");
    expect(rule(".gws")["margin-bottom"]).toBe("14px");
    const name = rule(".gws .gwn");
    expect(name["font-size"]).toBe("14px");
    expect(name["font-weight"]).toBe("700");
    expect(name).not.toHaveProperty("font-family"); // the body font
  });

  test("the heading of the code step is 22px with 4px above and 6px below (R3)", () => {
    const heading = rule(".gcard h1");
    expect(heading["font-size"]).toBe("22px");
    expect(heading.margin).toBe("4px 0 6px");
  });

  test("the link of the code step is at the left, 10px below the button (R8)", () => {
    const links = rule(".gcard .glinks");
    expect(links["text-align"]).toBe("left");
    expect(links["margin-top"]).toBe("10px");
  });
});
