// @vitest-environment jsdom
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  CodeStep,
  type CodeStepProps,
  type ResendOutcome,
  type SendOutcome,
} from "../../src/sign-in/CodeStep";
import { deferred, renderWithTime } from "./support";

const LENGTH = 6;
const OK_RESEND: ResendOutcome = {
  kind: "ok",
  resendAfterSeconds: 60,
  expiresInSeconds: 600,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function setup(
  over: Partial<CodeStepProps> = {},
  options: { language?: "en" | "vi" } = {},
) {
  const send = vi
    .fn<(digits: string) => Promise<SendOutcome>>()
    .mockResolvedValue({ kind: "ok" });
  const resend = vi
    .fn<() => Promise<ResendOutcome>>()
    .mockResolvedValue(OK_RESEND);
  const onUseDifferentEmail = vi.fn();
  const view = renderWithTime(
    <CodeStep
      address="ana@example.com"
      codeLength={LENGTH}
      send={send}
      resend={resend}
      resendAfterSeconds={60}
      expiresInSeconds={600}
      onUseDifferentEmail={onUseDifferentEmail}
      {...over}
    />,
    options,
  );
  return {
    ...view,
    send,
    resend,
    onUseDifferentEmail,
    user: userEvent.setup(),
  };
}

const field = () => screen.getByLabelText("Code") as HTMLInputElement;
const signIn = () => screen.getByRole("button", { name: "Sign in" });
const resendButton = () => screen.getByRole("button", { name: "Resend code" });
const sendNew = () => screen.getByRole("button", { name: "Send a new code" });
const message = () => screen.getByRole("alert");
const noMessage = () => expect(screen.queryByRole("alert")).toBeNull();
const advance = (
  view: { timers: { advance(ms: number): void } },
  seconds: number,
) => view.timers.advance(seconds * 1000);

// Types the code and lets the answer of `send` arrive.
async function enterCode(view: ReturnType<typeof setup>, digits = "123456") {
  await view.user.type(field(), digits);
}

describe("what the step shows (R8)", () => {
  test("logo, workspace name, heading, address, validity, field and controls", () => {
    setup({ workspaceName: "Acme" });
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Check your email" }),
    ).toBeInTheDocument();
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
    expect(
      screen.getByText("The code works for 10 minutes"),
    ).toBeInTheDocument();
    expect(field()).toHaveFocus();
    expect(signIn()).toBeDisabled();
    expect(resendButton()).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Use a different email" }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Send a new code" }),
    ).toBeNull();
    noMessage();
  });

  test("works with no workspace name", () => {
    setup();
    expect(field()).toBeInTheDocument();
  });

  test("tab order: field, Sign in, Resend code, Use a different email (R30)", async () => {
    const view = setup();
    advance(view, 60);
    await view.user.type(field(), "123");
    await view.user.tab();
    expect(signIn()).toBeDisabled();
    expect(resendButton()).toHaveFocus();
    await view.user.tab();
    expect(
      screen.getByRole("button", { name: "Use a different email" }),
    ).toHaveFocus();
  });
});

describe("the send action (R10, R36)", () => {
  test("is sent once on the 6th digit, with the digits", async () => {
    const view = setup();
    await enterCode(view);
    expect(view.send).toHaveBeenCalledTimes(1);
    expect(view.send).toHaveBeenCalledWith("123456");
  });

  test("is not sent with 5 digits by Enter or by the button", async () => {
    const view = setup();
    await view.user.type(field(), "12345{Enter}");
    expect(view.send).not.toHaveBeenCalled();
    expect(signIn()).toBeDisabled();
  });

  test("is sent once by Enter with 6 digits after a send that did not arrive", async () => {
    const view = setup();
    view.send.mockResolvedValueOnce({ kind: "network" });
    await enterCode(view);
    await screen.findByText(/Could not connect/);
    expect(field().value).toBe("123456");
    await view.user.type(field(), "{Enter}");
    expect(view.send).toHaveBeenCalledTimes(2);
    expect(view.send).toHaveBeenLastCalledWith("123456");
  });

  test("the Sign in button sends the same digits again", async () => {
    const view = setup();
    view.send.mockResolvedValueOnce({ kind: "failed" });
    await enterCode(view);
    await screen.findByText("Something went wrong. Try again.");
    expect(signIn()).toBeEnabled();
    await view.user.click(signIn());
    expect(view.send).toHaveBeenCalledTimes(2);
  });

  test("nothing is sent while a check runs; the controls wait", async () => {
    const view = setup();
    const answer = deferred<SendOutcome>();
    view.send.mockReturnValueOnce(answer.promise);
    await enterCode(view);
    expect(view.send).toHaveBeenCalledTimes(1);
    await view.user.type(field(), "{Enter}");
    await view.user.click(signIn());
    expect(view.send).toHaveBeenCalledTimes(1);
    expect(field()).toHaveAttribute("readonly");
    expect(signIn()).toBeDisabled();
    expect(resendButton()).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Use a different email" }),
    ).toBeDisabled();
    await act(async () => answer.resolve({ kind: "ok" }));
    expect(view.send).toHaveBeenCalledTimes(1);
  });
});

