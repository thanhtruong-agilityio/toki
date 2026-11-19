import { render, screen } from "@testing-library/react";
import { resolve } from "node:path";
import { createRef } from "react";
import { describe, expect, test } from "vitest";
import { expectCssTable } from "../../support/css-table";
import { Badge, badgeVariants } from "../../../src/components/Badge/Badge";

// The folder this file sat in before the tests moved to tests/: its relative paths still start here.
const SRC_DIR = `${import.meta.dirname}/../../../src/components/Badge`;

describe("Badge (R20)", () => {
  test("renders a span cnt with the children as given, no cap and no hiding of zero", () => {
    const { container, rerender } = render(<Badge>128</Badge>);
    expect(container.firstElementChild!.tagName).toBe("SPAN");
    expect(container.firstElementChild!.className).toBe("cnt");
    expect(container).toHaveTextContent("128");
    rerender(<Badge>0</Badge>);
    expect(container).toHaveTextContent("0");
    rerender(<Badge>{"99+"}</Badge>);
    expect(container).toHaveTextContent("99+");
  });

  test("variants add their class after cnt, className last", () => {
    expect(badgeVariants).toEqual(["default", "mute", "mention"]);
    const { container, rerender } = render(<Badge variant="mute">1</Badge>);
    expect(container.firstElementChild!.className).toBe("cnt mute");
    rerender(
      <Badge variant="mention" className="mine">
        @
      </Badge>,
    );
    expect(container.firstElementChild!.className).toBe("cnt mn mine");
  });

  test("with label the content is aria-hidden and an sr span holds the label", () => {
    const { container } = render(<Badge label="3 unread">3</Badge>);
    const hidden = container.querySelector('[aria-hidden="true"]');
    expect(hidden).toHaveTextContent("3");
    const sr = container.querySelector(".cnt .sr");
    expect(sr).toHaveTextContent("3 unread");
    expect(screen.getByText("3 unread")).toBe(sr);
  });

  test("without label the content is read as it is", () => {
    const { container } = render(<Badge>3</Badge>);
    expect(container.querySelector("[aria-hidden]")).toBeNull();
    expect(container.querySelector(".sr")).toBeNull();
  });

  test("ref points at the outer span; empty text with no children (R3)", () => {
    const ref = createRef<HTMLSpanElement>();
    const { container } = render(<Badge ref={ref} />);
    expect(ref.current).toBe(container.firstElementChild);
    expect(container.textContent).toBe("");
  });

  test("type error (R30)", () => {
    // @ts-expect-error variant outside the list
    const a = <Badge variant="loud">1</Badge>;
    expect(a).toBeTruthy();
  });
});

describe("Badge.css (R5, Table G)", () => {
  test("holds exactly the cnt rows of Table G", () => {
    expectCssTable(resolve(SRC_DIR, "Badge.css"), [
      [
        ".cnt",
        'font-family:"JetBrains Mono",monospace; font-size:11px; font-weight:600; background:var(--accent); color:var(--on-accent); border-radius:99px; min-width:18px; height:18px; padding:0 5px; display:inline-grid; place-items:center; font-variant-numeric:tabular-nums; line-height:1',
      ],
      [".cnt.mute", "background:var(--hover); color:var(--ink-2)"],
      [".cnt.mn", "background:var(--danger); color:var(--surface)"],
      [
        ".cnt .sr",
        "position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0)",
      ],
    ]);
  });
});
