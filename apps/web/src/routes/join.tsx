import { createRoute, useRouter } from "@tanstack/react-router";
import {
  getSessionState,
  markSignedIn,
  type ClosedState,
  type InvitationLookup,
} from "@toki/client-core";
import { useTranslation } from "@toki/i18n/react";
import { CODE_LENGTH } from "@toki/shared";
import {
  CodeStep,
  InvitationRefusal,
  SignInCard,
  SignedInQuestion,
  type ResendOutcome,
  type SendOutcome,
} from "@toki/ui-web";
import { useEffect, useRef, useState } from "react";
import { getAuthServices } from "../auth/services";
import { chooseJoinView, type JoinLookupState } from "../join/choose-view";
import { getJoinToken } from "../join/join-token";
import { useSession } from "../useSession";
import { rootRoute } from "./__root";

type Pending = Extract<InvitationLookup, { state: "pending" }>;

// What the lookup would have said, for a press that found the link in another state (R30, R31).
function closedLookup(state: ClosedState, from: Pending): JoinLookupState {
  switch (state) {
    case "used":
      return { kind: "ok", lookup: { state: "used", email: from.email } };
    case "expired":
    case "revoked":
      return {
        kind: "ok",
        lookup: { state, workspaceName: from.workspaceName },
      };
    case "unknown":
      return { kind: "ok", lookup: { state: "unknown" } };
  }
}

// The code step for a usable invitation (R27, R29 to R33, R49). The token is an argument of the calls
// and is kept nowhere else.
function JoinCodeStep(props: {
  token: string;
  lookup: Pending;
  signedIn: boolean;
  onClosed: (state: ClosedState) => void;
}) {
  const { token, lookup, signedIn, onClosed } = props;
  const router = useRouter();
  const { invitation, resetConversations } = getAuthServices();

  const send = async (digits: string): Promise<SendOutcome> => {
    const answer = await invitation.acceptInvitation(token, digits);
    switch (answer.kind) {
      case "ok": {
        // The state before `markSignedIn` changes it: a person who was signed in has their data
        // cleared first, and only then does the app open, because `/join` is outside the app layout
        // and the layout that opens next cannot see that the person changed (R33).
        if (getSessionState().status === "signedIn") resetConversations();
        markSignedIn(answer.user);
        // Replaces the Join entry, so Back does not return to it (R32).
        router.history.replace(
          `/c/${encodeURIComponent(answer.generalConversationId)}`,
        );
        return { kind: "ok" };
      }
      case "closed":
        onClosed(answer.state);
        return { kind: "left" };
      default:
        // incorrect, locked, expired, failed and network are outcomes of the step as they are (R49).
        return answer;
    }
  };

  const resend = async (): Promise<ResendOutcome> => {
    const answer = await invitation.resendInvitationCode(token);
    if (answer.kind === "closed") {
      onClosed(answer.state);
      return { kind: "left" };
    }
    return answer;
  };

  return (
    <CodeStep
      workspaceName={lookup.workspaceName}
      address={lookup.email}
      codeLength={CODE_LENGTH}
      send={send}
      resend={resend}
      resendAfterSeconds={lookup.resendAfterSeconds}
      expiresInSeconds={lookup.codeExpiresInSeconds}
      // Nothing is sent; a signed-in person goes to the app and stays signed in (R46).
      onUseDifferentEmail={() =>
        void router.navigate({ to: signedIn ? "/" : "/login", replace: true })
      }
    />
  );
}

// The page of a Join link (TOKI-097). It makes the lookup once and nothing else on opening (R28); the
// code is sent only by the 6th digit (R31).
function JoinPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { invitation } = getAuthServices();
  const session = useSession();
  // Taken from the address before the router started (R26); null for no fragment or a wrong shape: the
  // unrecognised page, with no request.
  const token = getJoinToken();
  const [lookup, setLookup] = useState<JoinLookupState>(
    token === null
      ? { kind: "ok", lookup: { state: "unknown" } }
      : { kind: "loading" },
  );
  const [confirmedSignOut, setConfirmedSignOut] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    document.title = t("signIn.pageTitle");
  }, [t]);

  // The router keeps its own copy of the address; it must not keep the fragment either (R43).
  useEffect(() => {
    if (router.state.location.hash !== "") {
      router.history.replace(
        window.location.pathname + window.location.search,
        window.history.state ?? undefined,
      );
    }
  }, [router]);

  useEffect(() => {
    if (token === null || started.current) return;
    started.current = true;
    void invitation.lookupInvitation(token).then(setLookup);
  }, [token, invitation]);

  const view = chooseJoinView({ lookup, session, confirmedSignOut });

  // A used invitation leads to the normal sign-in, with the address in the navigation state and never
  // in the address (R34). A person with a session then sees the app (TOKI-023 R2).
  // Depends on the address, not on `view`: that object is made again on every render.
  const loginEmail = view.kind === "login" ? view.email : null;
  useEffect(() => {
    if (loginEmail !== null) {
      void router.navigate({
        to: "/login",
        replace: true,
        state: { email: loginEmail },
      });
    }
  }, [loginEmail, router]);

  switch (view.kind) {
    case "checking":
    case "login":
      return null; // the page background only (R25)
    case "refusal":
      return (
        <InvitationRefusal
          reason={view.reason}
          workspaceName={view.workspaceName}
        />
      );
    case "failed":
      return (
        <SignInCard>
          <p role="alert">
            {t(
              view.cause === "network"
                ? "signIn.error.network"
                : "signIn.error.general",
            )}
          </p>
        </SignInCard>
      );
    case "question":
      return (
        <SignedInQuestion
          current={view.current}
          invited={view.invited}
          workspaceName={view.workspaceName}
          onSignOut={() => setConfirmedSignOut(true)}
          onStay={() => void router.navigate({ to: "/", replace: true })}
        />
      );
    case "code":
      return (
        <JoinCodeStep
          token={token!}
          lookup={view.lookup}
          signedIn={session.status === "signedIn"}
          onClosed={(state) => setLookup(closedLookup(state, view.lookup))}
        />
      );
  }
}

// `/join` is a child of the root, outside the `_app` layout and the sign-in guard: the flag `public`
// lets every session state reach it with no `next` (R25), and a 401 on its session read is no session
// with no modal (R37).
export const joinRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/join",
  staticData: { public: true },
  component: JoinPage,
});