describe("every outcome of send (R16 to R22, R41)", () => {
  test("incorrect with 4 tries left: message under the field, field emptied and focused", async () => {
    const view = setup();
    view.send.mockResolvedValueOnce({ kind: "incorrect", triesLeft: 4 });
    await enterCode(view);
    await waitFor(() =>
      expect(message()).toHaveTextContent(
        "That code is not right. 4 tries left.",
      ),
    );
    expect(field().value).toBe("");
    expect(field()).toHaveFocus();
    expect(field()).not.toHaveAttribute("readonly");
    expect(field().getAttribute("aria-describedby")).toContain(message().id);
    expect(field()).toHaveAttribute("aria-invalid", "true");
    expect(field().className).toContain("shake");
  });

  test("incorrect with 1 try left uses the one form", async () => {
    const view = setup();
    view.send.mockResolvedValueOnce({ kind: "incorrect", triesLeft: 1 });
    await enterCode(view);
    await waitFor(() =>
      expect(message()).toHaveTextContent(
        "That code is not right. 1 try left.",
      ),
    );
  });

  test("the shake is left out when reduced motion is asked for (R33)", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }));
    const view = setup();
    view.send.mockResolvedValueOnce({ kind: "incorrect", triesLeft: 3 });
    await enterCode(view);
    await waitFor(() => expect(message()).toHaveTextContent("3 tries left"));
    expect(field().className).not.toContain("shake");
  });

  test("locked: the field is emptied and enabled; 6 more digits send again and show it again", async () => {
    const view = setup();
    view.send.mockResolvedValue({ kind: "locked" });
    await enterCode(view);
    await waitFor(() =>
      expect(message()).toHaveTextContent(
        "This code is locked. Ask for a new one.",
      ),
    );
    expect(field().value).toBe("");
    expect(field()).not.toHaveAttribute("readonly");
    await enterCode(view, "654321");
    expect(view.send).toHaveBeenCalledTimes(2);
    expect(view.send).toHaveBeenLastCalledWith("654321");
    await waitFor(() =>
      expect(message()).toHaveTextContent("This code is locked"),
    );
  });

  test("expired: the message and 'Send a new code' take the place of 'Resend code'", async () => {
    const view = setup();
    view.send.mockResolvedValueOnce({ kind: "expired" });
    await enterCode(view);
    await waitFor(() =>
      expect(message()).toHaveTextContent("This code has expired"),
    );
    expect(sendNew()).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resend code" })).toBeNull();
    expect(field().value).toBe("");
    expect(field()).not.toHaveAttribute("readonly");
  });

  test("'Send a new code' obeys the wait of the first code, then does what Resend code does", async () => {
    const view = setup();
    view.send.mockResolvedValueOnce({ kind: "expired" });
    await enterCode(view);
    await screen.findByText("This code has expired");
    expect(sendNew()).toBeDisabled();
    advance(view, 59);
    expect(sendNew()).toBeDisabled();
    advance(view, 1);
    expect(sendNew()).toBeEnabled();
    await view.user.click(sendNew());
    expect(view.resend).toHaveBeenCalledTimes(1);
    await waitFor(() => noMessage());
    expect(
      screen.queryByRole("button", { name: "Send a new code" }),
    ).toBeNull();
    expect(resendButton()).toBeDisabled();
    expect(field()).toHaveFocus();
  });

  test("deactivated: the message under the field, field emptied and enabled", async () => {
    const view = setup();
    view.send.mockResolvedValueOnce({ kind: "deactivated" });
    await enterCode(view);
    await waitFor(() =>
      expect(message()).toHaveTextContent(
        "This account has been deactivated. Contact an admin.",
      ),
    );
    expect(field().value).toBe("");
    expect(field()).not.toHaveAttribute("readonly");
    expect(
      screen.getByRole("button", { name: "Use a different email" }),
    ).toBeEnabled();
  });

  test("failed: the general message, the digits stay, Sign in is enabled", async () => {
    const view = setup();
    view.send.mockResolvedValueOnce({ kind: "failed" });
    await enterCode(view);
    await waitFor(() =>
      expect(message()).toHaveTextContent("Something went wrong. Try again."),
    );
    expect(field().value).toBe("123456");
    expect(signIn()).toBeEnabled();
    expect(field()).not.toHaveAttribute("readonly");
  });

  test("network: the network message, the digits stay, Sign in is enabled", async () => {
    const view = setup();
    view.send.mockResolvedValueOnce({ kind: "network" });
    await enterCode(view);
    await waitFor(() =>
      expect(message()).toHaveTextContent(
        "Could not connect. Check your network and try again.",
      ),
    );
    expect(field().value).toBe("123456");
    expect(signIn()).toBeEnabled();
  });

  test("a new answer replaces the message: at most one at a time (R23)", async () => {
    const view = setup();
    view.send
      .mockResolvedValueOnce({ kind: "incorrect", triesLeft: 2 })
      .mockResolvedValueOnce({ kind: "locked" });
    await enterCode(view);
    await screen.findByText(/2 tries left/);
    await enterCode(view, "111111");
    await screen.findByText(/This code is locked/);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  test("left: nothing more is shown", async () => {
    const view = setup();
    view.send.mockResolvedValueOnce({ kind: "left" });
    await enterCode(view);
    await waitFor(() => expect(view.send).toHaveBeenCalled());
    noMessage();
  });

  test("ok: no message, and no second send", async () => {
    const view = setup();
    await enterCode(view);
    await waitFor(() => expect(view.send).toHaveBeenCalled());
    noMessage();
    await view.user.type(field(), "{Enter}");
    expect(view.send).toHaveBeenCalledTimes(1);
  });
});

