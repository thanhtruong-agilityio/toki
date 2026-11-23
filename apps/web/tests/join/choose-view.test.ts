import { describe, expect, it } from "vitest";
import {
  chooseJoinView,
  type JoinLookupState,
} from "../../src/join/choose-view";

const pending = {
  state: "pending",
  email: "sam@example.com",
  workspaceName: "Acme",
  codeExpiresInSeconds: 600,
  resendAfterSeconds: 60,
} as const;
const done = (lookup: unknown): JoinLookupState =>
  ({ kind: "ok", lookup }) as JoinLookupState;
const out = { status: "signedOut" } as const;
const signedIn = (email: string) =>
  ({ status: "signedIn", user: { email } }) as const;

describe("what the Join page shows (R25, R34 to R37, R44, R46)", () => {
  it("shows the page background only while the session or the lookup is being read (R25)", () => {
    expect(
      chooseJoinView({ lookup: done(pending), session: { status: "unknown" } }),
    ).toEqual({ kind: "checking" });
    expect(
      chooseJoinView({ lookup: { kind: "loading" }, session: out }),
    ).toEqual({ kind: "checking" });
    expect(
      chooseJoinView({
        lookup: { kind: "loading" },
        session: { status: "unknown" },
      }),
    ).toEqual({ kind: "checking" });
  });

  it("a pending invitation shows the code step for a person with no session, and for one whose account was deactivated (R37)", () => {
    // a 401 on this page is `signedOut` (the flag public), so both are the same input
    expect(chooseJoinView({ lookup: done(pending), session: out })).toEqual({
      kind: "code",
      lookup: pending,
    });
  });

  it("a returning person sees the same view as a new one: the input has nothing that tells them apart (R38)", () => {
    expect(chooseJoinView({ lookup: done(pending), session: out })).toEqual(
      chooseJoinView({ lookup: done({ ...pending }), session: out }),
    );
  });

  it("asks the question when signed in as another address, and not for the same address (R36)", () => {
    expect(
      chooseJoinView({
        lookup: done(pending),
        session: signedIn("ann@example.com"),
      }),
    ).toEqual({
      kind: "question",
      current: "ann@example.com",
      invited: "sam@example.com",
      workspaceName: "Acme",
    });
    expect(
      chooseJoinView({
        lookup: done(pending),
        session: signedIn("sam@example.com"),
      }),
    ).toEqual({ kind: "code", lookup: pending });
    // the same address in another case is the same address
    expect(
      chooseJoinView({
        lookup: done(pending),
        session: signedIn("Sam@Example.com"),
      }),
    ).toEqual({ kind: "code", lookup: pending });
  });

  it("shows the code step after 'Sign out and continue' (R36)", () => {
    expect(
      chooseJoinView({
        lookup: done(pending),
        session: signedIn("ann@example.com"),
        confirmedSignOut: true,
      }),
    ).toEqual({ kind: "code", lookup: pending });
  });

  it("asks no question for any state but pending (R36)", () => {
    for (const lookup of [
      { state: "expired", workspaceName: "Acme" },
      { state: "revoked", workspaceName: "Acme" },
      { state: "used", email: "sam@example.com" },
      { state: "unknown" },
    ]) {
      expect(
        chooseJoinView({
          lookup: done(lookup),
          session: signedIn("ann@example.com"),
        }).kind,
      ).not.toBe("question");
    }
  });

  it("a used invitation goes to /login with the address, with or without a session (R34, R44)", () => {
    for (const session of [out, signedIn("ann@example.com")]) {
      expect(
        chooseJoinView({
          lookup: done({ state: "used", email: "sam@example.com" }),
          session,
        }),
      ).toEqual({ kind: "login", email: "sam@example.com" });
    }
  });

  it("the refusal pages: expired and revoked carry the workspace name, unknown carries none (R35)", () => {
    expect(
      chooseJoinView({
        lookup: done({ state: "expired", workspaceName: "Acme" }),
        session: out,
      }),
    ).toEqual({ kind: "refusal", reason: "expired", workspaceName: "Acme" });
    expect(
      chooseJoinView({
        lookup: done({ state: "revoked", workspaceName: "Acme" }),
        session: out,
      }),
    ).toEqual({ kind: "refusal", reason: "revoked", workspaceName: "Acme" });
    expect(
      chooseJoinView({ lookup: done({ state: "unknown" }), session: out }),
    ).toEqual({ kind: "refusal", reason: "unknown" });
    // a 400 of the lookup is the same page as unknown (R2)
    expect(
      chooseJoinView({ lookup: { kind: "invalid" }, session: out }),
    ).toEqual({ kind: "refusal", reason: "unknown" });
  });

  it("a lookup that failed or got no answer shows the card with a message (outcomes table)", () => {
    expect(
      chooseJoinView({ lookup: { kind: "failed" }, session: out }),
    ).toEqual({ kind: "failed", cause: "general" });
    expect(
      chooseJoinView({ lookup: { kind: "network" }, session: out }),
    ).toEqual({ kind: "failed", cause: "network" });
  });

  it("a session that ended counts as no session for the question (R36)", () => {
    expect(
      chooseJoinView({ lookup: done(pending), session: { status: "ended" } }),
    ).toEqual({ kind: "code", lookup: pending });
  });
});
