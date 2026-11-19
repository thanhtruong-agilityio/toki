// @vitest-environment jsdom
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { deferred, user } from "../support/auth-harness";
import { loadApp } from "../support/load-app";

const RECORD_KEY = "signIn.code";
const ADDRESS = "ada@example.com";

const emailField = () => screen.getByLabelText("Email") as HTMLInputElement;
const codeField = () => screen.getByLabelText("Code") as HTMLInputElement;

async function openLogin(
  options: Parameters<typeof loadApp>[0] = {},
  signedOut = true,
) {
  const t = await loadApp({ path: "/login", ...options });
  if (signedOut) t.session.markSignedOut();
  await t.mount();
  await t.settle();
  return t;
}

async function toCodeStep(t: Awaited<ReturnType<typeof openLogin>>) {
  await userEvent.type(emailField(), ADDRESS);
  await userEvent.click(screen.getByRole("button", { name: "Send code" }));
  await t.settle();
  return screen.findByRole("heading", { name: "Check your email" });
}

const record = (t: Awaited<ReturnType<typeof openLogin>>) => {
  const raw = t.platform.storage.tab.get(RECORD_KEY);
  return raw === null ? null : (JSON.parse(raw) as Record<string, unknown>);
};

let spies: ReturnType<typeof vi.spyOn>[] = [];
beforeEach(() => {
  spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => {}),
  );
});
afterEach(() => {
  for (const spy of spies) spy.mockRestore();
});