describe("the wait of Resend code (R12)", () => {
  test("is disabled at 59 seconds and enabled at 60", () => {
    const view = setup();
    advance(view, 59);
    expect(resendButton()).toBeDisabled();
    advance(view, 1);
    expect(resendButton()).toBeEnabled();
  });

  test("the first wait is resendAfterSeconds, not a number of the step", () => {
    const view = setup({ resendAfterSeconds: 5 });
    advance(view, 4);
    expect(resendButton()).toBeDisabled();
    advance(view, 1);
    expect(resendButton()).toBeEnabled();
  });
});

describe("every outcome of resend (R13, R19, R37, R41)", () => {
  test("ok: field emptied and focused, message removed, the wait and the life restart", async () => {
    const view = setup();
    view.send.mockResolvedValueOnce({ kind: "incorrect", triesLeft: 3 });
    await enterCode(view);
    await screen.findByText(/3 tries left/);
    advance(view, 60);
    view.resend.mockResolvedValueOnce({
      kind: "ok",
      resendAfterSeconds: 30,
      expiresInSeconds: 100,
    });
    await view.user.type(field(), "12");
    await view.user.click(resendButton());
    await waitFor(() => noMessage());
    expect(field().value).toBe("");
    expect(field()).toHaveFocus();
    expect(resendButton()).toBeDisabled();
    advance(view, 29);
    expect(resendButton()).toBeDisabled();
    advance(view, 1);
    expect(resendButton()).toBeEnabled();
    // the new life: 100 seconds from the answer, 30 have passed
    advance(view, 69);
    noMessage();
    advance(view, 1);
    expect(message()).toHaveTextContent("This code has expired");
  });

  test.each([
    [1, "1 minute."],
    [60, "1 minute."],
    [61, "2 minutes."],
    [719, "12 minutes."],
  ])(
    "limit with %i seconds says %s and disables the button",
    async (seconds, tail) => {
      const view = setup();
      advance(view, 60);
      view.resend.mockResolvedValueOnce({
        kind: "limit",
        retryAfterSeconds: seconds,
      });
      await view.user.click(resendButton());
      await waitFor(() =>
        expect(message()).toHaveTextContent(
          `You have asked for too many codes. Try again in ${tail}`,
        ),
      );
      expect(resendButton()).toBeDisabled();
      expect(field().getAttribute("aria-describedby")).toContain(message().id);
    },
  );

  test("limit counts the minutes down and ends with the message gone and the button enabled", async () => {
    const view = setup({ expiresInSeconds: 5000 });
    advance(view, 60);
    view.resend.mockResolvedValueOnce({
      kind: "limit",
      retryAfterSeconds: 719,
    });
    await view.user.click(resendButton());
    await screen.findByText(/in 12 minutes/);
    advance(view, 58);
    expect(message()).toHaveTextContent("in 12 minutes.");
    advance(view, 1);
    expect(message()).toHaveTextContent("in 11 minutes.");
    advance(view, 60 * 10);
    expect(message()).toHaveTextContent("in 1 minute.");
    expect(resendButton()).toBeDisabled();
    advance(view, 60);
    noMessage();
    expect(resendButton()).toBeEnabled();
  });

  test("tooSoon: the step does not change; the message with the one and the other form; the wait ends it", async () => {
    const view = setup();
    await view.user.type(field(), "123");
    advance(view, 60);
    view.resend.mockResolvedValueOnce({
      kind: "tooSoon",
      retryAfterSeconds: 5,
    });
    await view.user.click(resendButton());
    await waitFor(() =>
      expect(message()).toHaveTextContent(
        "A code was just sent. Try again in 5 seconds.",
      ),
    );
    expect(field().value).toBe("123");
    expect(resendButton()).toBeDisabled();
    advance(view, 4);
    expect(resendButton()).toBeDisabled();
    advance(view, 1);
    noMessage();
    expect(resendButton()).toBeEnabled();
    view.resend.mockResolvedValueOnce({
      kind: "tooSoon",
      retryAfterSeconds: 1,
    });
    await view.user.click(resendButton());
    await waitFor(() =>
      expect(message()).toHaveTextContent(
        "A code was just sent. Try again in 1 second.",
      ),
    );
  });

  test("failed and network: the message, the field stays, the button can be used again", async () => {
    const view = setup();
    await view.user.type(field(), "123");
    advance(view, 60);
    view.resend.mockResolvedValueOnce({ kind: "failed" });
    await view.user.click(resendButton());
    await waitFor(() =>
      expect(message()).toHaveTextContent("Something went wrong. Try again."),
    );
    expect(field().value).toBe("123");
    expect(resendButton()).toBeEnabled();
    view.resend.mockResolvedValueOnce({ kind: "network" });
    await view.user.click(resendButton());
    await waitFor(() =>
      expect(message()).toHaveTextContent("Could not connect."),
    );
    expect(resendButton()).toBeEnabled();
  });

  test("left: nothing more is shown", async () => {
    const view = setup();
    advance(view, 60);
    view.resend.mockResolvedValueOnce({ kind: "left" });
    await view.user.click(resendButton());
    await waitFor(() => expect(view.resend).toHaveBeenCalled());
    noMessage();
  });

  test("while a resend runs the button is disabled and a second press asks nothing", async () => {
    const view = setup();
    advance(view, 60);
    const answer = deferred<ResendOutcome>();
    view.resend.mockReturnValueOnce(answer.promise);
    await view.user.click(resendButton());
    expect(resendButton()).toBeDisabled();
    await view.user.click(resendButton());
    expect(view.resend).toHaveBeenCalledTimes(1);
    await act(async () => answer.resolve(OK_RESEND));
  });
});

