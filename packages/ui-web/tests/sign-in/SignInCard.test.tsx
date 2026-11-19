// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { SignInCard } from "../../src/sign-in/SignInCard";

describe("SignInCard (R4, R8, R38)", () => {
  test("shows the logo, the workspace name and the step", () => {
    const { container } = render(
      <SignInCard workspaceName="Acme">
        <p>step</p>
      </SignInCard>,
    );
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("step")).toBeInTheDocument();
    expect(container.querySelector(".gwl")).not.toBeNull();
  });

  test("shows the logo without a name when there is none", () => {
    const { container } = render(
      <SignInCard>
        <p>step</p>
      </SignInCard>,
    );
    expect(container.querySelector(".gwl")).not.toBeNull();
    expect(container.querySelector(".gwn")).toBeNull();
    expect(screen.getByText("step")).toBeInTheDocument();
  });

  test("an empty name counts as none", () => {
    const { container } = render(
      <SignInCard workspaceName=" ">{null}</SignInCard>,
    );
    expect(container.querySelector(".gwn")).toBeNull();
  });
});
