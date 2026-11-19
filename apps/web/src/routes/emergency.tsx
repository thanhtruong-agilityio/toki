import { createRoute, useRouter } from "@tanstack/react-router";
import { markSignedIn } from "@toki/client-core";
import { useTranslation } from "@toki/i18n/react";
import { Button, SignInCard } from "@toki/ui-web";
import { useEffect, useRef, useState } from "react";
import { forgetToken, takeFragmentToken } from "../auth/emergency-token";
import { getAuthServices } from "../auth/services";
import { useSession } from "../useSession";
import { rootRoute } from "./__root";

// What the card shows. `ready`: the button (and, with a session, the question first). The others are
// the answers of R45.
type View =
  | { kind: "ready" }
  | { kind: "invalid" }
  | { kind: "deactivated" }
  | { kind: "failed" }
  | { kind: "rateLimited"; minutes: number };

// The page that turns the token of an emergency link into a session (TOKI-026 R40 to R47). It sends no
// request when it loads; one press sends one request (R42), because a program that opens the link and
// runs its scripts would use it up otherwise.
function EmergencyPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { emergency } = getAuthServices();
  const session = useSession();

  // The fragment is read and removed during the first render, before any request (R41).
  const token = takeFragmentToken(window);
  const [view, setView] = useState<View>(
    token === null ? { kind: "invalid" } : { kind: "ready" },
  );
  const running = useRef(false);

  // The router keeps its own copy of the address; it must not keep the fragment either (R41).
  useEffect(() => {
    if (router.state.location.hash !== "") {
      router.history.replace(
        window.location.pathname + window.location.search,
        window.history.state ?? undefined,
      );
    }
  }, [router]);

  useEffect(() => {
    document.title = `${t("emergency.title")} · Toki`;
  }, [t]);

  const send = async () => {
    const current = takeFragmentToken(window);
    if (running.current || current === null) return;
    running.current = true;
    const answer = await emergency.signInWithLink(current, "cookie");
    running.current = false;
    switch (answer.kind) {
      case "ok":
        forgetToken();
        markSignedIn(answer.user);
        await router.navigate({ to: "/", replace: true });
        return;
      case "invalid":
        forgetToken();
        setView({ kind: "invalid" });
        return;
      case "deactivated":
        forgetToken();
        setView({ kind: "deactivated" });
        return;
      case "rateLimited":
        // The link is not used up (R49): the token stays and the person can press again.
        setView({
          kind: "rateLimited",
          minutes: Math.max(1, Math.ceil(answer.retryAfterSeconds / 60)),
        });
        return;
      default:
        setView({ kind: "failed" });
    }
  };

  // A browser that already has a session asks first (D-080, R43): the card shows the question and its
  // two buttons in place of the one button, so one press of the confirmation is the one request.
  // After an answer the person can try again (`failed`, `rateLimited`), so the question comes back with
  // every retry: the confirmation given for the earlier attempt does not cover a new request.
  const retryable =
    view.kind === "ready" ||
    view.kind === "failed" ||
    view.kind === "rateLimited";
  const asking = session.status === "signedIn" && retryable;
  const refuse = () => {
    forgetToken();
    void router.navigate({ to: "/", replace: true });
  };

  const message =
    view.kind === "invalid"
      ? t("emergency.invalid")
      : view.kind === "deactivated"
        ? t("emergency.deactivated")
        : view.kind === "failed"
          ? t("emergency.failed")
          : view.kind === "rateLimited"
            ? t("emergency.rateLimited", { count: view.minutes })
            : null;
  const final = view.kind === "invalid" || view.kind === "deactivated";

  return (
    <SignInCard>
      <h1>{t("emergency.title")}</h1>
      {asking ? (
        <>
          <p>
            {t("emergency.switch.question", {
              current: session.user.displayName,
            })}
          </p>
          <div className="gmsg">
            <Button variant="primary" onClick={() => void send()}>
              {t("emergency.switch.confirm")}
            </Button>
            <Button onClick={refuse}>{t("emergency.switch.cancel")}</Button>
          </div>
        </>
      ) : (
        <>
          {message === null ? <p>{t("emergency.description")}</p> : null}
          {message !== null ? <p role="alert">{message}</p> : null}
          {!final ? (
            <Button variant="primary" fullWidth onClick={() => void send()}>
              {t("emergency.submit")}
            </Button>
          ) : null}
        </>
      )}
    </SignInCard>
  );
}

// `/emergency` is a child of the root, outside the layout and the sign-in guard: the flag `public`
// lets a browser with a session and one with none reach it, and a redirect to `/login` would drop the
// fragment (R40).
export const emergencyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/emergency",
  staticData: { public: true },
  component: EmergencyPage,
});
