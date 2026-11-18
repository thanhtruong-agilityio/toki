import { render } from "@testing-library/react";
import { resolve } from "node:path";
import { createRef } from "react";
import { describe, expect, test } from "vitest";
import { expectCssTable } from "../../support/css-table";
import { Avatar } from "../../../src/components/Avatar/Avatar";
import { getInitials } from "../../../src/components/Avatar/getInitials";

// The folder this file sat in before the tests moved to tests/: its relative paths still start here.
const SRC_DIR = `${import.meta.dirname}/../../../src/components/Avatar`;

describe("getInitials (R7)", () => {
  test.each([
    ["Lan Nguyễn", "LN"],
    ["Khoa Đỗ", "KĐ"],
    ["Toki Automations", "TA"],
    ["Minh Trần Quang", "MQ"],
    ["Lan", "L"],
    ["ß Test", "ST"],
    ["  Lan   Nguyễn ", "LN"],
    ["Lan\tNguyễn", "LN"],
    ["", ""],
    ["   ", ""],
  ])("%j gives %j", (name, initials) => {
    expect(getInitials(name)).toBe(initials);
  });

  test("a name with combining marks gives the composed letter only after NFC", () => {
    const name = "Ông Ba";
    expect(name.codePointAt(0)).toBe(0x4f);
    expect(getInitials(name)).toBe("ÔB");
  });

  test("an astral first letter is kept as one code point", () => {
    expect(getInitials("\u{1D4D0}lice Smith")).toBe("\u{1D4D0}S");
    expect(getInitials("\u{1F600}")).toBe("\u{1F600}");
  });

  test("never throws, for an emoji, digits or a lone surrogate", () => {
    expect(() => getInitials("\uD800")).not.toThrow();
    expect(getInitials("123 456")).toBe("14");
  });
});

describe("Avatar markup (R6, R8)", () => {
  test("renders a span.av with the initials, the hue and aria-hidden", () => {
    const ref = createRef<HTMLSpanElement>();
    const { container } = render(
      <Avatar ref={ref} name="Lan Nguyễn" hue={172} />,
    );
    const av = container.firstElementChild as HTMLElement;
    expect(av.tagName).toBe("SPAN");
    expect(av.className).toBe("av");
    expect(av.getAttribute("aria-hidden")).toBe("true");
    expect(av.style.getPropertyValue("--h")).toBe("172");
    expect(av.style.getPropertyValue("--s")).toBe("");
    expect(av.textContent).toBe("LN");
    expect(av.childNodes).toHaveLength(1);
    expect(ref.current).toBe(av);
  });

  test("size sets --s in pixels", () => {
    const { container } = render(<Avatar name="Lan" hue={1} size={46} />);
    expect(
      (container.firstElementChild as HTMLElement).style.getPropertyValue(
        "--s",
      ),
    ).toBe("46px");
  });

  test.each([
    [-30, "330"],
    [360, "0"],
    [721, "1"],
    [Number.NaN, "0"],
    [Number.POSITIVE_INFINITY, "0"],
  ])("hue %s gives --h %s", (hue, expected) => {
    const { container } = render(<Avatar name="Lan" hue={hue} />);
    expect(
      (container.firstElementChild as HTMLElement).style.getPropertyValue(
        "--h",
      ),
    ).toBe(expected);
  });

  test.each([0, -4, Number.NaN, Number.POSITIVE_INFINITY])(
    "size %s is treated as no size",
    (size) => {
      const { container } = render(<Avatar name="Lan" hue={1} size={size} />);
      expect(
        (container.firstElementChild as HTMLElement).style.getPropertyValue(
          "--s",
        ),
      ).toBe("");
    },
  );

  test("the prototype's people give their initials", () => {
    const people: Array<[string, number, string]> = [
      ["Lan Nguyễn", 172, "LN"],
      ["Minh Trần", 215, "MT"],
      ["Alex Phạm", 28, "AP"],
      ["Sam Lê", 330, "SL"],
      ["Thu Hoàng", 265, "TH"],
      ["Khoa Đỗ", 95, "KĐ"],
      ["Mai Vũ", 8, "MV"],
      ["Jordan Davis", 48, "JD"],
    ];
    for (const [name, hue, initials] of people) {
      const { container, unmount } = render(<Avatar name={name} hue={hue} />);
      expect(container.textContent).toBe(initials);
      unmount();
    }
  });

  test("a caller's style is merged: caller keys win except --h and --s", () => {
    const { container } = render(
      <Avatar
        name="Lan"
        hue={5}
        size={30}
        style={
          { margin: "2px", "--h": 1, "--s": "99px" } as React.CSSProperties
        }
      />,
    );
    const av = container.firstElementChild as HTMLElement;
    expect(av.style.margin).toBe("2px");
    expect(av.style.getPropertyValue("--h")).toBe("5");
    expect(av.style.getPropertyValue("--s")).toBe("30px");
  });

  test("aria-label, aria-labelledby and title are removed, even with a cast", () => {
    const extra = {
      "aria-label": "x",
      "aria-labelledby": "y",
      title: "z",
      "aria-hidden": "false",
    } as unknown as object;
    const { container } = render(<Avatar name="Lan" hue={1} {...extra} />);
    const av = container.firstElementChild!;
    expect(av.hasAttribute("aria-label")).toBe(false);
    expect(av.hasAttribute("aria-labelledby")).toBe(false);
    expect(av.hasAttribute("title")).toBe(false);
    expect(av.getAttribute("aria-hidden")).toBe("true");
  });

  test("className is appended and other attributes go through", () => {
    const { container } = render(
      <Avatar name="Lan" hue={1} className="mine" data-x="1" />,
    );
    const av = container.firstElementChild!;
    expect(av.className).toBe("av mine");
    expect(av.getAttribute("data-x")).toBe("1");
  });

  test("the props type does not accept title, src, alt and children (hyphenated attributes are not checked by TypeScript, the cast test covers them)", () => {
    // @ts-expect-error title is not accepted
    render(<Avatar name="a" hue={1} title="x" />);
    // @ts-expect-error no picture
    render(<Avatar name="a" hue={1} src="x" />);
    // @ts-expect-error no picture
    render(<Avatar name="a" hue={1} alt="x" />);
    render(
      // @ts-expect-error children are owned
      <Avatar name="a" hue={1}>
        x
      </Avatar>,
    );
  });
});

