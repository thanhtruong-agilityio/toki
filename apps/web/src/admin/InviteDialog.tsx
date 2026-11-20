import { useTranslation } from "@toki/i18n/react";
import {
  INVITATION_BATCH_MAX,
  parseAddressList,
  parseEmail,
  type InviteResult,
  type MemberRole,
} from "@toki/shared";
import { Button, Field, Modal, Select, useToasts } from "@toki/ui-web";
import { ApiError } from "@toki/client-core";
import { useId, useRef, useState, type RefObject } from "react";
import { hasFormContent, useFormGuard, useOnlineGate } from "../patterns";
import { useForbidden } from "./AdminForbiddenContext";
import { actionOutcome, failedMessage } from "./actionOutcome";
import { inviteMembers, resendInvitation } from "./adminApi";
import type { KeyPerId } from "./useKeyPerId";

// The id of the invite form in the key map: the form has one key in doubt at a time (R22).
const INVITE_KEY = "invite";

type Props = {
  open: boolean;
  onClose: () => void;
  // Asks the members list again; called as soon as the 200 arrives, not when Done is pressed (R23).
  reload: () => Promise<void>;
  keys: KeyPerId;
  returnFocusRef: RefObject<HTMLElement | null>;
};

type Problem = { message: string; errorId: string | null };
type LineResult = "invited" | "mail_not_sent";

