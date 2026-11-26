// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { CodeField } from "../../src/sign-in/CodeField";

function Harness(props: {
  onComplete?: (digits: string) => void;
  error?: string;
  codeLength?: number;
}) {
  const [value, setValue] = useState("");
  return (
    <CodeField
      codeLength={props.codeLength ?? 6}
      value={value}
      onChange={setValue}
      onComplete={props.onComplete}
      error={props.error}
    />
  );
}

const box = () => screen.getByRole("textbox") as HTMLInputElement;

describe("CodeField (R9, R10)", () => {
  test("is one text input for digits with a limit of codeLength", () => {
    render(<Harness codeLength={6} />);
    expect(box()).toHaveAttribute("inputmode", "numeric");
    expect(box()).toHaveAttribute("autocomplete", "one-time-code");
    expect(box()).toHaveAttribute("maxlength", "6");
    expect(screen.getByLabelText("Code")).toBe(box());
  });

  test("has the placeholder of codeLength zeros and keeps its label (TOKI-136 R4)", async () => {
    const user = userEvent.setup();
    render(<Harness codeLength={6} />);
    // The placeholder is an attribute: it stays in the DOM whatever the value is, and the browser
    // hides it once a digit is typed (not asserted here: jsdom does not render it).
    expect(box()).toHaveAttribute("placeholder", "000000");
    expect(screen.getByLabelText("Code")).toBe(box()); // the label is the name of the field
    await user.type(box(), "1");
    expect(box()).toHaveAttribute("placeholder", "000000");
    expect(screen.getByLabelText("Code")).toBe(box());
  });

  test("the placeholder has as many zeros as the code has digits (TOKI-136 R4)", () => {
    render(<Harness codeLength={4} />);
    expect(box()).toHaveAttribute("placeholder", "0000");
  });

  test("takes the length from the prop, not from a number of its own", () => {
    render(<Harness codeLength={4} />);
    expect(box()).toHaveAttribute("maxlength", "4");
  });

  test("typed letters and symbols do not appear", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(box(), "a1-b2 c");
    expect(box().value).toBe("12");
  });

  test("a 7th digit is not taken", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    await user.type(box(), "1234567");
    expect(box().value).toBe("123456");
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith("123456");
  });

  test("pasting 'ab12cd' leaves '12' and completes nothing", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    await user.click(box());
    await user.paste("ab12cd");
    expect(box().value).toBe("12");
    expect(onComplete).not.toHaveBeenCalled();
  });

  test("pasting '123 456' leaves 123456 and completes once", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    await user.click(box());
    await user.paste("123 456");
    expect(box().value).toBe("123456");
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith("123456");
  });

  test("pasting more than codeLength digits keeps the first ones", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    await user.click(box());
    await user.paste("12345678");
    expect(box().value).toBe("123456");
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test("five digits complete nothing", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    await user.type(box(), "12345");
    expect(onComplete).not.toHaveBeenCalled();
  });

  test("a message is tied to the field and the field is invalid (R31)", () => {
    render(<Harness error="Demo message" />);
    const message = screen.getByRole("alert");
    expect(message).toHaveTextContent("Demo message");
    expect(box()).toHaveAttribute("aria-invalid", "true");
    expect(box().getAttribute("aria-describedby")).toContain(message.id);
  });
});
