import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resolve } from "node:path";
import { createRef } from "react";
import { describe, expect, test, vi } from "vitest";
import { expectCssTable } from "../../test/css-table";
import { Field, fieldVariants } from "./Field";

describe("Field form (a): label and control (R15)", () => {
  test("renders a label.lbl linked by id to input.inp", () => {
    render(<Field label="Name" />);
    const input = screen.getByLabelText("Name");
    expect(input.tagName).toBe("INPUT");
    expect(input.className).toBe("inp");
    const label = screen.getByText("Name");
    expect(label.tagName).toBe("LABEL");
    expect(label.className).toBe("lbl");
    expect(label).toHaveAttribute("for", input.id);
    expect(fieldVariants).toEqual(["default", "code", "search"]);
  });

  test("a caller id is used; code adds a class; className last; ref and pass-through", () => {
    const ref = createRef<HTMLInputElement | HTMLTextAreaElement>();
    render(
      <Field
        ref={ref}
        id="mine"
        label="Code"
        variant="code"
        className="extra"
        maxLength={6}
        placeholder="p"
      />,
    );
    const input = screen.getByLabelText("Code");
    expect(input.id).toBe("mine");
    expect(input.className).toBe("inp code extra");
    expect(input).toHaveAttribute("maxlength", "6");
    expect(input).toHaveAttribute("placeholder", "p");
    expect(ref.current).toBe(input);
  });

  test("multiline renders a textarea.inp", () => {
    render(<Field label="Note" multiline rows={3} />);
    const area = screen.getByLabelText("Note");
    expect(area.tagName).toBe("TEXTAREA");
    expect(area.className).toBe("inp");
    expect(area).toHaveAttribute("rows", "3");
  });

  test("onChange receives the native event", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Field label="a" onChange={onChange} />);
    await user.type(screen.getByLabelText("a"), "x");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0].target.value).toBe("x");
  });
});

describe("Field with a blank label", () => {
  test.each(["", "   "])("label %j renders no empty label element", (label) => {
    const { container } = render(<Field label={label} aria-label="Named" />);
    expect(container.querySelector("label")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Named" })).toBeInTheDocument();
  });
});

describe("Field form (c): a name with no visible label (R15)", () => {
  test("input alone, named by aria-label, no label element", () => {
    const { container } = render(<Field aria-label="Custom status" />);
    expect(
      screen.getByRole("textbox", { name: "Custom status" }).className,
    ).toBe("inp");
    expect(container.querySelector("label")).toBeNull();
  });

  test("textarea alone, named by aria-labelledby", () => {
    const { container } = render(
      <>
        <span id="n">Edit message</span>
        <Field aria-labelledby="n" multiline />
      </>,
    );
    expect(screen.getByRole("textbox", { name: "Edit message" }).tagName).toBe(
      "TEXTAREA",
    );
    expect(container.querySelector("label")).toBeNull();
  });
});

describe("Field form (b): search (R15)", () => {
  test("label.field wraps an optional icon and an input named by aria-label", () => {
    const { container } = render(
      <Field variant="search" icon="search" aria-label="Search" />,
    );
    const box = container.querySelector("label.field")!;
    expect(box.className).toBe("field");
    expect(box.querySelector("svg")).not.toBeNull();
    const input = screen.getByRole("textbox", { name: "Search" });
    expect(box.contains(input)).toBe(true);
    expect(input).toHaveAttribute("id");
    expect(input.className).toBe("");
  });

  test("without an icon there is no svg; className goes on the label", () => {
    const { container } = render(
      <Field variant="search" aria-label="Find" className="mine" />,
    );
    expect(container.querySelector("svg")).toBeNull();
    expect(container.querySelector("label")!.className).toBe("field mine");
  });

  test("disabled and readOnly add classes to the label (R18)", () => {
    const { container, rerender } = render(
      <Field variant="search" aria-label="a" disabled />,
    );
    expect(container.querySelector("label")!.className).toBe("field disabled");
    rerender(<Field variant="search" aria-label="a" readOnly />);
    expect(container.querySelector("label")!.className).toBe("field readonly");
  });
});

describe("Field error (R17)", () => {
  test("error renders one alert after the control and marks the control", () => {
    const { container } = render(
      <Field id="e" label="Email" error="Not valid" aria-describedby="hint" />,
    );
    const input = screen.getByLabelText("Email");
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Not valid");
    expect(alert.className).toBe("gerr");
    expect(alert.id).toBe("e-error");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "hint e-error");
    expect(input.className).toBe("inp invalid");
    expect(input.nextElementSibling).toBe(alert);
    expect(container.querySelectorAll(".gerr")).toHaveLength(1);
  });

  test.each([undefined, "", "   "])(
    "an empty error (%j) renders nothing",
    (error) => {
      render(<Field label="a" error={error} />);
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.getByLabelText("a")).not.toHaveAttribute("aria-invalid");
      expect(screen.getByLabelText("a")).not.toHaveAttribute(
        "aria-describedby",
      );
      expect(screen.getByLabelText("a").className).toBe("inp");
    },
  );

  test("a new error replaces the old one", () => {
    const { rerender } = render(<Field label="a" error="one" />);
    rerender(<Field label="a" error="two" />);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent("two");
  });

  test("the search form marks the label invalid and holds the error id", () => {
    const { container } = render(
      <Field variant="search" aria-label="s" error="bad" />,
    );
    expect(container.querySelector("label")!.className).toBe("field invalid");
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert").id).toBe(
      `${screen.getByRole("textbox").id}-error`,
    );
  });

  test("owned attributes win over a cast", () => {
    const hostile = { "aria-invalid": "true" } as object;
    render(<Field label="a" {...hostile} />);
    expect(screen.getByLabelText("a")).not.toHaveAttribute("aria-invalid");
  });
});

