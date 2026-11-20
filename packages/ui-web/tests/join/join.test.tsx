// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@toki/i18n/react";
import type { ReactElement } from "react";
import { describe, expect, test, vi } from "vitest";
import { InvitationRefusal } from "../../src/join/InvitationRefusal";
import { SignedInQuestion } from "../../src/join/SignedInQuestion";

const wrap = (ui: ReactElement, language: "en" | "vi" = "en") =>
  render(<I18nProvider language={language}>{ui}</I18nProvider>);

describe("InvitationRefusal (R35, R41, R42)", () => {
  test("expired: the heading, the line, the logo and the workspace name, and nothing to press", () => {
    const { container } = wrap(
      <InvitationRefusal reason="expired" workspaceName="Acme" />,
    );
    expect(
      screen.getByRole("heading", { name: "This invitation has expired" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Ask the person who invited you for a new one."),
    ).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(container.querySelector(".gwl")).not.toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  test("revoked: its own heading and line, with the workspace name", () => {
    wrap(<InvitationRefusal reason="revoked" workspaceName="Acme" />);
    expect(
      screen.getByRole("heading", {
        name: "This invitation is no longer valid",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ask an admin.")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
  });

  test("unknown: the heading only, the logo and no name of the workspace anywhere", () => {
    const { container } = wrap(
      <InvitationRefusal reason="unknown" workspaceName="Acme" />,
    );
    expect(
      screen.getByRole("heading", { name: "This link is not valid" }),
    ).toBeInTheDocument();
    // even when a name is passed, this page shows none (D-081)
    expect(container.textContent).not.toContain("Acme");
    expect(container.querySelector(".gwl")).not.toBeNull();
    expect(container.querySelector(".gwn")).toBeNull();
    expect(container.querySelectorAll("p")).toHaveLength(0);
  });

  test("the focus is on the heading, which is not a tab stop", async () => {
    wrap(<InvitationRefusal reason="expired" workspaceName="Acme" />);
    const heading = screen.getByRole("heading");
    expect(heading).toHaveFocus();
    expect(heading).toHaveAttribute("tabindex", "-1");
    await userEvent.tab();
    expect(heading).not.toHaveFocus();
  });

  test("shows the Vietnamese texts", () => {
    wrap(<InvitationRefusal reason="revoked" workspaceName="Acme" />, "vi");
    expect(
      screen.getByRole("heading", { name: "Lời mời này không còn hiệu lực" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Hãy liên hệ quản trị viên.")).toBeInTheDocument();
  });
});

describe("SignedInQuestion (R36, R41)", () => {
  function setup(language: "en" | "vi" = "en") {
    const onSignOut = vi.fn();
    const onStay = vi.fn();
    const view = wrap(
      <SignedInQuestion
        current="ann@example.com"
        invited="sam@example.com"
        workspaceName="Acme"
        onSignOut={onSignOut}
        onStay={onStay}
      />,
      language,
    );
    return { onSignOut, onStay, ...view };
  }

  test("asks with both addresses as values, above two buttons, the first primary", () => {
    const { container } = setup();
    expect(
      screen.getByRole("heading", {
        name: "You are signed in as ann@example.com. Sign out to continue as sam@example.com?",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual([
      "Sign out and continue",
      "Stay signed in",
    ]);
    expect(buttons[0]!.className).toContain("primary");
    expect(container.querySelector(".gwl")).not.toBeNull();
  });

  test("sends nothing until a button is pressed, and each button calls its own handler once", async () => {
    const { onSignOut, onStay } = setup();
    expect(onSignOut).not.toHaveBeenCalled();
    expect(onStay).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Stay signed in" }),
    );
    expect(onStay).toHaveBeenCalledTimes(1);
    expect(onSignOut).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Sign out and continue" }),
    );
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  test("the focus starts on the heading, and the tab order is 'Sign out and continue', then 'Stay signed in'", async () => {
    setup();
    const heading = screen.getByRole("heading");
    expect(heading).toHaveFocus();
    expect(heading).toHaveAttribute("tabindex", "-1");
    await userEvent.tab();
    expect(
      screen.getByRole("button", { name: "Sign out and continue" }),
    ).toHaveFocus();
    await userEvent.tab();
    expect(
      screen.getByRole("button", { name: "Stay signed in" }),
    ).toHaveFocus();
  });

  test("is reachable with the keyboard alone (Enter on a focused button)", async () => {
    const { onStay } = setup();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    expect(onStay).toHaveBeenCalledTimes(1);
  });

  test("shows the Vietnamese texts", () => {
    setup("vi");
    expect(
      screen.getByRole("heading", {
        name: "Bạn đang đăng nhập với ann@example.com. Đăng xuất để tiếp tục với sam@example.com?",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Giữ đăng nhập" }),
    ).toBeInTheDocument();
  });
});
