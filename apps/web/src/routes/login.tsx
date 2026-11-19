import { createRoute, useRouterState } from "@tanstack/react-router";
import { markSignedIn } from "@toki/client-core";
import { useTranslation } from "@toki/i18n/react";
import { getPlatform } from "@toki/platform";
import {
  CodeStep,
  EmailStep,
  type EmailOutcome,
  type ResendOutcome,
  type SendOutcome,
} from "@toki/ui-web";
import { useEffect, useRef, useState } from "react";
import {
  readCodeRecord,
  removeCodeRecord,
  writeCodeRecord,
  type CodeRecord,
} from "../auth/code-record";
import { getAuthServices } from "../auth/services";
import { CODE_LENGTH, isValidEmail } from "../auth/stand-ins";
import { rootRoute } from "./__root";

// What the code step opens with: the record, and the waits that are left of it.
type CodeStepState = {
  address: string;
  resendAfterSeconds: number;
  expiresInSeconds: number;
};
type Step =
  { kind: "email"; address?: string } | ({ kind: "code" } & CodeStepState);

function LoginPage() {
  const { t } = useTranslation();
  const { calls, clock, timers } = getAuthServices();
  const tab = getPlatform().storage.tab;
  const given = useRouterState({ select: (s) => s.location.state.email });

  // The requestId lives here, in a ref and in tab storage; CodeStep keeps none (R41).
  const requestId = useRef<string | null>(null);
  const [step, setStep] = useState<Step>(() => {
    const record = readCodeRecord(tab);
    if (record) {
      // The time since the answer, by the same clock that wrote it.
      const elapsed = Math.max(0, clock.now() - record.answeredAt) / 1000;
      if (elapsed < record.expiresInSeconds) {
        requestId.current = record.requestId;
        return {
          kind: "code",
          address: record.address,
          resendAfterSeconds: Math.max(0, record.resendAfterSeconds - elapsed),
          expiresInSeconds: record.expiresInSeconds - elapsed,
        };
      }
      removeCodeRecord(tab);
    }
    return { kind: "email" };
  });
  const [workspaceName, setWorkspaceName] = useState<string | undefined>();

  useEffect(() => {
    document.title = t("signIn.pageTitle");
  }, [t]);

  useEffect(() => {
    let live = true;
    void calls.readWorkspaceName().then((name) => {
      if (live && name !== null) setWorkspaceName(name);
    });
    return () => {
      live = false;
    };
  }, [calls]);

  // The record goes when the code has expired; a step that is showing then stays, expired (R18).
  // An accepted resend starts the life of the new code again: its answer's `expiresInSeconds` replaces the
  // remaining life of the code the step was opened with, and the timer restarts.
  const [resent, setResent] = useState<{ expiresInSeconds: number } | null>(
    null,
  );
  const expiresIn =
    step.kind === "code"
      ? (resent?.expiresInSeconds ?? step.expiresInSeconds)
      : null;
  useEffect(() => {
    if (expiresIn === null) return;
    return timers.after(expiresIn * 1000, () => removeCodeRecord(tab));
  }, [expiresIn, resent, timers, tab]);

  const keep = (
    address: string,
    answer: Extract<
      Awaited<ReturnType<typeof calls.requestCode>>,
      { kind: "ok" }
    >,
  ): CodeStepState => {
    requestId.current = answer.requestId;
    const record: CodeRecord = {
      address,
      requestId: answer.requestId,
      answeredAt: clock.now(),
      resendAfterSeconds: answer.resendAfterSeconds,
      expiresInSeconds: answer.expiresInSeconds,
    };
    writeCodeRecord(tab, record);
    return {
      address,
      resendAfterSeconds: answer.resendAfterSeconds,
      expiresInSeconds: answer.expiresInSeconds,
    };
  };

  if (step.kind === "email") {
    const sendEmail = async (address: string): Promise<EmailOutcome> => {
      const answer = await calls.requestCode(address);
      if (answer.kind === "ok") {
        setResent(null);
        setStep({ kind: "code", ...keep(address, answer) });
        return { kind: "ok" };
      }
      return answer;
    };
    const initialAddress = step.address ?? given;
    return (
      <EmailStep
        key={initialAddress ?? ""}
        workspaceName={workspaceName}
        initialAddress={initialAddress}
        isValidEmail={isValidEmail}
        send={sendEmail}
      />
    );
  }

  const address = step.address;
  const send = async (digits: string): Promise<SendOutcome> => {
    const id = requestId.current;
    if (id === null) return { kind: "expired" };
    const answer = await calls.submitCode({ requestId: id, code: digits });
    // A resend answered while this ran replaced the code: this answer is about the old one.
    if (requestId.current !== id) return { kind: "left" };
    if (answer.kind === "ok") {
      removeCodeRecord(tab);
      requestId.current = null;
      // The guard takes the person off /login, to `next` or `/` (R3, R11).
      markSignedIn(answer.user);
      return { kind: "ok" };
    }
    if (answer.kind === "expired") removeCodeRecord(tab);
    return answer;
  };
  const resend = async (): Promise<ResendOutcome> => {
    const answer = await calls.requestCode(address);
    if (answer.kind === "ok") {
      keep(address, answer);
      setResent({ expiresInSeconds: answer.expiresInSeconds });
      return {
        kind: "ok",
        resendAfterSeconds: answer.resendAfterSeconds,
        expiresInSeconds: answer.expiresInSeconds,
      };
    }
    return answer.kind === "invalid" ? { kind: "failed" } : answer;
  };
  return (
    <CodeStep
      workspaceName={workspaceName}
      address={address}
      codeLength={CODE_LENGTH}
      send={send}
      resend={resend}
      resendAfterSeconds={step.resendAfterSeconds}
      expiresInSeconds={step.expiresInSeconds}
      onUseDifferentEmail={() => {
        removeCodeRecord(tab);
        requestId.current = null;
        setStep({ kind: "email", address });
      }}
    />
  );
}

// `/login` is a child of the root, outside the `_app` layout. `next` is read by the guard, which
// applies the rule of R3, and is not read here.
export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: (search: Record<string, unknown>): { next?: string } =>
    typeof search.next === "string" ? { next: search.next } : {},
  component: LoginPage,
});
