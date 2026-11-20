import { ApiError } from "@toki/client-core";
import { useTranslation } from "@toki/i18n/react";
import type { MemberRole } from "@toki/shared";
import { useToasts } from "@toki/ui-web";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { ConfirmAction, useOnlineGate } from "../patterns";
import { useForbidden } from "./AdminForbiddenContext";
import { actionOutcome } from "./actionOutcome";
import {
  changeRole,
  deactivateMember,
  reactivateMember,
  resendInvitation,
  revokeInvitation,
  type MemberRowView,
} from "./adminApi";
import { useKeyPerId } from "./useKeyPerId";

type Pending =
  | { action: "changeRole"; row: MemberRowView; role: MemberRole }
  | { action: "deactivateMember"; row: MemberRowView }
  | { action: "reactivateMember"; row: MemberRowView }
  | { action: "revokeInvitation"; row: MemberRowView };

type Opener = HTMLElement | null;

export type AdminActions = {
  openChangeRole(row: MemberRowView, role: MemberRole, opener: Opener): void;
  openDeactivate(row: MemberRowView, opener: Opener): void;
  openReactivate(row: MemberRowView, opener: Opener): void;
  openRevoke(row: MemberRowView, opener: Opener): void;
  resend(row: MemberRowView): void;
  isResending(invitationId: string): boolean;
  // The one confirmation of the page: render it once.
  dialogs: ReactNode;
};

