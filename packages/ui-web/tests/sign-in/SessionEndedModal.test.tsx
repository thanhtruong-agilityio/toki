// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@toki/i18n/react";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import {
  SessionEndedModal,
  type SessionEndedModalProps,
} from "../../src/sign-in/SessionEndedModal";

function App(props: Partial<SessionEndedModalProps> & { covered?: boolean }) {
  const { covered = true, ...rest } = props;
  const [shown, setShown] = useState(covered);
  return (
    <I18nProvider language="en">
      <div id="app">
        <button type="button" onClick={() => setShown(true)}>
          Behind
        </button>
      </div>
      {shown ? (
        <SessionEndedModal
          form="ended"
          onSignInAgain={() => setShown(false)}
          {...rest}
        />
      ) : null}
    </I18nProvider>
  );
}

describe("the session ended form (R24, R25)", () => {
  test("a dialog named by its text, with one button, focused", () => {
    render(<App />);
    const dialog = screen.getByRole("dialog", {
      name: "Your session has ended",
    });
    expect(dialog).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Sign in again" });
    expect(button).toHaveFocus();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  test("Sign in again asks the page for it", async () => {
    const onSignInAgain = vi.fn();
    render(<App onSignInAgain={onSignInAgain} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Sign in again" }),
    );
    expect(onSignInAgain).toHaveBeenCalledTimes(1);
  });

  test("Esc and a press outside do nothing", async () => {
    const onSignInAgain = vi.fn();
    render(<App onSignInAgain={onSignInAgain} />);
    const user = userEvent.setup();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const scrim = document.querySelector(".scrim") as HTMLElement;
    fireEvent.pointerDown(scrim);
    fireEvent.pointerUp(scrim);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onSignInAgain).not.toHaveBeenCalled();
  });

  test("the backdrop is opaque and the app behind is inert and hidden from readers", () => {
    render(<App />);
    expect(document.querySelector(".scrim")).toHaveClass("opaque");
    const app = document.getElementById("app")!;
    expect(app.closest("[inert]")).not.toBeNull();
    expect(app.closest("[aria-hidden='true']")).not.toBeNull();
  });

  test("Tab stays inside the dialog", async () => {
    render(<App />);
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole("button", { name: "Sign in again" })).toHaveFocus();
  });

  test("focus is not returned to the app when the modal goes", async () => {
    render(<App covered={false} />);
    const opener = screen.getByRole("button", { name: "Behind" });
    const user = userEvent.setup();
    await user.click(opener);
    expect(opener.closest("[inert]")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Sign in again" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).not.toHaveFocus();
  });

  test("a link for another email is not shown in this form", () => {
    render(<App onUseDifferentEmail={() => {}} />);
    expect(
      screen.queryByRole("button", { name: "Use a different email" }),
    ).toBeNull();
  });
});

describe("the deactivated form (R26)", () => {
  test("the text, no button, and the focus on the text", () => {
    render(<App form="deactivated" />);
    const dialog = screen.getByRole("dialog", {
      name: "This account has been deactivated",
    });
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(document.activeElement).toHaveTextContent(
      "This account has been deactivated",
    );
  });

  test("Esc does nothing here either", async () => {
    render(<App form="deactivated" />);
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  test("one link 'Use a different email' only when the page gives the function", async () => {
    const onUseDifferentEmail = vi.fn();
    render(
      <App form="deactivated" onUseDifferentEmail={onUseDifferentEmail} />,
    );
    const link = screen.getByRole("button", { name: "Use a different email" });
    expect(screen.getAllByRole("button")).toHaveLength(1);
    await userEvent.click(link);
    expect(onUseDifferentEmail).toHaveBeenCalledTimes(1);
  });
});

test("the texts follow the language", () => {
  render(
    <I18nProvider language="vi">
      <SessionEndedModal form="ended" onSignInAgain={() => {}} />
    </I18nProvider>,
  );
  expect(screen.getByRole("button", { name: /\S/ })).not.toHaveTextContent(
    "Sign in again",
  );
});
