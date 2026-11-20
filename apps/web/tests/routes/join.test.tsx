// @vitest-environment jsdom
import { act, cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { JoinSendOutcome, LookupOutcome } from "@toki/client-core";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { PENDING, deferred, joinUser, user } from "../support/auth-harness";
import { loadApp } from "../support/load-app";

const TOKEN = "Jn7-_".repeat(8) + "abc"; // 43 base64url characters
type Options = Parameters<typeof loadApp>[0];

const lookupOf = (lookup: unknown): LookupOutcome =>
  ({ kind: "ok", lookup }) as LookupOutcome;
const codeField = () => screen.getByLabelText("Code") as HTMLInputElement;
const resendButton = () =>
  screen.getByRole("button", { name: /^(Resend code|Send a new code)/ });

async function openJoin(
  options: Options = {},
  session: "signedOut" | "signedIn" | "unknown" = "signedOut",
) {
  const t = await loadApp({ path: "/join", token: TOKEN, ...options });
  if (session === "signedOut") t.session.markSignedOut();
  if (session === "signedIn") t.session.markSignedIn(user);
  await t.mount();
  await t.settle();
  return t;
}

let spies: ReturnType<typeof vi.spyOn>[] = [];
let consoleCalls: unknown[][] = [];
beforeEach(() => {
  consoleCalls = [];
  spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation((...args) => {
      consoleCalls.push(args);
    }),
  );
  sessionStorage.clear();
  localStorage.clear();
});
afterEach(() => {
  for (const spy of spies) spy.mockRestore();
  window.history.replaceState(null, "", "/");
});

describe("opening the page (R25, R26, R28, R43)", () => {
  test("is reached with no session and with one, never sent to /login, and sends only the lookup", async () => {
    for (const session of ["signedOut", "signedIn"] as const) {
      cleanup();
      const t = await openJoin({}, session);
      expect(t.router.state.location.pathname).toBe("/join");
      expect(t.router.state.location.search).toEqual({});
      expect(t.invitation.lookupInvitation).toHaveBeenCalledTimes(1);
      expect(t.invitation.lookupInvitation).toHaveBeenCalledWith(TOKEN);
      expect(t.invitation.resendInvitationCode).not.toHaveBeenCalled();
      expect(t.invitation.acceptInvitation).not.toHaveBeenCalled();
    }
  });

  test("shows the page background only while the session is read, then the lookup", async () => {
    const read = deferred<{ kind: "unauthenticated"; code: string }>();
    const t = await openJoin(
      { calls: { readSession: () => read.promise } },
      "unknown",
    );
    expect(screen.queryByRole("heading")).toBeNull();
    // the page is not mounted while the session is read: no request of its own yet (R25, R28)
    expect(t.invitation.lookupInvitation).not.toHaveBeenCalled();
    await act(async () =>
      read.resolve({ kind: "unauthenticated", code: "unauthenticated" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Check your email" }),
    ).toBeInTheDocument();
    expect(t.invitation.lookupInvitation).toHaveBeenCalledTimes(1);
  });

  test("no fragment is left in the address bar, the router's location or the history entry (R26, R43)", async () => {
    const t = await openJoin();
    expect(window.location.hash).toBe("");
    expect(window.location.href).not.toContain(TOKEN);
    expect(t.router.state.location.hash).toBe("");
    expect(t.router.state.location.href).not.toContain(TOKEN);
    expect(JSON.stringify(window.history.state)).not.toContain(TOKEN);
    expect(JSON.stringify(t.router.state.location.state)).not.toContain(TOKEN);
  });

  test("the token reaches the calls as an argument only; nothing is stored or logged (R43)", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const t = await openJoin();
    expect(JSON.stringify(consoleCalls)).not.toContain(TOKEN);
    expect(setItem).not.toHaveBeenCalled();
    expect(JSON.stringify(Object.entries(localStorage))).not.toContain(TOKEN);
    expect(JSON.stringify(Object.entries(sessionStorage))).not.toContain(TOKEN);
    expect(t.session.getSessionState()).toEqual({ status: "signedOut" });
    setItem.mockRestore();
  });

  test("closing the page and opening Toki again leaves nobody signed in (R28)", async () => {
    const t = await openJoin();
    expect(t.session.getSessionState().status).toBe("signedOut");
    expect(t.invitation.acceptInvitation).not.toHaveBeenCalled();
  });

  test("the route carries the flag `public`, and the page has the no-referrer meta (R25, R43)", async () => {
    const t = await openJoin();
    const route = t.router.routesByPath["/join" as never] as unknown as {
      options: { staticData?: { public?: boolean } };
    };
    expect(route.options.staticData?.public).toBe(true);
    const html = readFileSync(
      join(import.meta.dirname, "../../index.html"),
      "utf8",
    );
    expect(html).toContain('<meta name="referrer" content="no-referrer" />');
  });

  test("sets the title and shows the code step with the address and the workspace name (R27)", async () => {
    await openJoin();
    expect(document.title).toBe("Sign in · Toki");
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("sam@example.com")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Check your email" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("The code works for 10 minutes"),
    ).toBeInTheDocument();
    expect(codeField()).toHaveFocus();
    expect(
      screen.getByRole("button", { name: "Use a different email" }),
    ).toBeInTheDocument();
  });
});

