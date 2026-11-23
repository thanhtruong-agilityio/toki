import { ApiError } from "@toki/client-core";
import { useTranslation } from "@toki/i18n/react";
import { canLeaveChannel } from "@toki/shared";
import { Button, useToasts } from "@toki/ui-web";
import { useRef, useState } from "react";
import { conversations } from "../client";
import { useConversationSelector } from "../conversation-list/use-conversations";
import { ConfirmAction, useUndo, type ConfirmActionId } from "../patterns";
import { readFailure } from "./readFailure";
import { panelKind, useConversation } from "./useConversation";

type Dialog = {
  action: Extract<
    ConfirmActionId,
    "leavePrivateChannel" | "leavePublicChannelLastMember"
  >;
  description: string;
};

// A refresh that fails must not change the outcome of the leave: the row simply stays as it was.
async function refreshQuietly(): Promise<void> {
  try {
    await conversations.refresh();
  } catch {
    // ignored
  }
}

// Leave (R20 to R26). A public channel is left at once and offers Undo for 5 seconds; a private
// channel, and the last member of any channel, confirm first and have no Undo (D-051, D-061, D-069,
// D-156). The count of members is read again at the press, and the leave starts when that read has
// answered, so the Leave button is disabled meanwhile. The code never shows a confirmation and an
// Undo together. After the answer the store has dropped the channel and the route moves on (R25);
// nothing here navigates.
export function LeaveSection({
  conversationId,
  onNoAccess,
}: {
  conversationId: string;
  onNoAccess: () => void;
}) {
  const { t } = useTranslation();
  const toasts = useToasts();
  const { run } = useUndo();
  const user = useConversationSelector((s) => s.getUser());
  const { entry, detail } = useConversation(conversationId);
  const [reading, setReading] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  // An archived channel has no entry: its facts come from the channel read, and it can lose no
  // last member, so no count is read for it (R30).
  const archived = entry === undefined;
  const isPrivate =
    entry?.kind === "channel" ? entry.isPrivate : detail?.isPrivate === true;
  const name = entry?.kind === "channel" ? entry.name : (detail?.name ?? "");
  const facts =
    entry !== undefined
      ? {
          kind: panelKind(entry),
          isGeneral: entry.isGeneral,
          archived: false,
          isMember: true,
        }
      : detail !== undefined
        ? {
            kind: detail.isPrivate
              ? ("private_channel" as const)
              : ("public_channel" as const),
            isGeneral: detail.isGeneral,
            archived: detail.archived,
            isMember: true,
          }
        : undefined;
  if (user === null || facts === undefined) return null;
  if (!canLeaveChannel(user, facts).allowed) return null;

  const failed = () => toasts.show({ text: t("common.error.actionFailed") });

  // R22: left at once, Undo for 5 seconds. A 409 (a stale screen) refreshes the store before the
  // helper shows its one failure toast.
  const leavePublic = () =>
    run({
      action: "leavePublicChannel",
      text: t("conversation.leave.toast", { name }),
      key: `leave:${conversationId}`,
      perform: async () => {
        try {
          await conversations.leaveChannel(conversationId);
        } catch (error) {
          if (error instanceof ApiError && error.status === 409) {
            await refreshQuietly();
          }
          throw error;
        }
      },
      undo: () => conversations.joinChannel(conversationId),
    });

  const onPress = async () => {
    if (started.current) return;
    started.current = true;
    setReading(true);
    try {
      let count: number | null = null;
      if (!archived) {
        try {
          count = (await conversations.readChannel(conversationId)).memberCount;
        } catch {
          // A failed read must not stop a person from leaving: the server's answer decides.
          count = null;
        }
      }
      const last = t("conversation.leave.lastMember");
      if (isPrivate) {
        setDialog({
          action: "leavePrivateChannel",
          description: [
            t("conversation.leave.privateNotice"),
            ...(count === 1 ? [last] : []),
          ].join(" "),
        });
      } else if (count === 1) {
        setDialog({
          action: "leavePublicChannelLastMember",
          description: last,
        });
      } else {
        await leavePublic();
      }
    } finally {
      started.current = false;
      setReading(false);
    }
  };

  // R23, R24, R26: the confirmed leave of a private channel and of the last member of a public one.
  const onConfirm = async () => {
    if (dialog === null || busy) return;
    const { action } = dialog;
    setBusy(true);
    try {
      await conversations.leaveChannel(conversationId);
      setDialog(null);
    } catch (error) {
      const status = error instanceof ApiError ? error.status : null;
      if (status === 404 && action === "leavePrivateChannel") {
        // No longer a member of a private channel: the leave is done.
        await refreshQuietly();
        setDialog(null);
      } else if (
        action === "leavePrivateChannel" &&
        readFailure(error) === "no_access"
      ) {
        onNoAccess();
      } else {
        if (status === 409) await refreshQuietly();
        failed();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dp-leave">
      <Button
        className="leave"
        disabled={reading}
        onClick={() => void onPress()}
      >
        {t("conversation.panel.leave")}
      </Button>
      {dialog !== null && (
        <ConfirmAction
          open
          action={dialog.action}
          title={t("conversation.leave.title")}
          target={`#${name}`}
          description={dialog.description}
          confirmLabel={t("conversation.leave.confirm")}
          variant="danger"
          busy={busy}
          onConfirm={() => void onConfirm()}
          onCancel={() => setDialog(null)}
        />
      )}
    </div>
  );
}
