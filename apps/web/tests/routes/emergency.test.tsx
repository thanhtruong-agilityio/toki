// @vitest-environment jsdom
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { EmergencyOutcome } from "@toki/client-core";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { deferred, user } from "../support/auth-harness";
import { loadApp } from "../support/load-app";

const TOKEN = "Tk9-_".repeat(8) + "abc"; // 43 base64url characters

// The real address of the page keeps the fragment: tests put it there like a browser that opened the link.
function openedWith(hash: string) {
  window.history.replaceState(null, "", `/emergency${hash}`);
}

type Options = Parameters<typeof loadApp>[0];

async function openEmergency(
  options: Options = {},
  state: "signedOut" | "signedIn" | "unknown" = "signedOut",
) {
  const t = await loadApp({ path: "/emergency", ...options });
  if (state === "signedOut") t.session.markSignedOut();
  if (state === "signedIn") t.session.markSignedIn(user);
  await t.mount();
  await t.settle();
  return t;
}

const press = () => screen.getByRole("button", { name: "Sign in" });

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
  openedWith(`#${TOKEN}`);
});
afterEach(() => {
  for (const spy of spies) spy.mockRestore();
  window.history.replaceState(null, "", "/");
});

describe("reaching the page (TOKI-026 R40)", () => {
  test("a browser with no session reaches it and is not sent to /login", async () => {
    const t = await openEmergency();
    expect(t.router.state.location.pathname).toBe("/emergency");
    expect(press()).toBeEnabled();
  });

  test("a browser with a session reaches it too", async () => {
    const t = await openEmergency({}, "signedIn");
    expect(t.router.state.location.pathname).toBe("/emergency");
    expect(screen.getByText(/You are signed in as Ada/)).toBeInTheDocument();
  });

  test("shows the page background only while the session is read", async () => {
    const read = deferred<{ kind: "ok"; user: typeof user }>();
    const t = await loadApp({
      path: "/emergency",
      calls: { readSession: () => read.promise },
    });
    await t.mount();
    expect(screen.queryByRole("button")).toBeNull();
    await act(async () => read.resolve({ kind: "ok", user }));
    expect(screen.getByRole("button", { name: "Sign out and continue" }));
  });

  test("a 401 account_deactivated on the session read is no session and shows no modal", async () => {
    const t = await openEmergency(
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
    expect(t.router.state.location.pathname).toBe("/emergency");
    expect(press()).toBeEnabled();
    expect(screen.queryByText("This account has been deactivated")).toBeNull();
  });

  test("sets the title", async () => {
    await openEmergency();
    expect(document.title).toBe("Emergency sign-in · Toki");
  });
});

describe("the fragment and the first request (R41, R42)", () => {
  test("removes the fragment from the address bar and the router state before any request", async () => {
    let hrefWhenCalled = "";
    const t = await openEmergency({
      emergency: {
        signInWithLink: async () => {
          hrefWhenCalled = window.location.href;
          return { kind: "ok", user };
        },
      },
    });
    expect(window.location.hash).toBe("");
    expect(window.location.href).not.toContain(TOKEN);
    expect(t.router.state.location.href).not.toContain(TOKEN);
    await userEvent.click(press());
    expect(hrefWhenCalled).not.toContain(TOKEN);
  });

  test("keeps the history state of the router when it removes the fragment", async () => {
    window.history.replaceState({ key: "k1" }, "", `/emergency#${TOKEN}`);
    await openEmergency();
    expect(window.history.state).toEqual(
      expect.objectContaining({ key: "k1" }),
    );
  });

  test("sends nothing when the page loads", async () => {
    const t = await openEmergency();
    expect(t.emergency.signInWithLink).not.toHaveBeenCalled();
  });

  test.each([
    ["no fragment", ""],
    ["a fragment of 42 characters", `#${TOKEN.slice(0, 42)}`],
    ["a fragment of 44 characters", `#${TOKEN}A`],
    [
      "a fragment with a character outside base64url",
      `#${TOKEN.slice(0, 42)}+`,
    ],
  ])(
    "shows the link as not valid and sends nothing for %s",
    async (_n, hash) => {
      openedWith(hash);
      const t = await openEmergency();
      expect(screen.getByText(/This link is not valid/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
      expect(t.emergency.signInWithLink).not.toHaveBeenCalled();
    },
  );

  test("survives a second render of the page: the token is read once", async () => {
    const t = await openEmergency();
    await userEvent.click(press());
    expect(t.emergency.signInWithLink).toHaveBeenCalledWith(TOKEN, "cookie");
  });
});

describe("one press, one request (R42)", () => {
  test("one request per press, and a second press while it runs sends nothing", async () => {
    const answer = deferred<{ kind: "ok"; user: typeof user }>();
    const t = await openEmergency({
      emergency: { signInWithLink: () => answer.promise },
    });
    await userEvent.click(press());
    await userEvent.click(press());
    expect(t.emergency.signInWithLink).toHaveBeenCalledTimes(1);
    await act(async () => answer.resolve({ kind: "ok", user }));
  });

  test("sends the token and the cookie transport", async () => {
    const t = await openEmergency();
    await userEvent.click(press());
    expect(t.emergency.signInWithLink).toHaveBeenCalledWith(TOKEN, "cookie");
  });
});

describe("a browser that already has a session (R43)", () => {
  test("asks first, and a refusal sends nothing and keeps the session", async () => {
    const t = await openEmergency({}, "signedIn");
    expect(
      screen.getByText("You are signed in as Ada. Sign out to continue?"),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Stay signed in" }),
    );
    expect(t.emergency.signInWithLink).not.toHaveBeenCalled();
    expect(t.session.getSessionState().status).toBe("signedIn");
  });

  test("a confirmation sends the request with the cookie transport", async () => {
    const t = await openEmergency({}, "signedIn");
    await userEvent.click(
      screen.getByRole("button", { name: "Sign out and continue" }),
    );
    expect(t.emergency.signInWithLink).toHaveBeenCalledTimes(1);
    expect(t.emergency.signInWithLink).toHaveBeenCalledWith(TOKEN, "cookie");
  });

  test.each(["failed", "rateLimited"] as const)(
    "asks again after a %s answer, so a retry never replaces the session without the question",
    async (kind) => {
      const answers: EmergencyOutcome[] = [
        kind === "failed"
          ? { kind: "failed" }
          : { kind: "rateLimited", retryAfterSeconds: 60 },
        { kind: "ok", user },
      ];
      let n = 0;
      const t = await openEmergency(
        { emergency: { signInWithLink: async () => answers[n++]! } },
        "signedIn",
      );
      await userEvent.click(
        screen.getByRole("button", { name: "Sign out and continue" }),
      );
      expect(t.emergency.signInWithLink).toHaveBeenCalledTimes(1);
      // The answer is shown with the question: the failure text, or the wait in whole minutes (R45).
      expect(screen.getByRole("alert")).toHaveTextContent(
        kind === "failed"
          ? "Can't reach Toki. Try again."
          : "Too many attempts from this network. Try again in 1 minute.",
      );
      // The question is back, with its two buttons, and the bare button is not.
      expect(screen.getByText(/You are signed in as Ada/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
      await userEvent.click(
        screen.getByRole("button", { name: "Sign out and continue" }),
      );
      expect(t.emergency.signInWithLink).toHaveBeenCalledTimes(2);
    },
  );

  test("the question is in Vietnamese when the language is Vietnamese", async () => {
    await openEmergency({ language: "vi" }, "signedIn");
    expect(
      screen.getByText(
        "Bạn đang đăng nhập với tên Ada. Đăng xuất để tiếp tục?",
      ),
    ).toBeInTheDocument();
  });
});

describe("the answers (R45)", () => {
  test("200 signs the person in and goes to Home with the entry replaced", async () => {
    const t = await openEmergency();
    const before = window.history.length;
    await userEvent.click(press());
    await t.settle();
    expect(t.session.getSessionState()).toEqual(
      expect.objectContaining({ status: "signedIn" }),
    );
    expect(t.router.state.location.pathname).toBe("/");
    expect(window.history.length).toBe(before);
  });

  test("emergency_link_invalid shows the link as not valid with no workspace content", async () => {
    await openEmergency({
      emergency: { signInWithLink: async () => ({ kind: "invalid" }) },
    });
    await userEvent.click(press());
    expect(screen.getByText(/This link is not valid/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
  });

  test("account_deactivated shows the deactivated state", async () => {
    await openEmergency({
      emergency: { signInWithLink: async () => ({ kind: "deactivated" }) },
    });
    await userEvent.click(press());
    expect(screen.getByText("Account deactivated")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
  });

  test.each(["network", "failed"] as const)(
    "a %s answer shows the general failure and lets the person press again",
    async (kind) => {
      const t = await openEmergency({
        emergency: { signInWithLink: async () => ({ kind }) },
      });
      await userEvent.click(press());
      expect(
        screen.getByText("Can't reach Toki. Try again."),
      ).toBeInTheDocument();
      await userEvent.click(press());
      expect(t.emergency.signInWithLink).toHaveBeenCalledTimes(2);
      expect(t.emergency.signInWithLink).toHaveBeenLastCalledWith(
        TOKEN,
        "cookie",
      );
    },
  );

  test("rate_limited shows the wait in whole minutes, keeps the token, and a later press sends one request", async () => {
    const answers = [
      { kind: "rateLimited", retryAfterSeconds: 61 },
      { kind: "ok", user },
    ] as const;
    let n = 0;
    const t = await openEmergency({
      emergency: { signInWithLink: async () => answers[n++]! },
    });
    await userEvent.click(press());
    expect(
      screen.getByText(
        "Too many attempts from this network. Try again in 2 minutes.",
      ),
    ).toBeInTheDocument();
    await userEvent.click(press());
    expect(t.emergency.signInWithLink).toHaveBeenCalledTimes(2);
    expect(t.emergency.signInWithLink).toHaveBeenLastCalledWith(
      TOKEN,
      "cookie",
    );
  });

  test("rate_limited under a minute reads as one minute", async () => {
    await openEmergency({
      emergency: {
        signInWithLink: async () => ({
          kind: "rateLimited",
          retryAfterSeconds: 5,
        }),
      },
    });
    await userEvent.click(press());
    expect(
      screen.getByText(
        "Too many attempts from this network. Try again in 1 minute.",
      ),
    ).toBeInTheDocument();
  });
});

describe("the token stays out of everything but the request body (R44)", () => {
  test("it is in no storage, no console call and no address, and the page loads nothing from another origin", async () => {
    const t = await openEmergency({
      emergency: { signInWithLink: async () => ({ kind: "invalid" }) },
    });
    await userEvent.click(press());
    await t.settle();
    const everywhere = JSON.stringify([
      { ...localStorage },
      { ...sessionStorage },
      consoleCalls,
      window.location.href,
      t.router.state.location,
      document.documentElement.outerHTML,
    ]);
    expect(everywhere).not.toContain(TOKEN);
    expect(
      [...document.querySelectorAll("[src], link[href]")].filter((el) => {
        const url = el.getAttribute("src") ?? el.getAttribute("href") ?? "";
        return /^(https?:)?\/\//.test(url);
      }),
    ).toEqual([]);
  });
});
