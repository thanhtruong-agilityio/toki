import { useTranslation } from "@toki/i18n/react";
import type { ChannelSummary } from "@toki/shared";
import { Button } from "@toki/ui-web";
import { Fragment, useRef } from "react";
import { ConfirmAction } from "../patterns";
import { canOfferRestore } from "./access";
import { useCurrentUser } from "./deps";
import { useRestoreChannel } from "./useRestoreChannel";

// The "Restore" button beside an archived channel in Browse channels, and its confirmation (R18,
// R19). It draws nothing for anyone who may not restore. `onChanged` is the dialog's reset of its
// list (R20).
export function RestoreButton({
  channel,
  onChanged,
}: {
  channel: ChannelSummary;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const restore = useRestoreChannel({
    channelId: channel.id,
    name: channel.name,
    onChanged,
  });

  if (
    !canOfferRestore({
      actor: user,
      channel: {
        isPrivate: channel.isPrivate,
        isGeneral: channel.isGeneral,
        archived: channel.archived,
        isMember: channel.isMember,
      },
    })
  ) {
    return null;
  }

  return (
    <Fragment>
      <Button
        ref={buttonRef}
        size="sm"
        aria-label={t("archive.restoreNamed", { name: channel.name })}
        onClick={restore.press}
      >
        {t("archive.restore")}
      </Button>
      {restore.open && (
        <ConfirmAction
          open
          action="restoreChannel"
          title={t("archive.restoreTitle")}
          target={`#${channel.name}`}
          description={t("archive.restoreMessage")}
          confirmLabel={t("archive.restoreConfirm")}
          variant="primary"
          busy={restore.busy}
          onConfirm={restore.confirm}
          onCancel={restore.cancel}
          returnFocusRef={buttonRef}
        />
      )}
    </Fragment>
  );
}
