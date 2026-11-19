import { render, screen } from "@testing-library/react";
import { resolve } from "node:path";
import { createRef } from "react";
import { describe, expect, test } from "vitest";
import { expectCssTable } from "../../support/css-table";
import { Tag } from "../../../src/components/Tag/Tag";

// The folder this file sat in before the tests moved to tests/: its relative paths still start here.
const SRC_DIR = `${import.meta.dirname}/../../../src/components/Tag`;

describe("Tag (R19)", () => {
  test("renders a span with class tag around its children", () => {
    const ref = createRef<HTMLSpanElement>();
    render(
      <Tag ref={ref} className="mine">
        Admin
      </Tag>,
    );
    const tag = screen.getByText("Admin");
    expect(tag.tagName).toBe("SPAN");
    expect(tag.className).toBe("tag mine");
    expect(tag.childNodes).toHaveLength(1);
    expect(ref.current).toBe(tag);
  });

  test("with no children the text is empty (R3)", () => {
    const { container } = render(<Tag />);
    expect(container.textContent).toBe("");
  });
});

describe("Tag.css (R5, Table G)", () => {
  test("holds exactly the row of Table G for .tag", () => {
    expectCssTable(resolve(SRC_DIR, "Tag.css"), [
      [
        ".tag",
        "font-size:10.5px; font-weight:600; border-radius:5px; padding:0 6px; background:var(--hover); color:var(--ink-2); text-transform:uppercase; letter-spacing:.04em; line-height:17px; display:inline-block",
      ],
    ]);
  });
});
