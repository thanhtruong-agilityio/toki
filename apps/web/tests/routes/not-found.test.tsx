// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { NotFoundView } from "../../src/routes/NotFoundView";

describe("the not-found view of TOKI-006 (R21)", () => {
  test("keeps its markup and its text", () => {
    const { container } = render(<NotFoundView />);
    expect(container.innerHTML).toBe("<p>Page not found</p>");
    expect(screen.getByText("Page not found")).toBeTruthy();
  });
});
