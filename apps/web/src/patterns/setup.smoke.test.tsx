import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

it("runs under jsdom with the jest-dom matchers (R2)", () => {
  render(<p>hello</p>);
  expect(screen.getByText("hello")).toBeInTheDocument();
});
