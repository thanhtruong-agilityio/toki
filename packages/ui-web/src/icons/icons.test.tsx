import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import * as icons from "./index";
import { BellIcon, Icon, iconNames, type IconProps } from "./index";
import { iconPaths } from "./paths";

// The 43 icons of the spec (Table A), in order.
const KEPT = [
  "at",
  "bell",
  "bell-off",
  "bold",
  "bolt",
  "bookmark",
  "check",
  "clock",
  "code",
  "copy",
  "down",
  "edit",
  "external",
  "file",
  "folder",
  "globe",
  "grid",
  "hash",
  "home",
  "image",
  "italic",
  "left",
  "link",
  "list",
  "lock",
  "menu",
  "moon",
  "more",
  "paperclip",
  "pin",
  "plus",
  "reply",
  "search",
  "send",
  "settings",
  "shield",
  "smile",
  "star",
  "trash",
  "user",
  "users",
  "wifi-off",
  "x",
];

// The 32 names of the prototype that are left out (Scope, Table B).
const LEFT_OUT = [
  "chart",
  "dot",
  "minus",
  "square",
  "up",
  "video-off",
  "wave",
  "approve",
  "archive",
  "calendar",
  "captions",
  "drag",
  "hand",
  "inbox",
  "info",
  "layout",
  "leave",
  "mail",
  "mic",
  "mic-off",
  "monitor",
  "pause",
  "play",
  "poll",
  "refresh",
  "right",
  "screen",
  "sparkles",
  "tasks",
  "user-plus",
  "video",
  "zap",
];

const pascal = (name: string) =>
  name
    .split("-")
    .map((p) => p[0]!.toUpperCase() + p.slice(1))
    .join("") + "Icon";

const components = icons as unknown as Record<
  string,
  React.ComponentType<IconProps>
>;
const render = (el: React.ReactElement) => renderToStaticMarkup(el);
const named = (name: string) => {
  const Component = components[pascal(name)]!;
  return <Component />;
};

describe("names and exports (R1, R2, R9, R10, R16)", () => {
  it("lists the 43 and the 32 names", () => {
    expect(KEPT).toHaveLength(43);
    expect(LEFT_OUT).toHaveLength(32);
  });

  it("iconNames equals the 43 names in order", () => {
    expect([...iconNames]).toEqual(KEPT);
  });

  it("exports exactly the 43 components, Icon and iconNames", () => {
    const expected = [...KEPT.map(pascal), "Icon", "iconNames"].sort();
    expect(Object.keys(icons).sort()).toEqual(expected);
  });

  it("names every drawing export Icon or *Icon", () => {
    for (const key of Object.keys(icons)) {
      if (key === "iconNames") continue;
      expect(key === "Icon" || key.endsWith("Icon")).toBe(true);
    }
  });

  it("has none of the 32 left-out names", () => {
    for (const name of LEFT_OUT) {
      expect(iconNames as readonly string[]).not.toContain(name);
      expect(Object.keys(iconPaths)).not.toContain(name);
      expect(Object.keys(icons)).not.toContain(pascal(name));
    }
  });
});

describe("markup (R3, R4)", () => {
  it.each(KEPT)(
    "%s renders one svg with the attributes of the prototype",
    (name) => {
      const html = render(<Icon name={name as never} />);
      expect(html).toBe(render(named(name)));
      const attrs = [
        'class="ic"',
        'viewBox="0 0 24 24"',
        'width="18"',
        'height="18"',
        'fill="none"',
        'stroke="currentColor"',
        'stroke-width="1.75"',
        'stroke-linecap="round"',
        'stroke-linejoin="round"',
        'aria-hidden="true"',
      ];
      const svgTag = html.match(/^<svg([^>]*)>/)![1]!;
      for (const a of attrs) expect(svgTag).toContain(a);
      expect(svgTag.match(/ [a-zA-Z-]+=/g)).toHaveLength(attrs.length);
      const d = (iconPaths as Record<string, string>)[name]!;
      expect(html.endsWith(`<path d="${d}"></path></svg>`)).toBe(true);
      expect(html.match(/<path /g)).toHaveLength(1);
    },
  );

  it("keeps three paths as literals from the spec", () => {
    expect(iconPaths.bell).toBe(
      "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0",
    );
    expect(iconPaths.x).toBe("M18 6L6 18M6 6l12 12");
    expect(iconPaths["wifi-off"]).toBe(
      "M2 2l20 20M8.5 16.4a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5.2-2.8M19 12.9a10 10 0 0 0-2.2-1.6M12 20h.01M1.4 9a15 15 0 0 1 4.3-2.6M10.7 5.1A15 15 0 0 1 22.6 9",
    );
  });
});

describe("props (R5, R7, R15)", () => {
  it("applies size, strokeWidth, className and passes other attributes", () => {
    const html = render(
      <BellIcon
        size={14}
        strokeWidth={2.2}
        className="active"
        data-testid="t"
      />,
    );
    expect(html).toContain('width="14" height="14"');
    expect(html).toContain('stroke-width="2.2"');
    expect(html).toContain('class="ic active"');
    expect(html).toContain('data-testid="t"');
  });

  it("lets the attributes of the icon win over a cast", () => {
    const html = render(
      <BellIcon
        {...({
          stroke: "red",
          fill: "blue",
          viewBox: "0 0 1 1",
          role: "img",
          "aria-hidden": false,
        } as unknown as IconProps)}
      />,
    );
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('fill="none"');
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("role=");
  });

  it("is a type error to name an icon or to pass an owned attribute", () => {
    const ok = (
      <BellIcon size={16} strokeWidth={2} className="a" data-testid="t" />
    );
    // @ts-expect-error an icon never gets its own name
    const a = <BellIcon aria-label="x" />;
    // @ts-expect-error an icon never gets its own name
    const b = <BellIcon title="x" />;
    // @ts-expect-error an icon takes no children
    const c = <BellIcon>x</BellIcon>;
    // @ts-expect-error aria-hidden is owned by the icon
    const d = <BellIcon aria-hidden={false} />;
    // @ts-expect-error stroke is owned by the icon
    const e = <BellIcon stroke="red" />;
    // @ts-expect-error viewBox is owned by the icon
    const f = <BellIcon viewBox="0 0 1 1" />;
    // @ts-expect-error role is owned by the icon
    const g = <BellIcon role="img" />;
    // @ts-expect-error a name outside IconName
    const h = <Icon name="mail" />;
    expect([ok, a, b, c, d, e, f, g, h]).toHaveLength(9);
  });
});

describe("source files (R6, R11)", () => {
  const dir = __dirname;
  const sources = readdirSync(dir).filter((f) => !/\.test\.tsx?$/.test(f));

  it("has no colour literal and does not import tokens", () => {
    expect(sources).toContain("icons.tsx");
    for (const file of sources) {
      const text = readFileSync(join(dir, file), "utf8");
      for (const bad of ["#", "rgb(", "hsl(", "@toki/tokens"]) {
        expect(text, `${file} contains ${bad}`).not.toContain(bad);
      }
    }
  });

  it("icons.tsx runs only imports and exported const declarations", () => {
    const lines = readFileSync(join(dir, "icons.tsx"), "utf8")
      .split("\n")
      .filter((l) => /^[A-Za-z]/.test(l));
    expect(lines.length).toBeGreaterThan(40);
    for (const line of lines) {
      expect(/^(import |export const )/.test(line), line).toBe(true);
    }
  });
});