describe("the page (R4, R38)", () => {
  test("shows the email step, sets the title, and the workspace name when it arrives", async () => {
    const name = deferred<string | null>();
    const t = await openLogin({
      calls: { readWorkspaceName: () => name.promise },
    });
    expect(document.title).toBe("Sign in · Toki");
    expect(emailField()).toHaveFocus();
    expect(screen.queryByText("Acme")).toBeNull();
    // Both steps work with no name.
    await userEvent.type(emailField(), ADDRESS);
    expect(screen.getByRole("button", { name: "Send code" })).toBeEnabled();
    await act(async () => name.resolve("Acme"));
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(t.calls.readWorkspaceName).toHaveBeenCalledTimes(1);
  });

  test("the email rule is parseEmail of the shared package (R9)", async () => {
    await openLogin();
    const send = screen.getByRole("button", { name: "Send code" });
    // parseEmail trims, so a padded address is valid; it refuses a leading dot in the local part.
    await userEvent.type(emailField(), "  ada@example.com  ");
    expect(send).toBeEnabled();
    await userEvent.clear(emailField());
    await userEvent.type(emailField(), ".ada@example.com");
    expect(send).toBeDisabled();
    await userEvent.clear(emailField());
    await userEvent.type(emailField(), "a..da@example.com");
    expect(send).toBeDisabled();
  });

  test("a failed workspace read shows no name and no message", async () => {
    await openLogin({ calls: { readWorkspaceName: async () => null } });
    expect(screen.queryByText("Acme")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(emailField()).toBeInTheDocument();
  });

  test("the title is in Vietnamese when the language is", async () => {
    await openLogin({ language: "vi" });
    expect(document.title).not.toBe("Sign in · Toki");
    expect(document.title.length).toBeGreaterThan(0);
  });

  test("an address given by the navigation state is filled in and selected, not in the address bar", async () => {
    const t = await openLogin();
    await act(async () => {
      await t.router.navigate({
        to: "/login",
        state: { email: ADDRESS } as never,
      });
    });
    expect(emailField().value).toBe(ADDRESS);
    expect(t.router.state.location.href).toBe("/login");
  });
});

describe("the code step and the tab record (R7, R15, R35)", () => {
  test("an accepted request shows the step and keeps the record in tab storage", async () => {
    const t = await openLogin();
    await toCodeStep(t);
    expect(t.calls.requestCode).toHaveBeenCalledWith(ADDRESS);
    expect(screen.getByText(ADDRESS)).toBeInTheDocument();
    expect(codeField()).toHaveFocus();
    expect(record(t)).toEqual({
      address: ADDRESS,
      requestId: "req-1",
      answeredAt: t.clock.now(),
      resendAfterSeconds: 60,
      expiresInSeconds: 600,
    });
    // the tab, not the device
    expect(localStorage.length).toBe(0);
  });

  test("the code is sent with the stored requestId, and is never written anywhere", async () => {
    const t = await openLogin();
    await toCodeStep(t);
    await userEvent.type(codeField(), "123456");
    await t.settle();
    expect(t.calls.submitCode).toHaveBeenCalledTimes(1);
    expect(t.calls.submitCode).toHaveBeenCalledWith({
      requestId: "req-1",
      code: "123456",
    });
    for (const store of [sessionStorage, localStorage]) {
      for (let i = 0; i < store.length; i++) {
        expect(store.getItem(store.key(i)!)).not.toContain("123456");
      }
    }
  });

  test("a good code signs in, removes the record and opens the app at /", async () => {
    const t = await openLogin();
    await toCodeStep(t);
    await userEvent.type(codeField(), "123456");
    await t.settle();
    expect(record(t)).toBeNull();
    expect(t.session.getSessionState()).toEqual({ status: "signedIn", user });
    expect(t.router.state.location.pathname).toBe("/");
    expect(await screen.findByTestId("shell")).toBeInTheDocument();
  });

  test("a good code opens the app at next (R3, R11)", async () => {
    const t = await openLogin({ path: "/login?next=%2Fnope" });
    await toCodeStep(t);
    await userEvent.type(codeField(), "123456");
    await t.settle();
    expect(t.router.state.location.pathname).toBe("/nope");
  });

  test("a bad next is ignored after sign-in", async () => {
    const t = await openLogin({ path: "/login?next=%2F%2Fother.example" });
    await toCodeStep(t);
    await userEvent.type(codeField(), "123456");
    await t.settle();
    expect(t.router.state.location.pathname).toBe("/");
  });

  test("a wrong code leaves the record and shows the message", async () => {
    const t = await openLogin({
      calls: {
        submitCode: async () => ({ kind: "incorrect", triesLeft: 4 }),
      },
    });
    await toCodeStep(t);
    await userEvent.type(codeField(), "123456");
    await t.settle();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "That code is not right. 4 tries left.",
    );
    expect(record(t)).not.toBeNull();
  });

  test("'Use a different email' removes the record, sends nothing and shows the address selected", async () => {
    const select = vi.spyOn(HTMLInputElement.prototype, "select");
    const t = await openLogin();
    await toCodeStep(t);
    const sent = t.calls.requestCode.mock.calls.length;
    await userEvent.click(
      screen.getByRole("button", { name: "Use a different email" }),
    );
    await t.settle();
    expect(record(t)).toBeNull();
    expect(t.calls.requestCode).toHaveBeenCalledTimes(sent);
    expect(t.calls.submitCode).not.toHaveBeenCalled();
    expect(emailField().value).toBe(ADDRESS);
    // An email field has no selection range in jsdom: the step selects it with select().
    expect(select).toHaveBeenCalled();
    select.mockRestore();
  });

  test("an accepted resend replaces the requestId, and the next code is sent with it", async () => {
    const t = await openLogin();
    await toCodeStep(t);
    t.calls.requestCode.mockResolvedValueOnce({
      kind: "ok",
      requestId: "req-2",
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    });
    t.timers.advance(60_000);
    await userEvent.click(screen.getByRole("button", { name: "Resend code" }));
    await t.settle();
    expect(record(t)).toMatchObject({
      requestId: "req-2",
      answeredAt: t.clock.now(),
    });
    await userEvent.type(codeField(), "654321");
    await t.settle();
    expect(t.calls.submitCode).toHaveBeenCalledWith({
      requestId: "req-2",
      code: "654321",
    });
  });

  test("'Use a different email' waits while a resend runs, so a late answer cannot write a record (R35)", async () => {
    const t = await openLogin();
    await toCodeStep(t);
    const late = deferred<{
      kind: "ok";
      requestId: string;
      expiresInSeconds: number;
      resendAfterSeconds: number;
    }>();
    t.calls.requestCode.mockReturnValueOnce(late.promise);
    t.timers.advance(60_000);
    await userEvent.click(screen.getByRole("button", { name: "Resend code" }));
    const link = screen.getByRole("button", { name: "Use a different email" });
    expect(link).toBeDisabled();
    await act(async () =>
      late.resolve({
        kind: "ok",
        requestId: "req-2",
        expiresInSeconds: 600,
        resendAfterSeconds: 60,
      }),
    );
    await t.settle();
    expect(link).toBeEnabled();
    await userEvent.click(link);
    expect(record(t)).toBeNull();
  });

  test("a send answered for a requestId that a resend replaced changes nothing (R35)", async () => {
    const t = await openLogin();
    await toCodeStep(t);
    const resent = deferred<{
      kind: "ok";
      requestId: string;
      expiresInSeconds: number;
      resendAfterSeconds: number;
    }>();
    const sent = deferred<{ kind: "expired" }>();
    t.calls.requestCode.mockReturnValueOnce(resent.promise);
    t.calls.submitCode.mockReturnValueOnce(sent.promise);
    t.timers.advance(60_000);
    await userEvent.click(screen.getByRole("button", { name: "Resend code" }));
    await userEvent.type(codeField(), "123456");
    expect(t.calls.submitCode).toHaveBeenCalledWith({
      requestId: "req-1",
      code: "123456",
    });
    await act(async () =>
      resent.resolve({
        kind: "ok",
        requestId: "req-2",
        expiresInSeconds: 600,
        resendAfterSeconds: 60,
      }),
    );
    await act(async () => sent.resolve({ kind: "expired" }));
    await t.settle();
    expect(record(t)).toMatchObject({ requestId: "req-2" });
    expect(screen.queryByText("This code has expired")).toBeNull();
  });

  test("after an accepted resend the record goes at the end of the new code, not the first (R15, R35)", async () => {
    const t = await openLogin();
    await toCodeStep(t);
    t.calls.requestCode.mockResolvedValueOnce({
      kind: "ok",
      requestId: "req-2",
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    });
    t.timers.advance(60_000);
    await userEvent.click(screen.getByRole("button", { name: "Resend code" }));
    await t.settle();
    // The first code ends at 600 s, the new one at 660 s.
    t.timers.advance(540_000);
    expect(record(t)).toMatchObject({ requestId: "req-2" });
    t.timers.advance(59_000);
    expect(record(t)).not.toBeNull();
    t.timers.advance(1_000);
    expect(record(t)).toBeNull();
  });

  test("a new send after 'Use a different email' uses its own code life, not the resend's (R35)", async () => {
    const t = await openLogin();
    await toCodeStep(t);
    t.calls.requestCode.mockResolvedValueOnce({
      kind: "ok",
      requestId: "req-2",
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    });
    t.timers.advance(60_000);
    await userEvent.click(screen.getByRole("button", { name: "Resend code" }));
    await t.settle();
    await userEvent.click(
      screen.getByRole("button", { name: "Use a different email" }),
    );
    await t.settle();
    t.calls.requestCode.mockResolvedValueOnce({
      kind: "ok",
      requestId: "req-3",
      expiresInSeconds: 300,
      resendAfterSeconds: 60,
    });
    await userEvent.click(screen.getByRole("button", { name: "Send code" }));
    await t.settle();
    t.timers.advance(299_000);
    expect(record(t)).toMatchObject({ requestId: "req-3" });
    t.timers.advance(1_000);
    expect(record(t)).toBeNull();
  });

  test("a resend that is refused keeps the record as it was", async () => {
    const t = await openLogin();
    await toCodeStep(t);
    const before = record(t);
    t.calls.requestCode.mockResolvedValueOnce({
      kind: "limit",
      retryAfterSeconds: 720,
    });
    t.timers.advance(60_000);
    await userEvent.click(screen.getByRole("button", { name: "Resend code" }));
    await t.settle();
    expect(screen.getByRole("alert")).toHaveTextContent("12 minutes");
    expect(record(t)).toEqual(before);
  });

  test("the record goes when the code expires; the step stays, expired", async () => {
    const t = await openLogin();
    await toCodeStep(t);
    t.timers.advance(599_000);
    expect(record(t)).not.toBeNull();
    t.timers.advance(1_000);
    expect(record(t)).toBeNull();
    expect(screen.getByText("This code has expired")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Check your email" }),
    ).toBeInTheDocument();
  });

  test("the server's expired answer removes the record too", async () => {
    const t = await openLogin({
      calls: { submitCode: async () => ({ kind: "expired" }) },
    });
    await toCodeStep(t);
    await userEvent.type(codeField(), "123456");
    await t.settle();
    expect(screen.getByText("This code has expired")).toBeInTheDocument();
    expect(record(t)).toBeNull();
  });

  test("a deactivated answer shows the message and keeps the step", async () => {
    const t = await openLogin({
      calls: { submitCode: async () => ({ kind: "deactivated" }) },
    });
    await toCodeStep(t);
    await userEvent.type(codeField(), "123456");
    await t.settle();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This account has been deactivated. Contact an admin.",
    );
    expect(t.session.getSessionState()).toEqual({ status: "signedOut" });
  });
});