describe("Avatar with presence (R10)", () => {
  test("renders a span.pdw around the avatar and a dot as its second child", () => {
    const ref = createRef<HTMLSpanElement>();
    const { container } = render(
      <Avatar
        ref={ref}
        name="Lan Nguyễn"
        hue={172}
        size={46}
        presence="away"
        className="mine"
        data-x="1"
        style={{ margin: "3px" }}
      />,
    );
    const wrap = container.firstElementChild as HTMLElement;
    expect(wrap.tagName).toBe("SPAN");
    expect(wrap.className).toBe("pdw mine");
    expect(wrap.getAttribute("data-x")).toBe("1");
    expect(wrap.style.margin).toBe("3px");
    expect(ref.current).toBe(wrap);
    expect(wrap.children).toHaveLength(2);
    const av = wrap.children[0] as HTMLElement;
    expect(av.className).toBe("av");
    expect(av.style.getPropertyValue("--h")).toBe("172");
    expect(av.style.getPropertyValue("--s")).toBe("46px");
    expect(av.style.margin).toBe("");
    expect(wrap.style.getPropertyValue("--h")).toBe("");
    const dot = wrap.children[1] as HTMLElement;
    expect(dot.className).toBe("pd away");
    expect(dot.getAttribute("aria-hidden")).toBe("true");
  });

  test("presenceLabel is passed to the dot", () => {
    const { container } = render(
      <Avatar name="Lan" hue={1} presence="dnd" presenceLabel="Busy" />,
    );
    const dot = container.querySelector(".pd")!;
    expect(dot.getAttribute("role")).toBe("img");
    expect(dot.getAttribute("aria-label")).toBe("Busy");
  });

  test("without presence there is no wrapper and no dot", () => {
    const { container } = render(<Avatar name="Lan" hue={1} />);
    expect(container.querySelector(".pdw")).toBeNull();
    expect(container.querySelector(".pd")).toBeNull();
  });
});

describe("Avatar.css (R9, R10)", () => {
  test("holds the four rules of the spec", () => {
    expectCssTable(resolve(SRC_DIR, "Avatar.css"), [
      [
        ".av",
        "--s:var(--av); width:var(--s); height:var(--s); flex:none; border-radius:30%; display:inline-grid; place-items:center; font-weight:700; font-size:calc(var(--s) * .38); letter-spacing:.01em; background:hsl(var(--h) var(--av-s) var(--av-l)); color:hsl(var(--h) var(--av-ts) var(--av-tl)); position:relative; user-select:none",
      ],
      [".av .pd", "position:absolute; right:-3px; bottom:-3px"],
      [".pdw", "position:relative; display:inline-grid; flex:none"],
      [".pdw .pd", "position:absolute; right:-3px; bottom:-3px"],
    ]);
  });
});
