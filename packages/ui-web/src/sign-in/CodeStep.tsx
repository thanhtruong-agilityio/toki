import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@toki/i18n/react";
import { Button } from "../components/Button/Button";
import { CodeField } from "./CodeField";
import { SignInCard } from "./SignInCard";
import { useSignInTime } from "./SignInTimeProvider";
import {
  minutesLeft,
  nextMinuteChange,
  prefersReducedMotion,
  useNow,
} from "./useNow";
import "./sign-in.css";

// What `send(digits)` resolves to (R41).
export type SendOutcome =
  | { kind: "ok" }
  | { kind: "incorrect"; triesLeft: number }
  | { kind: "locked" }
  | { kind: "expired" }
  | { kind: "deactivated" }
  | { kind: "failed" }
  | { kind: "network" }
  | { kind: "left" };

// What `resend()` resolves to (R41).
export type ResendOutcome =
  | { kind: "ok"; resendAfterSeconds: number; expiresInSeconds: number }
  | { kind: "limit"; retryAfterSeconds: number }
  | { kind: "tooSoon"; retryAfterSeconds: number }
  | { kind: "failed" }
  | { kind: "network" }
  | { kind: "left" };

export type CodeStepProps = {
  /** Shown, not edited. */
  address: string;
  workspaceName?: string;
  /** The length of the code: the shared constant, passed in by the page. */
  codeLength: number;
  send: (digits: string) => Promise<SendOutcome>;
  resend: () => Promise<ResendOutcome>;
  /** The first wait of Resend code (R12). */
  resendAfterSeconds: number;
  /** The first life of the code; 0 opens the step expired (R18). */
  expiresInSeconds: number;
  onUseDifferentEmail: () => void;
};

type Message =
  | { kind: "wrong"; triesLeft: number }
  | { kind: "locked" }
  | { kind: "expired" }
  | { kind: "deactivated" }
  | { kind: "network" }
  | { kind: "failed" }
  | { kind: "limit"; until: number }
  | { kind: "tooSoon"; seconds: number; until: number };

