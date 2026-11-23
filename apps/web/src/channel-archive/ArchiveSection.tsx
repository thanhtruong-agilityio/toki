import { useTranslation } from "@toki/i18n/react";
import { Button } from "@toki/ui-web";
import { useRef } from "react";
import { ConfirmAction } from "../patterns";
import { canOfferArchive } from "./access";
import "./archive.css";
import { useConversationSelector, useCurrentUser } from "./deps";
import { useArchiveChannel } from "./useArchiveChannel";

// The "Archive channel" button of the Details panel and its confirmation (R8 to R11). It draws
// nothing until the channel's detail is held (a missing fact denies) and for anyone who may not
// archive. Every hook runs before the early return: after a success the store drops the entry and
// this component renders once more, with no entry, before the page unmounts it (plan, 7c).
export function ArchiveSection({
  conversationId,
  onNoAccess,
}: {
  conversationId: string;
  onNoAccess: () => void;
}) {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const entry = useConversationSelector((s) =>
    s.getConversation(conversationId),
  );
  const detail = useConversationSelector((s) =>
    s.getChannelDetail(conversationId),
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
  const name = entry?.kind === "channel" ? entry.name : "";
  const archive = useArchiveChannel({ conversationId, name, onNoAccess });

  // A panel is a member's, so `isMember` is true; DMs and groups are no channel.
  if (
    entry?.kind !== "channel" ||
    !canOfferArchive({
      actor: user,
      channel: {
        isPrivate: entry.isPrivate,
        isGeneral: entry.isGeneral,
        archived: detail?.archived,
        isMember: true,
      },
    })
  ) {
    return null;
  }

  return (
    <div className="dp-archive">
      <Button
        ref={buttonRef}
        className="archive"
        disabled={archive.reading}
        aria-busy={archive.reading ? "true" : undefined}
        onClick={archive.press}
      >
        {t("archive.button")}
      </Button>
      {archive.count !== null && (
        <ConfirmAction
          open
          action="archiveChannel"
          title={t("archive.title")}
          target={`#${name}`}
          description={t("archive.message", { count: archive.count })}
          confirmLabel={t("archive.confirm")}
          variant="danger"
          busy={archive.busy}
          onConfirm={archive.confirm}
          onCancel={archive.cancel}
          returnFocusRef={buttonRef}
        />
      )}
    </div>
  );
}
