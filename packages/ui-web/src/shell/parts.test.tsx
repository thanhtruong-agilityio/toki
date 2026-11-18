import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { SearchBox, UserCard, WorkspaceHeader } from "./index";

describe("ref and className (R34)", () => {
  test("WorkspaceHeader", () => {
    const ref = createRef<HTMLDivElement>();
    const { container } = render(
      <WorkspaceHeader
        ref={ref}
        className="x"
        workspace={{ name: "Toki" }}
        data-testid="ws"
      />,
    );
    expect(ref.current).toBe(container.querySelector("div.ws"));
    expect(ref.current).toHaveClass("ws", "x");
    expect(screen.getByTestId("ws")).toBe(ref.current);
  });

  test("SearchBox", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <SearchBox
        ref={ref}
        className="x"
        search={{ label: "Find", onOpen: () => {} }}
      />,
    );
    expect(ref.current).toBe(screen.getByRole("button", { name: "Find" }));
    expect(ref.current).toHaveClass("srch", "x");
  });

  test("UserCard: the ref is the div.usercard", () => {
    const ref = createRef<HTMLDivElement>();
    const { container } = render(
      <UserCard
        ref={ref}
        className="x"
        account={{ label: "A", name: "B C", hue: 3 }}
      />,
    );
    expect(ref.current).toBe(container.querySelector("div.usercard"));
    expect(ref.current).toHaveClass("usercard", "x");
  });
});

describe("no text of their own (R2)", () => {
  test("the pieces render no text with empty strings", () => {
    const { container } = render(
      <>
        <WorkspaceHeader workspace={{ name: "" }} />
        <SearchBox search={{ label: "", onOpen: () => {} }} />
        <UserCard account={{ label: "", name: "", hue: 0 }} />
      </>,
    );
    expect(container.textContent).toBe("");
  });
});