// The step keeps no storage and no requestId: the page passes both in the
// actions (R41). Every time it needs is read from the clock and every wake-up
// is set through the timers of SignInTimeProvider (R45).
export function CodeStep(props: CodeStepProps) {
  const {
    address,
    workspaceName,
    codeLength,
    send,
    resend,
    resendAfterSeconds,
    expiresInSeconds,
    onUseDifferentEmail,
  } = props;
  const { t } = useTranslation();
  const { clock } = useSignInTime();

  const [start] = useState(() => clock.now());
  const [digits, setDigits] = useState("");
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendReadyAt, setResendReadyAt] = useState(
    start + resendAfterSeconds * 1000,
  );
  const [expiresAt, setExpiresAt] = useState(start + expiresInSeconds * 1000);
  const [serverExpired, setServerExpired] = useState(false);
  // `at` is the instant of the answer: an expiry that comes after it replaces it.
  const [message, setMessage] = useState<(Message & { at: number }) | null>(
    null,
  );
  const [shake, setShake] = useState(false);
  const fieldRef = useRef<HTMLInputElement>(null);
  const sending = useRef(false);
  const resendRunning = useRef(false);

  useEffect(() => {
    fieldRef.current?.focus();
  }, []);

  const limited =
    message !== null && (message.kind === "limit" || message.kind === "tooSoon")
      ? message
      : null;
  const now = useNow([
    resendReadyAt,
    expiresAt,
    limited ? limited.until : null,
    limited && limited.kind === "limit"
      ? nextMinuteChange(limited.until, clock.now())
      : null,
  ]);

  const timeExpired = now >= expiresAt;
  const expired = serverExpired || timeExpired;
  let live: Message | null = message;
  if (message !== null) {
    if (
      (message.kind === "limit" || message.kind === "tooSoon") &&
      now >= message.until
    )
      live = null;
    else if (timeExpired && message.at < expiresAt) live = null;
  }
  const shown: Message | null = live ?? (expired ? { kind: "expired" } : null);

  const text = (m: Message): string => {
    switch (m.kind) {
      case "wrong":
        return t("signIn.error.wrongCode", { count: m.triesLeft });
      case "locked":
        return t("signIn.error.locked");
      case "expired":
        return t("signIn.error.expired");
      case "deactivated":
        return t("signIn.error.deactivated");
      case "network":
        return t("signIn.error.network");
      case "failed":
        return t("signIn.error.general");
      case "limit":
        return t("signIn.error.tooMany", {
          count: minutesLeft(m.until, now),
        });
      case "tooSoon":
        return t("signIn.error.resendTooSoon", { count: m.seconds });
    }
  };

  const show = (m: Message) => setMessage({ ...m, at: clock.now() });
  const emptyField = () => {
    setDigits("");
    fieldRef.current?.focus();
  };

  // The one send action (R36): the 6th digit, Enter and the button use it.
  const sendCode = async (code: string) => {
    if (sending.current || code.length !== codeLength) return;
    sending.current = true;
    setChecking(true);
    let outcome: SendOutcome;
    try {
      outcome = await send(code);
    } catch {
      outcome = { kind: "failed" };
    }
    switch (outcome.kind) {
      case "ok":
        // The page takes the person on; the step stays busy until it does.
        return;
      case "left":
        break;
      case "incorrect":
        show({ kind: "wrong", triesLeft: outcome.triesLeft });
        setShake(!prefersReducedMotion());
        emptyField();
        break;
      case "locked":
        show({ kind: "locked" });
        emptyField();
        break;
      case "expired":
        setServerExpired(true);
        setMessage(null);
        emptyField();
        break;
      case "deactivated":
        show({ kind: "deactivated" });
        emptyField();
        break;
      case "failed":
        show({ kind: "failed" });
        break;
      case "network":
        show({ kind: "network" });
        break;
    }
    sending.current = false;
    setChecking(false);
  };

  const askResend = async () => {
    if (resendRunning.current || sending.current) return;
    resendRunning.current = true;
    setResending(true);
    let outcome: ResendOutcome;
    try {
      outcome = await resend();
    } catch {
      outcome = { kind: "failed" };
    }
    const answered = clock.now();
    switch (outcome.kind) {
      case "ok":
        setServerExpired(false);
        setMessage(null);
        setShake(false);
        setResendReadyAt(answered + outcome.resendAfterSeconds * 1000);
        setExpiresAt(answered + outcome.expiresInSeconds * 1000);
        emptyField();
        break;
      case "limit": {
        const until = answered + outcome.retryAfterSeconds * 1000;
        show({ kind: "limit", until });
        setResendReadyAt((ready) => Math.max(ready, until));
        break;
      }
      case "tooSoon": {
        const until = answered + outcome.retryAfterSeconds * 1000;
        show({
          kind: "tooSoon",
          seconds: outcome.retryAfterSeconds,
          until,
        });
        setResendReadyAt((ready) => Math.max(ready, until));
        break;
      }
      case "failed":
        show({ kind: "failed" });
        break;
      case "network":
        show({ kind: "network" });
        break;
      case "left":
        break;
    }
    resendRunning.current = false;
    setResending(false);
  };

  const onChange = (next: string) => {
    setDigits(next);
    setShake(false);
  };

  const resendDisabled = checking || resending || now < resendReadyAt;
  const signInDisabled = checking || digits.length < codeLength;

  return (
    <SignInCard workspaceName={workspaceName}>
      <h1>{t("signIn.code.title")}</h1>
      <p className="gaddr">{address}</p>
      <p className="gnote">{t("signIn.code.validity")}</p>
      <CodeField
        ref={fieldRef}
        codeLength={codeLength}
        value={digits}
        onChange={onChange}
        onComplete={(complete) => void sendCode(complete)}
        onEnter={() => void sendCode(digits)}
        readOnly={checking}
        shake={shake}
        error={shown ? text(shown) : undefined}
      />
      {expired ? (
        <Button
          size="sm"
          disabled={resendDisabled}
          onClick={() => void askResend()}
        >
          {t("signIn.code.sendNew")}
        </Button>
      ) : null}
      <Button
        variant="primary"
        fullWidth
        disabled={signInDisabled}
        onClick={() => void sendCode(digits)}
      >
        {t("signIn.code.submit")}
      </Button>
      {expired ? null : (
        <Button
          variant="ghost"
          fullWidth
          disabled={resendDisabled}
          onClick={() => void askResend()}
        >
          {t("signIn.code.resend")}
        </Button>
      )}
      <div className="glinks">
        <Button
          variant="link"
          disabled={checking}
          onClick={onUseDifferentEmail}
        >
          {t("signIn.code.changeEmail")}
        </Button>
      </div>
    </SignInCard>
  );
}
