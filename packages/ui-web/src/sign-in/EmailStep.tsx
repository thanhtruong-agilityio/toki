import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@toki/i18n/react";
import { Button } from "../components/Button/Button";
import { Field } from "../components/Field/Field";
import { SignInCard } from "./SignInCard";
import { useSignInTime } from "./SignInTimeProvider";
import { minutesLeft, nextMinuteChange, useNow } from "./useNow";
import "./sign-in.css";

// What `send(address)` resolves to. `ok` and `left` mean the page has taken the
// person on; the step shows nothing more.
export type EmailOutcome =
  | { kind: "ok" }
  | { kind: "invalid" }
  | { kind: "limit"; retryAfterSeconds: number }
  | { kind: "tooSoon"; retryAfterSeconds: number }
  | { kind: "failed" }
  | { kind: "network" }
  | { kind: "left" };

export type EmailStepProps = {
  workspaceName?: string;
  /** An address to fill in and select: the earlier one (R14) or the one the page was given (R25). */
  initialAddress?: string;
  /** The rule of the server (`parseEmail`), passed in by the page. */
  isValidEmail: (address: string) => boolean;
  send: (address: string) => Promise<EmailOutcome>;
};

type Message =
  | { kind: "invalid" }
  | { kind: "network" }
  | { kind: "failed" }
  | { kind: "limit"; until: number }
  | { kind: "tooSoon"; seconds: number; until: number };

export function EmailStep(props: EmailStepProps) {
  const { workspaceName, initialAddress, isValidEmail, send } = props;
  const { t } = useTranslation();
  const { clock } = useSignInTime();
  const [address, setAddress] = useState(initialAddress ?? "");
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  const sending = useRef(false);

  useEffect(() => {
    const input = fieldRef.current;
    if (!input) return;
    input.focus();
    if (initialAddress) input.select();
  }, [initialAddress]);

  const waiting =
    message !== null && (message.kind === "limit" || message.kind === "tooSoon")
      ? message
      : null;
  const now = useNow([
    waiting ? waiting.until : null,
    waiting && waiting.kind === "limit"
      ? nextMinuteChange(waiting.until, clock.now())
      : null,
  ]);
  const waitOver = waiting !== null && now >= waiting.until;
  const shown = waitOver ? null : message;
  const blocked = waiting !== null && !waitOver;
  const disabled = !isValidEmail(address) || running || blocked;

  const text = (m: Message): string => {
    switch (m.kind) {
      case "invalid":
        return t("signIn.email.invalid");
      case "network":
        return t("signIn.error.network");
      case "failed":
        return t("signIn.error.general");
      case "limit":
        return t("signIn.error.tooMany", { count: minutesLeft(m.until, now) });
      case "tooSoon":
        return t("signIn.error.resendTooSoon", { count: m.seconds });
    }
  };

  const submit = async () => {
    if (sending.current || disabled) return;
    sending.current = true;
    setRunning(true);
    let outcome: EmailOutcome;
    try {
      outcome = await send(address);
    } catch {
      outcome = { kind: "failed" };
    }
    const answered = clock.now();
    switch (outcome.kind) {
      case "ok":
        // The page changes the step; this one stays busy until it does.
        return;
      case "left":
        break;
      case "invalid":
        setMessage({ kind: "invalid" });
        break;
      case "limit":
        setMessage({
          kind: "limit",
          until: answered + outcome.retryAfterSeconds * 1000,
        });
        break;
      case "tooSoon":
        setMessage({
          kind: "tooSoon",
          seconds: outcome.retryAfterSeconds,
          until: answered + outcome.retryAfterSeconds * 1000,
        });
        break;
      case "failed":
        setMessage({ kind: "failed" });
        break;
      case "network":
        setMessage({ kind: "network" });
        break;
    }
    sending.current = false;
    setRunning(false);
  };

  return (
    <SignInCard workspaceName={workspaceName}>
      <Field
        ref={fieldRef}
        label={t("signIn.email.label")}
        type="email"
        autoComplete="email"
        value={address}
        readOnly={running}
        error={shown ? text(shown) : undefined}
        onChange={(event) => {
          const next = event.target.value;
          setAddress(next);
          // The limit belongs to the address (R19); a malformed-address message
          // goes when the address is well-formed.
          setMessage((m) =>
            m === null
              ? m
              : m.kind === "limit" || m.kind === "tooSoon"
                ? null
                : m.kind === "invalid" && isValidEmail(next)
                  ? null
                  : m,
          );
        }}
        onBlur={() => {
          if (address !== "" && !isValidEmail(address))
            setMessage((m) => m ?? { kind: "invalid" });
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") void submit();
        }}
      />
      <Button
        variant="primary"
        fullWidth
        disabled={disabled}
        onClick={() => void submit()}
      >
        {t("signIn.email.submit")}
      </Button>
    </SignInCard>
  );
}
