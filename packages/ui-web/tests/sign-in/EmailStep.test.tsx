// @vitest-environment jsdom
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import {
  EmailStep,
  type EmailOutcome,
  type EmailStepProps,
} from "../../src/sign-in/EmailStep";
import { deferred, renderWithTime } from "./support";

// A stand-in for parseEmail of TOKI-020: the page passes the real one.
const isValidEmail = (address: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);

function setup(
  over: Partial<EmailStepProps> = {},
  options: { language?: "en" | "vi" } = {},
) {
  const send = vi
    .fn<(address: string) => Promise<EmailOutcome>>()
    .mockResolvedValue({ kind: "ok" });
  const view = renderWithTime(
    <EmailStep isValidEmail={isValidEmail} send={send} {...over} />,
    options,
  );
  return { ...view, send, user: userEvent.setup() };
}

const field = () => screen.getByLabelText("Email") as HTMLInputElement;
const submit = () => screen.getByRole("button", { name: "Send code" });
const message = () => screen.getByRole("alert");
const noMessage = () => expect(screen.queryByRole("alert")).toBeNull();
const advance = (
  view: { timers: { advance(ms: number): void } },
  seconds: number,
) => view.timers.advance(seconds * 1000);

describe("what the step shows (R4)", () => {
  test("logo, workspace name, one email field, Send code, no password", () => {
    const { container } = setup({ workspaceName: "Acme" });
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(field()).toHaveAttribute("type", "email");
    expect(field()).toHaveAttribute("autocomplete", "email");
    expect(field()).toHaveFocus();
    expect(submit()).toBeInTheDocument();
    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
  });

  test("works with no workspace name", () => {
    setup();
    expect(submit()).toBeInTheDocument();
  });

  test("an address given by the page is filled in and selected, so typing replaces it (R14, R25)", async () => {
    const { user } = setup({ initialAddress: "ana@example.com" });
    expect(field().value).toBe("ana@example.com");
    expect(field()).toHaveFocus();
    await user.keyboard("bo@example.com");
    expect(field().value).toBe("bo@example.com");
  });
});

