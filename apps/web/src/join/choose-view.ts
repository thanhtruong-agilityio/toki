import type {
  InvitationLookup,
  LookupOutcome,
  SessionState,
} from "@toki/client-core";

// What the Join page shows for what the lookup said and who is signed in (TOKI-097 R25, R34 to R37,
// R44, R46). Pure: the route holds the state and does what the view says.

export type JoinLookupState = { kind: "loading" } | LookupOutcome;

export type JoinView =
  /** The page background only (R25). */
  | { kind: "checking" }
  | {
      kind: "refusal";
      reason: "expired" | "revoked" | "unknown";
      workspaceName?: string;
    }
  /** Replace the page with `/login` and the address filled in (R34). */
  | { kind: "login"; email: string }
  | {
      kind: "question";
      current: string;
      invited: string;
      workspaceName: string;
    }
  | { kind: "code"; lookup: Extract<InvitationLookup, { state: "pending" }> }
  /** The lookup could not be made: the card with a message, the person reloads (concern 4). */
  | { kind: "failed"; cause: "general" | "network" };

const sameAddress = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

export function chooseJoinView(input: {
  lookup: JoinLookupState;
  session: Pick<SessionState, "status"> & { user?: { email: string } };
  /** 'Sign out and continue' was pressed: the code step shows (R36). */
  confirmedSignOut?: boolean;
}): JoinView {
  const { lookup, session } = input;
  if (session.status === "unknown" || lookup.kind === "loading") {
    return { kind: "checking" };
  }
  if (lookup.kind === "invalid") return { kind: "refusal", reason: "unknown" };
  if (lookup.kind === "failed") return { kind: "failed", cause: "general" };
  if (lookup.kind === "network") return { kind: "failed", cause: "network" };

  const found = lookup.lookup;
  switch (found.state) {
    case "used":
      return { kind: "login", email: found.email };
    case "expired":
    case "revoked":
      return {
        kind: "refusal",
        reason: found.state,
        workspaceName: found.workspaceName,
      };
    case "unknown":
      return { kind: "refusal", reason: "unknown" };
    case "pending": {
      // The question only for another person who is signed in, and only before they chose (R36).
      if (
        session.status === "signedIn" &&
        session.user &&
        !input.confirmedSignOut &&
        !sameAddress(session.user.email, found.email)
      ) {
        return {
          kind: "question",
          current: session.user.email,
          invited: found.email,
          workspaceName: found.workspaceName,
        };
      }
      return { kind: "code", lookup: found };
    }
  }
}