// The four confirmations and Resend of the members table (TOKI-025 R18, R19, R20). It holds the
// open confirmation, the keys of the Resend buttons and nothing of the rows: `reload` brings the new
// state. Every outcome of a request is decided by `actionOutcome`.
export function useAdminAction({
  reload,
  headingRef,
}: {
  reload: () => Promise<void>;
  headingRef: RefObject<HTMLElement | null>;
}): AdminActions {
  const { t } = useTranslation();
  const { show } = useToasts();
  // Only Resend calls the gate: a confirmation goes through `ConfirmAction`, which calls it itself.
  const { ensureOnline } = useOnlineGate();
  const forbidden = useForbidden();
  const keys = useKeyPerId();

  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const resendingRef = useRef(new Set<string>());
  const [resending, setResending] = useState<ReadonlySet<string>>(new Set());

  // After a change the list is reloaded. The focus goes back to the button that opened the dialog;
  // when that row has gone (a revoked invitation, or a row that left the chip's filter) it goes to
  // the heading of the members section (R19). The check must run after React has committed the new
  // rows, not when the reload resolves, so it is an effect on this state.
  const [focusCheck, setFocusCheck] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (focusCheck === null) return;
    if (!focusCheck.isConnected) headingRef.current?.focus();
    setFocusCheck(null);
  }, [focusCheck, headingRef]);

  const reloadThenFocus = useCallback(
    (opener: Opener) => {
      void reload().then(() => {
        if (opener !== null) setFocusCheck(opener);
      });
    },
    [reload],
  );

  const failedText = (error: unknown) => {
    const base = t("common.error.actionFailed");
    // A 5xx adds the error ID when the error has one (D-131, D-126).
    return error instanceof ApiError &&
      error.status !== null &&
      error.status >= 500 &&
      error.requestId
      ? `${base} ${t("admin.error.id", { id: error.requestId })}`
      : base;
  };

  // The one rule of R19 for every request of the page.
  const handleError = (error: unknown, opener: Opener) => {
    switch (actionOutcome(error)) {
      case "aborted":
      case "session":
        return;
      case "forbidden":
        setPending(null);
        forbidden();
        return;
      case "stale":
        setPending(null);
        reloadThenFocus(opener);
        show({ text: t("admin.error.stale") });
        return;
      case "inProgress":
        show({ text: t("admin.error.inProgress") });
        return;
      case "failed":
        show({ text: failedText(error) });
        return;
    }
  };

  const open = (next: Pending, opener: Opener) => {
    returnFocus.current = opener;
    setPending(next);
  };

  const confirm = async () => {
    if (pending === null || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const opener = returnFocus.current;
    try {
      let done: string;
      const { row } = pending;
      switch (pending.action) {
        case "changeRole":
          await changeRole(row.userId ?? "", pending.role);
          done = t("admin.toast.roleChanged");
          break;
        case "deactivateMember":
          await deactivateMember(row.userId ?? "");
          done = t("admin.toast.deactivated");
          break;
        case "reactivateMember":
          await reactivateMember(row.userId ?? "");
          done = t("admin.toast.reactivated");
          break;
        case "revokeInvitation":
          await revokeInvitation(row.invitation?.id ?? "");
          done = t("admin.toast.revoked");
          break;
      }
      setPending(null);
      show({ text: done });
      reloadThenFocus(opener);
    } catch (error) {
      handleError(error, opener);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const resend = (row: MemberRowView) => {
    const id = row.invitation?.id;
    if (id === undefined) return;
    // One request for two fast presses.
    if (resendingRef.current.has(id)) return;
    if (!ensureOnline()) return;
    resendingRef.current.add(id);
    setResending(new Set(resendingRef.current));
    void (async () => {
      try {
        const answer = await resendInvitation(id, keys.keyFor(id));
        keys.succeeded(id);
        show({
          text:
            answer.result === "invited"
              ? t("admin.toast.resent", { email: row.email })
              : t("admin.toast.resentNoMail", { email: row.email }),
        });
        void reload();
      } catch (error) {
        keys.failed(id, error);
        handleError(error, null);
      } finally {
        resendingRef.current.delete(id);
        setResending(new Set(resendingRef.current));
      }
    })();
  };

  let dialogs: ReactNode = null;
  if (pending !== null) {
    const name = pending.row.displayName ?? pending.row.email;
    const common = {
      open: true,
      busy,
      onConfirm: () => void confirm(),
      onCancel: () => setPending(null),
      returnFocusRef: returnFocus,
    };
    switch (pending.action) {
      case "changeRole":
        dialogs = (
          <ConfirmAction
            {...common}
            action="changeRole"
            variant="primary"
            target={name}
            title={t("admin.changeRole.title")}
            description={
              pending.role === "admin"
                ? t("admin.changeRole.toAdmin")
                : t("admin.changeRole.toMember")
            }
            confirmLabel={t("admin.changeRole.confirm")}
          />
        );
        break;
      case "deactivateMember":
        dialogs = (
          <ConfirmAction
            {...common}
            action="deactivateMember"
            variant="danger"
            target={name}
            title={t("admin.deactivate.title")}
            description={t("admin.deactivate.description", { name })}
            confirmLabel={t("admin.deactivate.confirm")}
          />
        );
        break;
      case "reactivateMember":
        dialogs = (
          <ConfirmAction
            {...common}
            action="reactivateMember"
            variant="primary"
            target={name}
            title={t("admin.reactivate.title")}
            description={t("admin.reactivate.description", { name })}
            confirmLabel={t("admin.reactivate.confirm")}
          />
        );
        break;
      case "revokeInvitation":
        dialogs = (
          <ConfirmAction
            {...common}
            action="revokeInvitation"
            variant="danger"
            target={pending.row.email}
            title={t("admin.revoke.title")}
            description={t("admin.revoke.description", {
              email: pending.row.email,
            })}
            confirmLabel={t("admin.revoke.confirm")}
          />
        );
        break;
    }
  }

  return {
    openChangeRole: (row, role, opener) =>
      open({ action: "changeRole", row, role }, opener),
    openDeactivate: (row, opener) =>
      open({ action: "deactivateMember", row }, opener),
    openReactivate: (row, opener) =>
      open({ action: "reactivateMember", row }, opener),
    openRevoke: (row, opener) =>
      open({ action: "revokeInvitation", row }, opener),
    resend,
    isResending: (id) => resending.has(id),
    dialogs,
  };
}