describe("Send code (R5, R6)", () => {
  test("is disabled for an empty and a malformed address, enabled for a good one", async () => {
    const { user } = setup();
    expect(submit()).toBeDisabled();
    await user.type(field(), "ana@");
    expect(submit()).toBeDisabled();
    await user.type(field(), "example.com");
    expect(submit()).toBeEnabled();
  });

  test("Enter sends nothing while it is disabled", async () => {
    const { user, send } = setup();
    await user.type(field(), "ana@{Enter}");
    expect(send).not.toHaveBeenCalled();
  });

  test("Enter sends the address when it is enabled", async () => {
    const { user, send } = setup();
    await user.type(field(), "ana@example.com{Enter}");
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("ana@example.com");
  });

  test("two quick presses send one request; the field is read-only and the button disabled", async () => {
    const { user, send } = setup();
    const answer = deferred<EmailOutcome>();
    send.mockReturnValueOnce(answer.promise);
    await user.type(field(), "ana@example.com");
    await user.click(submit());
    await user.click(submit());
    await user.type(field(), "{Enter}");
    expect(send).toHaveBeenCalledTimes(1);
    expect(field()).toHaveAttribute("readonly");
    expect(submit()).toBeDisabled();
    await act(async () => answer.resolve({ kind: "ok" }));
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("the message for a malformed address (concern 1)", () => {
  test("shows when the field loses focus with a malformed address", async () => {
    const { user } = setup();
    await user.type(field(), "ana@");
    expect(screen.queryByRole("alert")).toBeNull();
    await user.tab();
    expect(message()).toHaveTextContent("Enter a valid email address");
    expect(field()).toHaveAttribute("aria-invalid", "true");
    expect(field().getAttribute("aria-describedby")).toContain(message().id);
  });

  test("shows nothing for an empty field", async () => {
    const { user } = setup();
    await user.click(field());
    await user.tab();
    noMessage();
  });

  test("goes when the address becomes well-formed", async () => {
    const { user } = setup();
    await user.type(field(), "ana@");
    await user.tab();
    await user.type(field(), "example.com");
    noMessage();
  });

  test("the outcome invalid shows the same message", async () => {
    const { user, send } = setup();
    send.mockResolvedValueOnce({ kind: "invalid" });
    await user.type(field(), "ana@example.com{Enter}");
    await waitFor(() =>
      expect(message()).toHaveTextContent("Enter a valid email address"),
    );
    expect(submit()).toBeEnabled();
  });
});

describe("the other outcomes (R19, R21, R22, R37)", () => {
  test("limit: the message under the email field, the button disabled, the minutes count down, then it ends", async () => {
    const view = setup();
    view.send.mockResolvedValueOnce({ kind: "limit", retryAfterSeconds: 719 });
    await view.user.type(field(), "ana@example.com{Enter}");
    await waitFor(() =>
      expect(message()).toHaveTextContent(
        "You have asked for too many codes. Try again in 12 minutes.",
      ),
    );
    expect(field().getAttribute("aria-describedby")).toContain(message().id);
    expect(submit()).toBeDisabled();
    expect(field()).not.toHaveAttribute("readonly");
    advance(view, 59);
    expect(message()).toHaveTextContent("in 11 minutes.");
    advance(view, 60 * 10);
    expect(message()).toHaveTextContent("in 1 minute.");
    advance(view, 60);
    noMessage();
    expect(submit()).toBeEnabled();
  });

  test.each([
    [1, "1 minute."],
    [60, "1 minute."],
    [61, "2 minutes."],
  ])("limit with %i seconds says %s", async (seconds, tail) => {
    const view = setup();
    view.send.mockResolvedValueOnce({
      kind: "limit",
      retryAfterSeconds: seconds,
    });
    await view.user.type(field(), "ana@example.com{Enter}");
    await waitFor(() => expect(message()).toHaveTextContent(`in ${tail}`));
  });

  test("changing the address removes the limit message and the wait at once", async () => {
    const view = setup();
    view.send.mockResolvedValueOnce({ kind: "limit", retryAfterSeconds: 600 });
    await view.user.type(field(), "ana@example.com{Enter}");
    await screen.findByText(/too many codes/);
    expect(submit()).toBeDisabled();
    await view.user.type(field(), "x");
    noMessage();
    expect(submit()).toBeEnabled();
    expect(view.timers.pending()).toBe(0);
  });

  test("tooSoon: the message with the other and the one form; the wait ends it", async () => {
    const view = setup();
    view.send.mockResolvedValueOnce({ kind: "tooSoon", retryAfterSeconds: 5 });
    await view.user.type(field(), "ana@example.com{Enter}");
    await waitFor(() =>
      expect(message()).toHaveTextContent(
        "A code was just sent. Try again in 5 seconds.",
      ),
    );
    expect(submit()).toBeDisabled();
    advance(view, 4);
    expect(submit()).toBeDisabled();
    advance(view, 1);
    noMessage();
    expect(submit()).toBeEnabled();
    view.send.mockResolvedValueOnce({ kind: "tooSoon", retryAfterSeconds: 1 });
    await view.user.click(submit());
    await waitFor(() =>
      expect(message()).toHaveTextContent("Try again in 1 second."),
    );
  });

  test("network and failed: the message, the address stays, the button can be used again", async () => {
    const view = setup();
    view.send.mockResolvedValueOnce({ kind: "network" });
    await view.user.type(field(), "ana@example.com{Enter}");
    await waitFor(() =>
      expect(message()).toHaveTextContent(
        "Could not connect. Check your network and try again.",
      ),
    );
    expect(field().value).toBe("ana@example.com");
    expect(field()).not.toHaveAttribute("readonly");
    expect(submit()).toBeEnabled();
    view.send.mockResolvedValueOnce({ kind: "failed" });
    await view.user.click(submit());
    await waitFor(() =>
      expect(message()).toHaveTextContent("Something went wrong. Try again."),
    );
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(submit()).toBeEnabled();
  });

  test("ok and left show nothing under the field", async () => {
    const view = setup();
    await view.user.type(field(), "ana@example.com{Enter}");
    await waitFor(() => expect(view.send).toHaveBeenCalled());
    noMessage();
  });
});

describe("Vietnamese", () => {
  test("the counted message follows the language", async () => {
    const view = setup({}, { language: "vi" });
    view.send.mockResolvedValueOnce({ kind: "limit", retryAfterSeconds: 719 });
    await view.user.type(
      screen.getByLabelText("Email"),
      "ana@example.com{Enter}",
    );
    await waitFor(() =>
      expect(message()).toHaveTextContent(
        "Bạn đã yêu cầu quá nhiều mã. Hãy thử lại sau 12 phút.",
      ),
    );
    expect(screen.getByRole("button", { name: "Gửi mã" })).toBeDisabled();
  });
});