// The Invite members dialog (TOKI-025 R21 to R24): the form, one result for each address, and Resend
// inside the results. The form goes through `useFormGuard`, so an outside press does nothing and the
// close button and Cancel ask before text is thrown away (D-070).
export function InviteDialog({
  open,
  onClose,
  reload,
  keys,
  returnFocusRef,
}: Props) {
  const { t } = useTranslation();
  const { show } = useToasts();
  const { ensureOnline } = useOnlineGate();
  const forbidden = useForbidden();
  const hintId = useId();
  const errorIdId = useId();
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  const [text, setText] = useState("");
  const [role, setRole] = useState<MemberRole>("member");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [results, setResults] = useState<InviteResult[] | null>(null);
  // The result of a line after its Resend, by invitation id.
  const [lines, setLines] = useState<Record<string, LineResult>>({});
  const resendingRef = useRef(new Set<string>());
  const [resending, setResending] = useState<ReadonlySet<string>>(new Set());

  // The text is split with the shared function and each piece is checked with the shared address
  // check, the same one that the server uses. The first piece that fails is named.
  const addresses = parseAddressList(text);
  const invalid = addresses.find((address) => parseEmail(address) === null);
  const tooMany = addresses.length > INVITATION_BATCH_MAX;
  const valid = addresses.length > 0 && invalid === undefined && !tooMany;

  const fieldError =
    invalid !== undefined
      ? t("admin.invite.error.invalid", { address: invalid })
      : tooMany
        ? t("admin.invite.error.tooMany", { count: INVITATION_BATCH_MAX })
        : (problem?.message ?? undefined);

  const finish = () => {
    setText("");
    setRole("member");
    setProblem(null);
    setResults(null);
    setLines({});
    keys.drop(INVITE_KEY);
    onClose();
  };

  const guard = useFormGuard({
    // The result step has nothing left to lose; a role alone is not content (TOKI-093 R19).
    hasContent: results === null && hasFormContent({ emails: text }),
    formName: t("admin.invite.title"),
    onClose: finish,
  });

  // While a request runs the dialog closes on no reason.
  const onRequestClose = (
    reason: Parameters<typeof guard.onRequestClose>[0],
  ) => {
    if (busy) return;
    guard.onRequestClose(reason);
  };

  const edit = (change: () => void) => {
    change();
    // A change of the text or the role makes the next press a new request (R22).
    keys.drop(INVITE_KEY);
    setProblem(null);
  };

  const send = async () => {
    if (!valid || busyRef.current) return;
    if (!ensureOnline()) return;
    busyRef.current = true;
    setBusy(true);
    setProblem(null);
    try {
      const answer = await inviteMembers(
        { emails: addresses, role },
        keys.keyFor(INVITE_KEY),
      );
      keys.succeeded(INVITE_KEY);
      setResults(answer.results);
      void reload();
    } catch (error) {
      keys.failed(INVITE_KEY, error);
      switch (actionOutcome(error)) {
        case "aborted":
        case "session":
          break;
        case "forbidden":
          forbidden();
          break;
        case "inProgress":
          setProblem({ message: t("admin.error.inProgress"), errorId: null });
          break;
        default:
          if (
            error instanceof ApiError &&
            error.status === 400 &&
            error.code === "batch_too_large"
          ) {
            setProblem({
              message: t("admin.invite.error.tooMany", {
                count: INVITATION_BATCH_MAX,
              }),
              errorId: null,
            });
          } else {
            const { message, errorId } = failedMessage(t, error, {
              withId: "separate",
            });
            setProblem({ message, errorId });
          }
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  // Resend inside the results, with the key rule of R20 keyed by the invitation id.
  const resend = async (invitationId: string) => {
    if (resendingRef.current.has(invitationId)) return;
    if (!ensureOnline()) return;
    resendingRef.current.add(invitationId);
    setResending(new Set(resendingRef.current));
    try {
      const answer = await resendInvitation(
        invitationId,
        keys.keyFor(invitationId),
      );
      keys.succeeded(invitationId);
      setLines((current) => ({ ...current, [invitationId]: answer.result }));
      void reload();
    } catch (error) {
      keys.failed(invitationId, error);
      switch (actionOutcome(error)) {
        case "aborted":
        case "session":
          break;
        case "forbidden":
          forbidden();
          break;
        case "stale":
          // The invitation has gone or was used: the page was out of date (R19).
          void reload();
          show({ text: t("admin.error.stale") });
          break;
        case "inProgress":
          show({ text: t("admin.error.inProgress") });
          break;
        default:
          show({ text: failedMessage(t, error, { withId: "text" }).message });
      }
    } finally {
      resendingRef.current.delete(invitationId);
      setResending(new Set(resendingRef.current));
    }
  };

  const resultText = (result: InviteResult["result"]) => {
    switch (result) {
      case "invited":
        return t("admin.status.invited");
      case "mail_not_sent":
        return t("admin.row.mailNotSent");
      case "already_member":
        return t("admin.invite.result.alreadyMember");
      case "already_invited":
        return t("admin.invite.result.alreadyInvited");
      case "invalid_email":
        return t("admin.invite.result.invalid");
    }
  };

  const footer =
    results === null ? (
      <>
        <Button disabled={busy} onClick={guard.requestClose}>
          {t("common.cancel")}
        </Button>
        <Button
          variant="primary"
          disabled={!valid || busy}
          onClick={() => void send()}
        >
          {t("admin.invite.send")}
        </Button>
      </>
    ) : (
      <Button variant="primary" onClick={finish}>
        {t("admin.invite.done")}
      </Button>
    );

  return (
    <>
      <Modal
        open={open}
        title={t("admin.invite.title")}
        closeLabel={t("common.close")}
        onRequestClose={onRequestClose}
        returnFocusRef={returnFocusRef}
        initialFocusRef={fieldRef}
        footer={footer}
      >
        {results === null ? (
          <div onFocusCapture={guard.trackFocus}>
            <Field
              ref={fieldRef}
              label={t("admin.invite.emails.label")}
              multiline
              rows={4}
              value={text}
              error={fieldError}
              aria-describedby={`${hintId} ${errorIdId}`}
              onChange={(event) => edit(() => setText(event.target.value))}
            />
            <p id={hintId} className="adm-hint">
              {t("admin.invite.emails.hint")}
            </p>
            <p id={errorIdId} className="adm-hint">
              {problem?.errorId}
            </p>
            <Select
              label={t("admin.invite.role.label")}
              fullWidth
              value={role}
              options={[
                { value: "member", label: t("common.role.member") },
                { value: "admin", label: t("common.role.admin") },
              ]}
              onChange={(event) =>
                edit(() => setRole(event.target.value as MemberRole))
              }
            />
          </div>
        ) : (
          <ul
            aria-label={t("admin.invite.results.label")}
            className="adm-results"
          >
            {results.map((entry) => {
              const id = entry.invitation?.id;
              const result: InviteResult["result"] =
                id !== undefined && lines[id] !== undefined
                  ? (lines[id] as LineResult)
                  : entry.result;
              return (
                <li key={entry.email}>
                  <span>{entry.email}</span> <span>{resultText(result)}</span>
                  {result === "mail_not_sent" && id !== undefined ? (
                    <>
                      {" "}
                      <Button
                        size="sm"
                        disabled={resending.has(id)}
                        onClick={() => void resend(id)}
                      >
                        {t("admin.action.resend")}
                      </Button>
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Modal>
      {guard.discardDialog}
    </>
  );
}
