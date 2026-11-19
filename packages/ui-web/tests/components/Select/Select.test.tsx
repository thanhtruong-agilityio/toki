import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, test, vi } from "vitest";
import { Select } from "../../../src/components/Select/Select";

const options = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta", disabled: true },
];

describe("Select (R16, R17)", () => {
  test("renders label.lbl before select.sel with one option for each", () => {
    const { container } = render(<Select label="Pick" options={options} />);
    const select = screen.getByLabelText("Pick");
    expect(select.tagName).toBe("SELECT");
    expect(select.className).toBe("sel");
    expect(container.querySelector("label.lbl + select.sel")).not.toBeNull();
    const rendered = screen.getAllByRole("option");
    expect(
      rendered.map((o) => [o.getAttribute("value"), o.textContent]),
    ).toEqual([
      ["a", "Alpha"],
      ["b", "Beta"],
    ]);
    expect(rendered[1]).toBeDisabled();
  });

  test("without label it is named by aria-label; fullWidth adds wide; className last", () => {
    render(
      <Select aria-label="Role" options={options} fullWidth className="mine" />,
    );
    expect(screen.getByRole("combobox", { name: "Role" }).className).toBe(
      "sel wide mine",
    );
  });

  test("value, defaultValue, onChange, disabled and ref pass through", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLSelectElement>();
    const onChange = vi.fn();
    render(
      <Select
        ref={ref}
        aria-label="r"
        options={[
          { value: "a", label: "A" },
          { value: "c", label: "C" },
        ]}
        defaultValue="a"
        onChange={onChange}
      />,
    );
    await user.selectOptions(screen.getByRole("combobox"), "c");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(ref.current).toBe(screen.getByRole("combobox"));
    expect(ref.current!.value).toBe("c");
  });

  test("disabled is skipped by Tab", async () => {
    const user = userEvent.setup();
    render(<Select aria-label="r" options={options} disabled />);
    await user.tab();
    expect(screen.getByRole("combobox")).not.toHaveFocus();
  });

  test("error renders one alert after the select and marks it", () => {
    render(<Select id="s" label="Pick" options={options} error="Choose one" />);
    const select = screen.getByLabelText("Pick");
    expect(screen.getByRole("alert")).toHaveTextContent("Choose one");
    expect(screen.getByRole("alert").id).toBe("s-error");
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select).toHaveAttribute("aria-describedby", "s-error");
    expect(select.className).toBe("sel invalid");
  });

  test("aria-describedby lists the caller's id first, then the error id (R17)", () => {
    render(
      <Select
        id="s"
        aria-label="a"
        options={options}
        error="Bad"
        aria-describedby="hint"
      />,
    );
    expect(screen.getByRole("combobox")).toHaveAttribute(
      "aria-describedby",
      "hint s-error",
    );
  });

  test("with no label the text is only the options (R3)", () => {
    const { container } = render(<Select aria-label="a" options={[]} />);
    expect(container.textContent).toBe("");
  });

  test("an empty error renders nothing", () => {
    render(<Select aria-label="a" options={options} error="  " />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("combobox")).not.toHaveAttribute("aria-invalid");
  });

  test.each(["", "   "])("label %j renders no empty label element", (label) => {
    const { container } = render(
      <Select label={label} aria-label="Named" options={options} />,
    );
    expect(container.querySelector("label")).toBeNull();
    expect(screen.getByRole("combobox", { name: "Named" })).toBeInTheDocument();
  });

  test("type error: no name at all (R16)", () => {
    // @ts-expect-error neither label nor aria-label
    const a = <Select options={options} />;
    expect(a).toBeTruthy();
  });
});
