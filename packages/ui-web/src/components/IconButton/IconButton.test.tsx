import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resolve } from "node:path";
import { createRef } from "react";
import { describe, expect, test, vi } from "vitest";
import { expectCssTable } from "../../test/css-table";
import { IconButton, iconButtonSizes } from "./IconButton";

describe("IconButton (R12, Table B)", () => {
  test("renders one button named by label with one icon child", () => {
    const { container } = render(<IconButton icon="x" label="Close" />);
    const button = screen.getByRole("button", { name: "Close" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("aria-label", "Close");
    expect(button).not.toHaveAttribute("title");
    expect(button.className).toBe("ib");
    expect(button.children).toHaveLength(1);
    expect(container.querySelectorAll("svg")).toHaveLength(1);
    expect(button).not.toHaveAttribute("aria-pressed");
  });

  test("lists the sizes", () => {
    expect(iconButtonSizes).toEqual(["md", "sm"]);
  });

  test("pressed true and false set aria-pressed; true adds on", () => {
    const { rerender } = render(<IconButton icon="x" label="a" pressed />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button").className).toBe("ib on");
    rerender(<IconButton icon="x" label="a" pressed={false} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button").className).toBe("ib");
  });

  test("class order is ib, sm, on, className", () => {
    render(
      <IconButton icon="x" label="a" size="sm" pressed className="mine" />,
    );
    expect(screen.getByRole("button").className).toBe("ib sm on mine");
  });

  test("owned attributes win over a cast spread", () => {
    const hostile = {
      type: "submit",
      "aria-label": "other",
      "aria-pressed": "true",
    } as object;
    render(<IconButton icon="x" label="real" {...hostile} />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("aria-label", "real");
    expect(button).not.toHaveAttribute("aria-pressed");
  });

  test("forwards ref and acts on click, Space and Enter", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLButtonElement>();
    const onClick = vi.fn();
    render(<IconButton ref={ref} icon="x" label="a" onClick={onClick} />);
    expect(ref.current).toBe(screen.getByRole("button"));
    await user.click(screen.getByRole("button"));
    await user.keyboard(" ");
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  test("a disabled button calls nothing and is skipped by Tab", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<IconButton icon="x" label="a" disabled onClick={onClick} />);
    await user.click(screen.getByRole("button"));
    await user.tab();
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole("button")).not.toHaveFocus();
  });

  test("with no label text the text is empty (R3)", () => {
    const { container } = render(<IconButton icon="x" label="" />);
    expect(container.textContent).toBe("");
  });

  test("type errors (R30)", () => {
    // @ts-expect-error label is required
    const a = <IconButton icon="x" />;
    // @ts-expect-error aria-label is not accepted
    const b = <IconButton icon="x" label="a" aria-label="b" />;
    expect([a, b]).toHaveLength(2);
  });
});

describe("IconButton.css (R5, R8, Table D and I)", () => {
  test("holds exactly the rows of Table D and the narrow rows of Table I", () => {
    expectCssTable(
      resolve(import.meta.dirname, "IconButton.css"),
      [
        [
          ".ib",
          "display:inline-grid; place-items:center; width:34px; height:34px; border-radius:var(--radius-sm); color:var(--ink-2); transition:background .15s,color .15s",
        ],
        [
          ".ib:hover:where(:not([disabled]))",
          "background:var(--hover); color:var(--ink)",
        ],
        [".ib.on", "background:var(--accent-soft); color:var(--accent-text)"],
        [".ib.sm", "width:28px; height:28px"],
        [".ib[disabled]", "opacity:.5; cursor:not-allowed"],
      ],
      [
        [".ib", "min-height:40px; width:40px; height:40px"],
        [".ib.sm", "width:36px; height:36px"],
      ],
    );
  });
});
