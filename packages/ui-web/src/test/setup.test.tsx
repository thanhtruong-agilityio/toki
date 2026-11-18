import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

// R27: cleanup runs after each test, so the second test finds the button once.
test("first render finds the button once", () => {
  render(<button type="button">one</button>);
  expect(screen.getByRole("button")).toBeInTheDocument();
});

test("second render finds the button once", () => {
  render(<button type="button">two</button>);
  expect(screen.getByRole("button")).toHaveTextContent("two");
});