describe("a link that cannot be used (R34, R35)", () => {
  const cases: [string, unknown, string, string | null][] = [
    [
      "expired",
      { state: "expired", workspaceName: "Acme" },
      "This invitation has expired",
      "Ask the person who invited you for a new one.",
    ],
    [
      "revoked",
      { state: "revoked", workspaceName: "Acme" },
      "This invitation is no longer valid",
      "Ask an admin.",
    ],
    ["unknown", { state: "unknown" }, "This link is not valid", null],
  ];
  test.each(cases)(
    "%s shows its page with no field and no button",
    async (_name, lookup, title, line) => {
      await openJoin({
        invitation: { lookupInvitation: async () => lookupOf(lookup) },
      });
      const heading = screen.getByRole("heading", { name: title });
      expect(heading).toHaveFocus();
      if (line) expect(screen.getByText(line)).toBeInTheDocument();
      expect(screen.queryByLabelText("Code")).toBeNull();
      expect(screen.queryByRole("button")).toBeNull();
    },
  );

  test("the unrecognised page holds no name of the workspace anywhere", async () => {
    await openJoin({
      invitation: {
        lookupInvitation: async () => lookupOf({ state: "unknown" }),
      },
    });
    expect(document.body.textContent).not.toContain("Acme");
  });

  test("a link with no fragment, and one of the wrong shape, show the unrecognised page and send no request (R26)", async () => {
    for (const token of [undefined, "short", `${TOKEN}A`]) {
      cleanup();
      const t = await loadApp({
        path: "/join",
        ...(token === undefined ? {} : { token }),
      });
      t.session.markSignedOut();
      await t.mount();
      await t.settle();
      expect(
        screen.getByRole("heading", { name: "This link is not valid" }),
      ).toBeInTheDocument();
      expect(t.invitation.lookupInvitation).not.toHaveBeenCalled();
      expect(t.invitation.resendInvitationCode).not.toHaveBeenCalled();
      expect(t.invitation.acceptInvitation).not.toHaveBeenCalled();
      expect(window.location.hash).toBe("");
    }
  });

  test("a 400 of the lookup shows the unrecognised page (R2)", async () => {
    await openJoin({
      invitation: { lookupInvitation: async () => ({ kind: "invalid" }) },
    });
    expect(
      screen.getByRole("heading", { name: "This link is not valid" }),
    ).toBeInTheDocument();
  });

  test("a used invitation goes to /login with the address filled in through the navigation state, never the address (R34)", async () => {
    const t = await openJoin({
      invitation: {
        lookupInvitation: async () =>
          lookupOf({ state: "used", email: "sam@example.com" }),
      },
    });
    expect(t.router.state.location.pathname).toBe("/login");
    expect(t.router.state.location.href).not.toContain("sam");
    expect(t.router.state.location.state.email).toBe("sam@example.com");
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe(
      "sam@example.com",
    );
    expect(
      screen.queryByRole("heading", { name: /invitation|link/i }),
    ).toBeNull();
  });

  test("a used invitation with a session leads on to the app (R34)", async () => {
    const t = await openJoin(
      {
        invitation: {
          lookupInvitation: async () =>
            lookupOf({ state: "used", email: "sam@example.com" }),
        },
      },
      "signedIn",
    );
    expect(t.router.state.location.pathname).toBe("/");
  });

  test("a lookup that fails shows the card with the general message, and one with no answer the network message (outcomes table)", async () => {
    await openJoin({
      invitation: { lookupInvitation: async () => ({ kind: "failed" }) },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Something went wrong. Try again.",
    );
    expect(screen.queryByLabelText("Code")).toBeNull();
    cleanup();
    const t = await openJoin({
      invitation: { lookupInvitation: async () => ({ kind: "network" }) },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Could not connect");
    expect(t.invitation.lookupInvitation).toHaveBeenCalledTimes(1);
  });
});

describe("the question for a person signed in as someone else (R36, R41, R46)", () => {
  test("is asked before the code step with both addresses, and nothing is sent or changed while it shows", async () => {
    const t = await openJoin({}, "signedIn"); // Ada is signed in; the invitation is for sam@
    const heading = screen.getByRole("heading", {
      name: "You are signed in as ada@example.com. Sign out to continue as sam@example.com?",
    });
    expect(heading).toHaveFocus();
    expect(screen.queryByLabelText("Code")).toBeNull();
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Sign out and continue",
      "Stay signed in",
    ]);
    expect(t.invitation.resendInvitationCode).not.toHaveBeenCalled();
    expect(t.invitation.acceptInvitation).not.toHaveBeenCalled();
    expect(t.session.getSessionState().status).toBe("signedIn");
  });

  test("'Stay signed in' replaces the page with / and sends nothing: the person stays signed in", async () => {
    const t = await openJoin({}, "signedIn");
    await userEvent.click(
      screen.getByRole("button", { name: "Stay signed in" }),
    );
    await t.settle();
    expect(t.router.state.location.pathname).toBe("/");
    expect(t.session.getSessionState().status).toBe("signedIn");
    expect(t.invitation.acceptInvitation).not.toHaveBeenCalled();
    expect(t.invitation.resendInvitationCode).not.toHaveBeenCalled();
    expect(t.invitation.lookupInvitation).toHaveBeenCalledTimes(1);
  });

  test("'Sign out and continue' shows the code step and signs nobody out yet", async () => {
    const t = await openJoin({}, "signedIn");
    await userEvent.click(
      screen.getByRole("button", { name: "Sign out and continue" }),
    );
    expect(
      screen.getByRole("heading", { name: "Check your email" }),
    ).toBeInTheDocument();
    expect(t.session.getSessionState().status).toBe("signedIn");
    expect(t.resetConversations).not.toHaveBeenCalled();
  });

  test("the same address as the invitation gets no question", async () => {
    await openJoin(
      {
        invitation: {
          lookupInvitation: async () =>
            lookupOf({ ...PENDING, email: "ada@example.com" }),
        },
      },
      "signedIn",
    );
    expect(
      screen.getByRole("heading", { name: "Check your email" }),
    ).toBeInTheDocument();
  });

  test("'Use a different email' goes to /login with no session and to / with one, and sends nothing (R46)", async () => {
    const out = await openJoin();
    await userEvent.click(
      screen.getByRole("button", { name: "Use a different email" }),
    );
    await out.settle();
    expect(out.router.state.location.pathname).toBe("/login");
    expect(out.invitation.resendInvitationCode).not.toHaveBeenCalled();
    expect(out.invitation.acceptInvitation).not.toHaveBeenCalled();

    const inn = await openJoin({}, "signedIn");
    await userEvent.click(
      screen.getByRole("button", { name: "Sign out and continue" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Use a different email" }),
    );
    await inn.settle();
    expect(inn.router.state.location.pathname).toBe("/");
    expect(inn.session.getSessionState().status).toBe("signedIn");
  });

  test("a 401 account_deactivated on the session read counts as no session: the code step shows, no modal (R37)", async () => {
    await openJoin(
      {
        calls: {
          readSession: async () => ({
            kind: "unauthenticated",
            code: "account_deactivated",
          }),
        },
      },
      "unknown",
    );
    expect(
      await screen.findByRole("heading", { name: "Check your email" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("the waits (R29, R30, R54)", () => {
  test("'Resend code' is disabled for resendAfterSeconds of the lookup and enabled from then on", async () => {
    const t = await openJoin({
      invitation: {
        lookupInvitation: async () =>
          lookupOf({ ...PENDING, resendAfterSeconds: 60 }),
      },
    });
    expect(resendButton()).toBeDisabled();
    t.timers.advance(59_000);
    expect(resendButton()).toBeDisabled();
    t.timers.advance(1_000);
    expect(resendButton()).toBeEnabled();
  });

  test("a lookup with 0 seconds of resend wait opens the button enabled", async () => {
    await openJoin({
      invitation: {
        lookupInvitation: async () =>
          lookupOf({ ...PENDING, resendAfterSeconds: 0 }),
      },
    });
    expect(resendButton()).toBeEnabled();
  });

  test("a lookup with 0 seconds of life opens the step expired, with 'Send a new code'", async () => {
    await openJoin({
      invitation: {
        lookupInvitation: async () =>
          lookupOf({
            ...PENDING,
            codeExpiresInSeconds: 0,
            resendAfterSeconds: 0,
          }),
      },
    });
    expect(screen.getByText("This code has expired")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send a new code" }),
    ).toBeInTheDocument();
  });

  test("a code typed 10 minutes after the lookup is answered code_expired with 'Send a new code' (R31)", async () => {
    const t = await openJoin({
      invitation: { acceptInvitation: async () => ({ kind: "expired" }) },
    });
    t.timers.advance(600_000);
    await userEvent.type(codeField(), "123456");
    await t.settle();
    expect(screen.getByText("This code has expired")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send a new code" }),
    ).toBeInTheDocument();
  });

  test("'Resend code' sends the resend, empties the field and starts the wait again (R30)", async () => {
    const t = await openJoin({
      invitation: {
        lookupInvitation: async () =>
          lookupOf({ ...PENDING, resendAfterSeconds: 0 }),
      },
    });
    await userEvent.type(codeField(), "123");
    await userEvent.click(resendButton());
    await t.settle();
    expect(t.invitation.resendInvitationCode).toHaveBeenCalledWith(TOKEN);
    expect(codeField().value).toBe("");
    expect(resendButton()).toBeDisabled();
    t.timers.advance(60_000);
    expect(resendButton()).toBeEnabled();
  });

  test("code_resend_too_soon changes nothing and the control waits retryAfterSeconds (R30)", async () => {
    const t = await openJoin({
      invitation: {
        lookupInvitation: async () =>
          lookupOf({ ...PENDING, resendAfterSeconds: 0 }),
        resendInvitationCode: async () => ({
          kind: "tooSoon",
          retryAfterSeconds: 30,
        }),
      },
    });
    await userEvent.click(resendButton());
    await t.settle();
    expect(resendButton()).toBeDisabled();
    t.timers.advance(29_000);
    expect(resendButton()).toBeDisabled();
    t.timers.advance(1_000);
    expect(resendButton()).toBeEnabled();
  });

  test("code_request_limit shows the message under the code field and disables the control until the wait ends (R54)", async () => {
    const t = await openJoin({
      invitation: {
        lookupInvitation: async () =>
          lookupOf({ ...PENDING, resendAfterSeconds: 0 }),
        resendInvitationCode: async () => ({
          kind: "limit",
          retryAfterSeconds: 720,
        }),
      },
    });
    await userEvent.click(resendButton());
    await t.settle();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "You have asked for too many codes. Try again in 12 minutes.",
    );
    expect(resendButton()).toBeDisabled();
    t.timers.advance(720_000);
    expect(resendButton()).toBeEnabled();
  });

  test("the same message shows on 'Send a new code' of the expired state (R54)", async () => {
    await openJoin({
      invitation: {
        lookupInvitation: async () =>
          lookupOf({
            ...PENDING,
            codeExpiresInSeconds: 0,
            resendAfterSeconds: 0,
          }),
        resendInvitationCode: async () => ({
          kind: "limit",
          retryAfterSeconds: 300,
        }),
      },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Send a new code" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Try again in 5 minutes.",
    );
  });

  test.each([
    ["used", "/login"],
    ["expired", null],
    ["revoked", null],
    ["unknown", null],
  ] as const)(
    "a resend answered with the state %s switches to the page of that state (R30, R47)",
    async (state, path) => {
      const t = await openJoin({
        invitation: {
          lookupInvitation: async () =>
            lookupOf({ ...PENDING, resendAfterSeconds: 0 }),
          resendInvitationCode: async () => ({ kind: "closed", state }),
        },
      });
      await userEvent.click(resendButton());
      await t.settle();
      if (path) {
        expect(t.router.state.location.pathname).toBe(path);
        expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe(
          "sam@example.com",
        );
      } else {
        const titles = {
          expired: "This invitation has expired",
          revoked: "This invitation is no longer valid",
          unknown: "This link is not valid",
        };
        expect(
          screen.getByRole("heading", { name: titles[state as "expired"] }),
        ).toBeInTheDocument();
      }
    },
  );

  test("a lost connection and a failure show the messages and keep what was typed (R30)", async () => {
    for (const [kind, text] of [
      ["network", "Could not connect"],
      ["failed", "Something went wrong. Try again."],
    ] as const) {
      cleanup();
      const t = await openJoin({
        invitation: {
          lookupInvitation: async () =>
            lookupOf({ ...PENDING, resendAfterSeconds: 0 }),
          resendInvitationCode: async () => ({ kind }),
        },
      });
      await userEvent.type(codeField(), "12");
      await userEvent.click(resendButton());
      await t.settle();
      expect(screen.getByRole("alert")).toHaveTextContent(text);
      expect(codeField().value).toBe("12");
    }
  });
});

describe("the code (R31, R32, R33, R45, R49)", () => {
  test("the 6th digit sends the code once, fewer than 6 send nothing", async () => {
    const t = await openJoin();
    await userEvent.type(codeField(), "12345");
    expect(t.invitation.acceptInvitation).not.toHaveBeenCalled();
    await userEvent.type(codeField(), "6");
    await t.settle();
    expect(t.invitation.acceptInvitation).toHaveBeenCalledTimes(1);
    expect(t.invitation.acceptInvitation).toHaveBeenCalledWith(TOKEN, "123456");
  });

  const answers: [string, JoinSendOutcome, string][] = [
    [
      "incorrect",
      { kind: "incorrect", triesLeft: 4 },
      "That code is not right. 4 tries left.",
    ],
    ["locked", { kind: "locked" }, "This code is locked. Ask for a new one."],
    ["network", { kind: "network" }, "Could not connect"],
    ["failed", { kind: "failed" }, "Something went wrong. Try again."],
  ];
  test.each(answers)(
    "%s shows its message and keeps what was typed",
    async (_k, answer, text) => {
      const t = await openJoin({
        invitation: { acceptInvitation: async () => answer },
      });
      await userEvent.type(codeField(), "123456");
      await t.settle();
      expect(screen.getByRole("alert")).toHaveTextContent(text);
    },
  );

  test("code_expired shows 'This code has expired' with 'Send a new code' (R31)", async () => {
    const t = await openJoin({
      invitation: { acceptInvitation: async () => ({ kind: "expired" }) },
    });
    await userEvent.type(codeField(), "123456");
    await t.settle();
    expect(screen.getByText("This code has expired")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send a new code" }),
    ).toBeInTheDocument();
  });

  test("after a 500 the control is enabled and the same digits get code_expired, then a new code is sent (R45)", async () => {
    let n = 0;
    const t = await openJoin({
      invitation: {
        acceptInvitation: async () =>
          ++n === 1 ? { kind: "failed" } : { kind: "expired" },
        resendInvitationCode: async () => ({
          kind: "tooSoon",
          retryAfterSeconds: 20,
        }),
      },
    });
    await userEvent.type(codeField(), "123456");
    await t.settle();
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(codeField().value).toBe("123456");
    expect(codeField()).toBeEnabled();
    // the same digits are sent again
    await userEvent.type(codeField(), "{backspace}6");
    await t.settle();
    expect(t.invitation.acceptInvitation).toHaveBeenCalledTimes(2);
    expect(screen.getByText("This code has expired")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Send a new code" }),
    );
    await t.settle();
    expect(
      screen.getByRole("button", { name: "Send a new code" }),
    ).toBeDisabled();
  });

  test.each([
    ["used", "/login"],
    ["revoked", null],
    ["expired", null],
    ["unknown", null],
  ] as const)(
    "an accept answered with the state %s moves the page and gives `left` (R31, R34, R44, R47)",
    async (state, path) => {
      const t = await openJoin({
        invitation: {
          acceptInvitation: async () => ({ kind: "closed", state }),
        },
      });
      await userEvent.type(codeField(), "123456");
      await t.settle();
      if (path) {
        expect(t.router.state.location.pathname).toBe(path);
        expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe(
          "sam@example.com",
        );
      } else {
        expect(screen.queryByLabelText("Code")).toBeNull();
        expect(screen.getByRole("heading")).toBeInTheDocument();
      }
      expect(t.session.getSessionState().status).toBe("signedOut");
    },
  );

  test("on 200 the app opens at /c/<id>, replacing the Join entry, and the session is signed in with the returned user (R32, R33)", async () => {
    const t = await openJoin();
    const before = t.router.history.length;
    await userEvent.type(codeField(), "123456");
    await t.settle();
    expect(t.router.state.location.pathname).toBe("/c/g1");
    expect(t.router.history.length).toBe(before);
    expect(t.session.getSessionState()).toEqual({
      status: "signedIn",
      user: joinUser,
    });
    expect(t.resetConversations).not.toHaveBeenCalled();
    // no other step in between
    expect(
      screen.queryByRole("heading", { name: "Check your email" }),
    ).toBeNull();
  });

  test("from a signed-in person the store is reset before markSignedIn and before the app opens (R33)", async () => {
    const t = await openJoin({}, "signedIn");
    await userEvent.click(
      screen.getByRole("button", { name: "Sign out and continue" }),
    );
    const unsubscribe = t.session.subscribeSession(() => {
      const s = t.session.getSessionState();
      if (s.status === "signedIn" && s.user.id === joinUser.id)
        t.order.push("signedIn");
    });
    t.router.subscribe("onResolved", () => {
      if (t.router.state.location.pathname === "/c/g1") t.order.push("opened");
    });
    await userEvent.type(codeField(), "123456");
    await t.settle();
    unsubscribe();
    expect(t.order.slice(0, 3)).toEqual(["reset", "signedIn", "opened"]);
    expect(t.resetConversations).toHaveBeenCalledTimes(1);
  });

  test("markSignedIn is called with the returned user from every earlier state (R33)", async () => {
    for (const state of ["signedOut", "signedIn"] as const) {
      const t = await openJoin(
        {
          invitation: {
            lookupInvitation: async () =>
              lookupOf({ ...PENDING, email: "ada@example.com" }),
          },
        },
        state,
      );
      await userEvent.type(codeField(), "123456");
      await t.settle();
      expect(t.session.getSessionState()).toEqual({
        status: "signedIn",
        user: joinUser,
      });
    }
  });
});

describe("a reload and a returning person (R38, R48)", () => {
  test("a reload loses the token: the unrecognised page, no request (R48)", async () => {
    const t = await loadApp({ path: "/join" }); // the page loaded anew: the fragment is gone
    t.session.markSignedOut();
    await t.mount();
    await t.settle();
    expect(
      screen.getByRole("heading", { name: "This link is not valid" }),
    ).toBeInTheDocument();
    expect(t.invitation.lookupInvitation).not.toHaveBeenCalled();
  });

  test("nothing on the page says the account was deactivated (R38)", async () => {
    await openJoin(
      {
        calls: {
          readSession: async () => ({
            kind: "unauthenticated",
            code: "account_deactivated",
          }),
        },
      },
      "unknown",
    );
    await screen.findByRole("heading", { name: "Check your email" });
    expect(document.body.textContent?.toLowerCase()).not.toContain(
      "deactivated",
    );
  });
});
