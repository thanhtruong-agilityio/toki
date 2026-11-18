import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { resolve } from "node:path";
import { describe, expect, test, vi } from "vitest";
import { expectCssTable } from "../../test/css-table";
import { Button, buttonSizes, buttonVariants } from "./Button";

const cssPath = resolve(import.meta.dirname, "Button.css");

describe("Button (R10, R11, Table B)", () => {
  test("renders a button of type button with the md default and no extra class", () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("btn");
    expect(button.className).toBe("btn");
  });

  test("lists the variants and sizes in order", () => {
    expect(buttonVariants).toEqual([
      "default",
      "primary",
      "danger",
      "ghost",
      "link",
    ]);
    expect(buttonSizes).toEqual(["md", "sm"]);
  });

  test("classes come in the order of Table B, className last", () => {
    render(
      <Button variant="primary" size="sm" fullWidth className="mine">
        x
      </Button>,
    );
    expect(screen.getByRole("button").className).toBe(
      "btn primary sm wide mine",
    );
    expect(
      buttonVariants.filter((v) => v !== "link" && v !== "default"),
    ).toEqual(["primary", "danger", "ghost"]);
  });

  test.each(["danger", "ghost"] as const)(
    "variant %s adds its class",
    (variant) => {
      render(<Button variant={variant}>x</Button>);
      expect(screen.getByRole("button").className).toBe(`btn ${variant}`);
    },
  );

  test("the type prop is passed", () => {
    render(<Button type="submit">Go</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  test("variant link renders linkbtn and not btn (R11)", () => {
    render(
      <Button variant="link" className="mine">
        Use a different email
      </Button>,
    );
    const button = screen.getByRole("button");
    expect(button.className).toBe("linkbtn mine");
    expect(button).not.toHaveClass("btn");
  });

  test("forwards ref and other attributes", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Button ref={ref} data-x="1" aria-label="named">
        x
      </Button>,
    );
    expect(ref.current).toBe(screen.getByRole("button"));
    expect(ref.current).toHaveAttribute("data-x", "1");
  });

  test("click, Space and Enter call onClick; disabled calls nothing", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>x</Button>);
    await user.click(screen.getByRole("button"));
    screen.getByRole("button").focus();
    await user.keyboard(" ");
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(3);
    onClick.mockClear();
    rerender(
      <Button onClick={onClick} disabled>
        x
      </Button>,
    );
    await user.click(screen.getByRole("button"));
    await user.tab();
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByRole("button")).not.toHaveFocus();
  });

  test("a disabled link button is skipped by Tab (R11)", async () => {
    const user = userEvent.setup();
    render(
      <Button variant="link" disabled>
        x
      </Button>,
    );
    await user.tab();
    expect(screen.getByRole("button")).not.toHaveFocus();
  });

  test("with no children the text is empty (R3)", () => {
    const { container } = render(<Button />);
    expect(container.textContent).toBe("");
  });

  test("type errors (R30)", () => {
    // @ts-expect-error size with the link variant
    const a = <Button variant="link" size="sm" />;
    // @ts-expect-error fullWidth with the link variant
    const b = <Button variant="link" fullWidth />;
    // @ts-expect-error a type outside the list
    const c = <Button type="loud" />;
    // @ts-expect-error live is not built
    const d = <Button variant="live" />;
    expect([a, b, c, d]).toHaveLength(4);
  });
});

describe("Button.css (R5, R8, Table C and I)", () => {
  test("holds exactly the rows of Table C and the narrow row of Table I", () => {
    expectCssTable(
      cssPath,
      [
        [
          ".btn",
          "display:inline-flex; align-items:center; gap:7px; padding:0 14px; height:34px; border-radius:var(--radius-sm); font-weight:600; border:1px solid var(--line); background:var(--surface); color:var(--ink); white-space:nowrap; transition:background .15s,border-color .15s,transform .1s",
        ],
        [
          ".btn:hover:where(:not([disabled]))",
          "background:var(--hover); border-color:var(--muted)",
        ],
        [".btn:active:where(:not([disabled]))", "transform:translateY(1px)"],
        [
          ".btn.primary",
          "background:var(--accent); color:var(--on-accent); border-color:var(--accent)",
        ],
        [
          ".btn.primary:hover:where(:not([disabled]))",
          "filter:brightness(1.07); background:var(--accent)",
        ],
        [
          ".btn.danger",
          "background:var(--danger); color:var(--surface); border-color:var(--danger)",
        ],
        [
          ".btn.danger:hover:where(:not([disabled]))",
          "background:var(--danger); filter:brightness(1.08)",
        ],
        [".btn.ghost", "border-color:transparent; background:transparent"],
        [".btn.ghost:hover:where(:not([disabled]))", "background:var(--hover)"],
        [".btn.sm", "height:28px; padding:0 10px; font-size:12.5px"],
        [
          ".btn.wide",
          "width:100%; justify-content:center; margin-top:14px; height:40px",
        ],
        [".btn[disabled]", "opacity:.5; cursor:not-allowed"],
        [
          ".linkbtn",
          "color:var(--accent-text); font-weight:600; text-decoration:underline; text-underline-offset:2px; font-size:12.5px; display:inline",
        ],
        [".linkbtn[disabled]", "opacity:.5; cursor:not-allowed"],
      ],
      [[".btn", "min-height:40px"]],
    );
  });
});