describe("a reload on the code step (R15, R35)", () => {
  function seed(
    t: Awaited<ReturnType<typeof loadApp>>,
    over: Record<string, unknown> = {},
  ) {
    const { ago = 20_000, ...rest } = over as { ago?: number };
    t.platform.storage.tab.set(
      RECORD_KEY,
      JSON.stringify({
        address: ADDRESS,
        requestId: "req-stored",
        answeredAt: t.clock.now() - ago,
        resendAfterSeconds: 60,
        expiresInSeconds: 600,
        ...rest,
      }),
    );
  }

  async function reopen(over: Record<string, unknown> = {}, raw?: string) {
    const t = await loadApp({ path: "/login" });
    t.session.markSignedOut();
    if (raw !== undefined) t.platform.storage.tab.set(RECORD_KEY, raw);
    else seed(t, over);
    await t.mount();
    await t.settle();
    return t;
  }

  test("shows the code step again with the address and the wait that is left", async () => {
    const t = await reopen();
    expect(
      screen.getByRole("heading", { name: "Check your email" }),
    ).toBeInTheDocument();
    expect(screen.getByText(ADDRESS)).toBeInTheDocument();
    expect(t.calls.requestCode).not.toHaveBeenCalled();
    // 20 of the 60 seconds are gone: 40 are left.
    const resend = () => screen.getByRole("button", { name: /^Resend code/ });
    expect(resend()).toBeDisabled();
    t.timers.advance(39_000);
    expect(resend()).toBeDisabled();
    t.timers.advance(1_000);
    expect(resend()).toBeEnabled();
  });

  test("a resend after a reload gives the new code its full life (R15, R35)", async () => {
    // 300 of the 600 seconds are gone at the reload.
    const t = await reopen({ ago: 300_000 });
    t.calls.requestCode.mockResolvedValueOnce({
      kind: "ok",
      requestId: "req-2",
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    });
    t.timers.advance(60_000);
    await userEvent.click(screen.getByRole("button", { name: "Resend code" }));
    await t.settle();
    expect(record(t)).toMatchObject({ requestId: "req-2" });
    t.timers.advance(599_000);
    expect(record(t)).not.toBeNull();
    t.timers.advance(1_000);
    expect(record(t)).toBeNull();
  });

  test("a code typed after the reload is sent with the stored requestId", async () => {
    const t = await reopen();
    await userEvent.type(codeField(), "123456");
    await t.settle();
    expect(t.calls.submitCode).toHaveBeenCalledWith({
      requestId: "req-stored",
      code: "123456",
    });
    expect(t.session.getSessionState()).toEqual({ status: "signedIn", user });
    expect(record(t)).toBeNull();
  });

  test("the code expires at its original time, not later", async () => {
    const t = await reopen();
    t.timers.advance(579_000);
    expect(screen.queryByText("This code has expired")).toBeNull();
    t.timers.advance(1_000);
    expect(screen.getByText("This code has expired")).toBeInTheDocument();
    expect(record(t)).toBeNull();
  });

  test("a record whose code has expired is removed and the email step shows", async () => {
    const t = await reopen({ answeredAt: -1 });
    expect(emailField()).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Check your email" }),
    ).toBeNull();
    expect(record(t)).toBeNull();
  });

  test.each(["not json", "{}", '{"address":5}', "null"])(
    "a record that is not readable (%s) is removed and the email step shows",
    async (raw) => {
      const t = await reopen({}, raw);
      expect(emailField()).toBeInTheDocument();
      expect(record(t)).toBeNull();
    },
  );
});

describe("nothing leaks (R32, R35)", () => {
  test("neither the address, the requestId nor the code reaches the address bar or the console", async () => {
    const t = await openLogin({
      calls: {
        submitCode: async () => ({ kind: "incorrect", triesLeft: 3 }),
      },
    });
    await toCodeStep(t);
    await userEvent.type(codeField(), "123456");
    await t.settle();
    await userEvent.click(
      screen.getByRole("button", { name: "Use a different email" }),
    );
    await t.settle();
    const href = t.router.state.location.href + window.location.href;
    for (const secret of [ADDRESS, "ada%40example.com", "req-1", "123456"]) {
      expect(href).not.toContain(secret);
    }
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});

describe("errors on the email step", () => {
  test("a network failure shows the message under the field and keeps the address", async () => {
    const t = await openLogin({
      calls: { requestCode: async () => ({ kind: "network" }) },
    });
    await userEvent.type(emailField(), ADDRESS);
    await userEvent.click(screen.getByRole("button", { name: "Send code" }));
    await t.settle();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not connect");
    expect(emailField().value).toBe(ADDRESS);
    expect(record(t)).toBeNull();
  });
});
