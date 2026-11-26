// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@toki/i18n/react";
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

  test("shows the second line under the name, in English (TOKI-136 R7)", () => {
    const { container } = render(
      <SignInCard workspaceName="Acme">
        <p>step</p>
      </SignInCard>,
    );
    expect(screen.getByText("on Toki")).toBeInTheDocument();
    // The name and the line are one block next to the logo, and the name stays alone in .gwn.
    const block = container.querySelector(".gws > .gwt");
    expect(block).not.toBeNull();
    expect(block!.querySelector(".gwn")?.textContent).toBe("Acme");
    expect(block!.querySelector(".gwp")?.textContent).toBe("on Toki");
  });

  test("shows the second line in Vietnamese (TOKI-136 R7)", () => {
    render(
      <I18nProvider language="vi">
        <SignInCard workspaceName="Acme">
          <p>step</p>
        </SignInCard>
      </I18nProvider>,
    );
    expect(screen.getByText("trên Toki")).toBeInTheDocument();
    expect(screen.queryByText("on Toki")).toBeNull();
  });

  test("shows no second line without a name or with a blank one (TOKI-136 R7)", () => {
    const { container, rerender } = render(
      <SignInCard>
        <p>step</p>
      </SignInCard>,
    );
    expect(container.querySelector(".gwp")).toBeNull();
    expect(screen.queryByText("on Toki")).toBeNull();
    rerender(<SignInCard workspaceName=" ">{null}</SignInCard>);
    expect(container.querySelector(".gwp")).toBeNull();
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