describe("Field state and focus (R18, R21)", () => {
  test("disabled is skipped by Tab; readOnly can be focused", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Field label="a" disabled />);
    await user.tab();
    expect(screen.getByLabelText("a")).not.toHaveFocus();
    unmount();
    render(<Field label="a" readOnly />);
    await user.tab();
    expect(screen.getByLabelText("a")).toHaveFocus();
  });

  test("with no label text the text is empty (R3)", () => {
    const { container } = render(<Field aria-label="x" />);
    expect(container.textContent).toBe("");
  });
});

describe("Field type errors (R30)", () => {
  test("each mistake is a type error", () => {
    // @ts-expect-error neither label nor aria-label
    const a = <Field />;
    // @ts-expect-error search with a visible label
    const b = <Field variant="search" label="x" aria-label="y" />;
    // @ts-expect-error icon without the search variant
    const c = <Field label="x" icon="search" />;
    // @ts-expect-error multiline with the search variant
    const d = <Field variant="search" aria-label="x" multiline />;
    expect([a, b, c, d]).toHaveLength(4);
  });
});

describe("Field.css (R5, R6, R8, Table H and I)", () => {
  test("holds exactly the rows of Table H and the narrow row of Table I", () => {
    expectCssTable(
      resolve(import.meta.dirname, "Field.css"),
      [
        [
          ".lbl",
          "display:block; font-size:12px; font-weight:600; color:var(--ink-2); margin:12px 0 4px",
        ],
        [
          ".inp",
          "height:36px; width:100%; border:1px solid var(--line); border-radius:var(--radius-sm); background:var(--surface); padding:0 10px; color:var(--ink); outline:0",
        ],
        [
          ".inp:focus, .sel:focus, textarea.inp:focus",
          "border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft)",
        ],
        ["textarea.inp", "height:auto; padding:8px 10px; resize:vertical"],
        [
          ".inp.code",
          'font-family:"JetBrains Mono",monospace; font-size:20px; letter-spacing:.4em; height:46px; text-align:center',
        ],
        [".inp::placeholder", "color:var(--muted)"],
        [
          ".sel",
          "height:34px; border:1px solid var(--line); border-radius:var(--radius-sm); background:var(--surface); padding:0 10px; color:var(--ink)",
        ],
        [".sel.wide", "width:100%"],
        [
          ".field",
          "display:flex; align-items:center; gap:8px; height:36px; border:1px solid var(--line); background:var(--surface); border-radius:var(--radius-sm); padding:0 10px; color:var(--muted); transition:border-color .15s,box-shadow .15s",
        ],
        [
          ".field:focus-within",
          "border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft)",
        ],
        [
          ".field input",
          "flex:1; min-width:0; border:0; background:transparent; outline:0; color:var(--ink)",
        ],
        [".field input::placeholder", "color:var(--muted)"],
        [
          ".gerr",
          "margin-top:12px; padding:8px 10px; border-radius:var(--radius-sm); background:var(--danger-soft); color:var(--danger); font-size:12.5px",
        ],
        [
          ".inp.invalid, .sel.invalid, .field.invalid",
          "border-color:var(--danger)",
        ],
        [
          ".inp.invalid:focus, .sel.invalid:focus, .field.invalid:focus-within",
          "border-color:var(--danger); box-shadow:0 0 0 3px var(--danger-soft)",
        ],
        [
          ".inp[disabled], .sel[disabled], .field.disabled",
          "opacity:.5; cursor:not-allowed",
        ],
        [".inp[readonly], .field.readonly", "background:var(--surface-2)"],
      ],
      [[".inp, .sel, .field", "min-height:40px"]],
    );
  });
});
