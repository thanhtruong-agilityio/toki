import { useTranslation } from "@toki/i18n/react";
import { Avatar, Button, Icon, IconButton, UsersIcon } from "@toki/ui-web";
import { useConversationSelector } from "../conversation-list/use-conversations";
import { personHue } from "../people/person-hue";
import "./conversation.css";
import { useChannelRead, useConversation } from "./useConversation";
import { useDetailsPanel } from "./useDetailsPanel";

// The top row of an open conversation (R1 to R7): Back (narrow screens), the glyph, the name, the
// star and the topic, and the members button that opens the Details panel. The other controls of
// the row belong to later tickets (TOKI-072, phase 4, TOKI-041).
export function ConversationHeader({
  conversationId,
  onBack,
}: {
  conversationId: string;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const { entry, name, detail, memberCount } = useConversation(conversationId);
  const userId = useConversationSelector((s) => s.getUser()?.id);
  const { open, openDetails, closeDetails } = useDetailsPanel(conversationId);
  useChannelRead(conversationId, entry?.kind === "channel");

  // An archived channel has no entry: its name and topic come from the channel read, and it has no
  // star (R30). Any other id with no entry (the person has just left, R25) draws nothing.
  const archived =
    entry === undefined && detail?.archived === true ? detail : undefined;
  if (entry === undefined && archived === undefined) return null;

  const kind = entry?.kind ?? "channel";
  const isPrivate =
    entry?.kind === "channel" ? entry.isPrivate : archived?.isPrivate === true;
  const topic =
    entry?.kind === "channel" ? entry.topic : (archived?.topic ?? null);
  const starred = entry?.isStarred === true;
  const otherId =
    entry !== undefined && entry.kind === "dm"
      ? entry.memberIds.find((id) => id !== userId)
      : undefined;
  const shownName = archived !== undefined ? archived.name : name;

  return (
    <div className="mh">
      <IconButton
        className="back"
        icon="left"
        label={t("conversation.header.back")}
        onClick={onBack}
      />
      <div className="grow">
        <h1 className="ell">
          {kind === "channel" ? (
            <Icon name={isPrivate ? "lock" : "hash"} />
          ) : kind === "dm" && otherId !== undefined ? (
            <Avatar name={shownName} hue={personHue(otherId)} size={28} />
          ) : (
            <Icon name="users" />
          )}
          <span className="ell">{shownName}</span>
          {starred && (
            <span
              className="later-ic"
              role="img"
              aria-label={t("conversation.header.starred")}
            >
              <Icon name="star" />
            </span>
          )}
        </h1>
        {topic !== null && topic !== "" && (
          <div className="topic ell">{topic}</div>
        )}
      </div>
      <Button
        variant="ghost"
        className="memb"
        aria-label={t("conversation.header.details")}
        aria-expanded={open}
        aria-controls="conversation-details"
        onClick={open ? closeDetails : openDetails}
      >
        <UsersIcon />
        {memberCount !== undefined && (
          <span className="mono">{memberCount}</span>
        )}
      </Button>
    </div>
  );
}