describe("the life of the code (R18)", () => {
  test("expiresInSeconds 0 opens the step expired", () => {
    const view = setup({ expiresInSeconds: 0 });
    expect(message()).toHaveTextContent("This code has expired");
    expect(sendNew()).toBeInTheDocument();
    expect(field()).not.toHaveAttribute("readonly");
    expect(view.send).not.toHaveBeenCalled();
    expect(view.resend).not.toHaveBeenCalled();
  });

  test("the clock reaching expiresInSeconds expires it with no request", () => {
    const view = setup({ expiresInSeconds: 600 });
    advance(view, 599);
    noMessage();
    advance(view, 1);
    expect(message()).toHaveTextContent("This code has expired");
    expect(sendNew()).toBeInTheDocument();
    expect(view.send).not.toHaveBeenCalled();
    expect(view.resend).not.toHaveBeenCalled();
  });

  test("time is read from the clock and the wake-ups come from timers.after only", () => {
    const view = setup();
    expect(view.timers.pending()).toBeGreaterThan(0);
  });
});

describe("Use a different email (R14, R41)", () => {
  test("calls onUseDifferentEmail and sends nothing", async () => {
    const view = setup();
    await view.user.click(
      screen.getByRole("button", { name: "Use a different email" }),
    );
    expect(view.onUseDifferentEmail).toHaveBeenCalledTimes(1);
    expect(view.send).not.toHaveBeenCalled();
    expect(view.resend).not.toHaveBeenCalled();
  });
});

describe("Vietnamese", () => {
  test("the counted messages follow the language", async () => {
    const view = setup({}, { language: "vi" });
    view.send.mockResolvedValueOnce({ kind: "incorrect", triesLeft: 4 });
    await view.user.type(screen.getByLabelText("Mã"), "123456");
    await waitFor(() =>
      expect(message()).toHaveTextContent("Mã không đúng. Còn 4 lần thử."),
    );
    advance(view, 60);
    view.resend.mockResolvedValueOnce({
      kind: "limit",
      retryAfterSeconds: 719,
    });
    await view.user.click(screen.getByRole("button", { name: "Gửi lại mã" }));
    await waitFor(() =>
      expect(message()).toHaveTextContent(
        "Bạn đã yêu cầu quá nhiều mã. Hãy thử lại sau 12 phút.",
      ),
    );
  });

  test("the one form falls back to the other in Vietnamese", async () => {
    const view = setup({}, { language: "vi" });
    view.send.mockResolvedValueOnce({ kind: "incorrect", triesLeft: 1 });
    await view.user.type(screen.getByLabelText("Mã"), "123456");
    await waitFor(() =>
      expect(message()).toHaveTextContent("Mã không đúng. Còn 1 lần thử."),
    );
  });
});
