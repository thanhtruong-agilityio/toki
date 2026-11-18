import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resolve } from "node:path";
import { createRef, type ChangeEvent } from "react";
import { describe, expect, test, vi } from "vitest";
import { expectCssTable } from "../../test/css-table";
import { Switch } from "./Switch";

describe("Switch (R14, Table B)", () => {
  test("renders a switch button with aria-checked and a name, no children", () => {
    const { container } = render(
      <Switch checked={false} label="Sound" onChange={() => {}} />,
    );
    const sw = screen.getByRole("switch", { name: "Sound" });
    expect(sw.tagName).toBe("BUTTON");
    expect(sw).toHaveAttribute("type", "button");
    expect(sw).toHaveAttribute("aria-checked", "false");
    expect(sw.className).toBe("sw");
    expect(container.textContent).toBe("");
    expect(sw.childNodes).toHaveLength(0);
  });

  test("labelledBy sets aria-labelledby", () => {
    render(
      <>
        <span id="row">Row</span>
        <Switch checked labelledBy="row" onChange={() => {}} />
      </>,
    );
    expect(screen.getByRole("switch", { name: "Row" })).toHaveAttribute(
      "aria-labelledby",
      "row",
    );
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  test("a click calls onChange with the opposite value once, from off and from on", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <Switch checked={false} label="a" onChange={onChange} />,
    );
    await user.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(true);
    rerender(<Switch checked label="a" onChange={onChange} />);
    await user.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  test("Space and Enter act; the component holds no state", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch checked={false} label="a" onChange={onChange} />);
    screen.getByRole("switch").focus();
    await user.keyboard(" ");
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  test("disabled calls nothing", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch checked={false} label="a" disabled onChange={onChange} />);
    await user.click(screen.getByRole("switch"));
    expect(onChange).not.toHaveBeenCalled();
  });

  test("owned attributes win over a cast; className last; ref", () => {
    const ref = createRef<HTMLButtonElement>();
    const hostile = {
      role: "button",
      type: "submit",
      "aria-checked": "true",
    } as object;
    render(
      <Switch
        ref={ref}
        checked={false}
        label="a"
        className="mine"
        onChange={() => {}}
        {...hostile}
      />,
    );
    const sw = screen.getByRole("switch");
    expect(sw).toHaveAttribute("aria-checked", "false");
    expect(sw).toHaveAttribute("type", "button");
    expect(sw.className).toBe("sw mine");
    expect(ref.current).toBe(sw);
  });

  test("type errors (R30)", () => {
    // @ts-expect-error neither label nor labelledBy
    const a = <Switch checked onChange={() => {}} />;
    const native = (e: ChangeEvent<HTMLButtonElement>) => e;
    // @ts-expect-error the native onChange signature
    const b = <Switch checked label="a" onChange={native} />;
    expect([a, b]).toHaveLength(2);
  });
});

describe("Switch.css (R5, R8, Table F and I)", () => {
  test("holds exactly the rows of Table F and the narrow row of Table I", () => {
    expectCssTable(
      resolve(import.meta.dirname, "Switch.css"),
      [
        [
          ".sw",
          "position:relative; width:38px; height:22px; border-radius:99px; background:var(--line); flex:none; transition:background .15s; cursor:pointer",
        ],
        [
          ".sw::after",
          'content:""; position:absolute; left:3px; top:3px; width:16px; height:16px; border-radius:50%; background:var(--surface); transition:transform .15s',
        ],
        ['.sw[aria-checked="true"]', "background:var(--accent)"],
        [
          '.sw[aria-checked="true"]::after',
          "transform:translateX(16px); background:var(--on-accent)",
        ],
        [".sw[disabled]", "opacity:.5; cursor:not-allowed"],
      ],
      [[".sw::before", 'content:""; position:absolute; inset:-9px 0']],
    );
  });
});
