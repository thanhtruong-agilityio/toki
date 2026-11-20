// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { deferred, user } from "../support/auth-harness";
import { loadApp } from "../support/load-app";
import type { SessionReadOutcome } from "@toki/client-core";

const app = () => screen.queryByTestId("shell");
const modal = () => screen.queryByRole("dialog");

describe("opening Toki: the session read (R1, R2, R44)", () => {
  test("while the session is read the page shows the background only", async () => {
    const read = deferred<SessionReadOutcome>();
    const t = await loadApp({
      calls: { readSession: () => read.promise },
    });
    await t.mount();
    expect(t.session.getSessionState()).toEqual({ status: "unknown" });
    expect(document.body.textContent).toBe("");
    expect(app()).toBeNull();
    expect(screen.queryByLabelText("Email")).toBeNull();
    expect(t.calls.readSession).toHaveBeenCalledTimes(1);

    read.resolve({ kind: "ok", user });
    await t.settle();
    expect(t.session.getSessionState()).toEqual({ status: "signedIn", user });
    expect(await screen.findByTestId("shell")).toBeInTheDocument();
    expect(t.calls.readSession).toHaveBeenCalledTimes(1);
  });

  test("401 unauthenticated opens /login with the opened address as next", async () => {
    const t = await loadApp({
      path: "/nope?x=1",
      calls: {
        readSession: async () => ({
          kind: "unauthenticated",
          code: "unauthenticated",
        }),
      },
    });
    await t.mount();
    await t.settle();
    expect(t.router.state.location.pathname).toBe("/login");
    expect(t.router.state.location.search).toEqual({ next: "/nope?x=1" });
    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
    expect(modal()).toBeNull();
    expect(t.session.getSessionState()).toEqual({ status: "signedOut" });
  });

  test("401 session_ended opens /login, with no modal", async () => {
    const t = await loadApp({
      calls: {
        readSession: async () => ({
          kind: "unauthenticated",
          code: "session_ended",
        }),
      },
    });
    await t.mount();
    await t.settle();
    expect(t.router.state.location.pathname).toBe("/login");
    expect(modal()).toBeNull();
  });

  test("a person with a session who opens /login lands on next, or on /", async () => {
    const a = await loadApp({ path: "/login?next=%2Fnope%3Fa%3D1" });
    await a.mount();
    await a.settle();
    expect(a.router.state.location.pathname).toBe("/nope");
    expect(a.router.state.location.search).toEqual({ a: 1 });
    expect(screen.queryByLabelText("Email")).toBeNull();
  });

  test.each([
    "//other.example",
    "/\\other.example",
    "https://other.example",
    "/login",
  ])("a signed-in person with next %j lands on /", async (next) => {
    const t = await loadApp({
      path: `/login?next=${encodeURIComponent(next)}`,
    });
    await t.mount();
    await t.settle();
    expect(t.router.state.location.pathname).toBe("/");
    expect(await screen.findByTestId("shell")).toBeInTheDocument();
  });

  test("opened as deactivated: the modal over the page background, with the link and no app", async () => {
    const t = await loadApp({
      calls: {
        readSession: async () => ({
          kind: "unauthenticated",
          code: "account_deactivated",
        }),
      },
    });
    await t.mount();
    await t.settle();
    expect(t.session.getSessionState()).toEqual({
      status: "ended",
      reason: "deactivated",
    });
    expect(modal()).toHaveTextContent("This account has been deactivated");
    expect(app()).toBeNull();
    const link = screen.getByRole("button", { name: "Use a different email" });
    expect(screen.queryByRole("button", { name: "Sign in again" })).toBeNull();

    await userEvent.click(link);
    await t.settle();
    expect(t.router.state.location.pathname).toBe("/login");
    expect(t.router.state.location.search).toEqual({});
    expect(t.session.getSessionState()).toEqual({ status: "signedOut" });
    expect(modal()).toBeNull();
    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
  });
});

describe("a session that ends while the app is showing (R24 to R27)", () => {
  test("one modal for many refusals, the app stays under it", async () => {
    const t = await loadApp();
    t.session.markSignedIn(user);
    await t.mount();
    expect(await screen.findByTestId("shell")).toBeInTheDocument();
    expect(modal()).toBeNull();
    t.session.reportUnauthenticated("session_ended");
    t.session.reportUnauthenticated("unauthenticated");
    t.session.reportUnauthenticated("session_ended");
    await t.settle();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(modal()).toHaveTextContent("Your session has ended");
    expect(app()).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign in again" }),
    ).toBeInTheDocument();
  });

  test("the session is not read again when the state is already known", async () => {
    const t = await loadApp();
    t.session.markSignedIn(user);
    await t.mount();
    expect(t.calls.readSession).not.toHaveBeenCalled();
  });

  test("'Sign in again' opens /login with the address showing and the last email filled in", async () => {
    const t = await loadApp({ path: "/nope?x=1#h" });
    t.session.markSignedIn(user);
    await t.mount();
    await t.settle();
    // /nope is the not-found view, shown inside the guard for a signed-in person.
    expect(t.router.state.location.pathname).toBe("/nope");
    t.session.reportUnauthenticated("session_ended");
    await t.settle();
    await userEvent.click(
      screen.getByRole("button", { name: "Sign in again" }),
    );
    await t.settle();
    expect(t.router.state.location.pathname).toBe("/login");
    expect(t.router.state.location.search).toEqual({ next: "/nope?x=1#h" });
    expect(t.session.getSessionState()).toEqual({ status: "signedOut" });
    expect(modal()).toBeNull();
    const field = (await screen.findByLabelText("Email")) as HTMLInputElement;
    expect(field.value).toBe(user.email);
    expect(window.location.href).not.toContain(user.email);
  });

  test("deactivated while the app shows: the modal has no button and no link, the app stays", async () => {
    const t = await loadApp();
    t.session.markSignedIn(user);
    await t.mount();
    t.session.reportUnauthenticated("account_deactivated");
    await t.settle();
    expect(modal()).toHaveTextContent("This account has been deactivated");
    expect(within(modal()!).queryAllByRole("button")).toHaveLength(0);
    expect(app()).toBeInTheDocument();
  });
});

describe("a route with the flag public (R40, R44)", () => {
  test("unknown: background only; a 401 of any code is no session and shows the page, no modal", async () => {
    const read = deferred<SessionReadOutcome>();
    const t = await loadApp({
      path: "/join",
      extraRoutes: true,
      calls: { readSession: () => read.promise },
    });
    await t.mount();
    expect(screen.queryByTestId("join-page")).toBeNull();
    read.resolve({ kind: "unauthenticated", code: "account_deactivated" });
    await t.settle();
    expect(t.session.getSessionState()).toEqual({ status: "signedOut" });
    expect(await screen.findByTestId("join-page")).toBeInTheDocument();
    expect(modal()).toBeNull();
    expect(t.router.state.location.pathname).toBe("/join");
    expect(t.router.state.location.search).toEqual({});
  });

  test("a signed-in person is let through with no next", async () => {
    const t = await loadApp({ path: "/join", extraRoutes: true });
    t.session.markSignedIn(user);
    await t.mount();
    expect(await screen.findByTestId("join-page")).toBeInTheDocument();
    expect(t.router.state.location.pathname).toBe("/join");
  });

  test("a signed-out person is let through with no next", async () => {
    const t = await loadApp({ path: "/join", extraRoutes: true });
    t.session.markSignedOut();
    await t.mount();
    expect(await screen.findByTestId("join-page")).toBeInTheDocument();
    expect(t.router.state.location.pathname).toBe("/join");
    expect(t.router.state.location.search).toEqual({});
  });
});
