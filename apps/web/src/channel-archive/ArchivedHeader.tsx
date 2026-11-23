import { useTranslation } from "@toki/i18n/react";
import { Icon, IconButton, Tag } from "@toki/ui-web";
import "../conversation/conversation.css";
import { useConversationSelector } from "./deps";

// The header of an archived channel (R15): the classes of TOKI-035's header, the label, and none of
// its controls (concern 4). It draws nothing until a detail is held, so no name is invented.
export function ArchivedHeader({
  channelId,
  onBack,
}: {
  channelId: string;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const detail = useConversationSelector((s) => s.getChannelDetail(channelId));
  if (detail === undefined) return null;
  const topic = detail.topic;
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
          <Icon name={detail.isPrivate ? "lock" : "hash"} />
          <span className="ell">{detail.name}</span>
          <Tag>{t("archive.label")}</Tag>
        </h1>
        {topic !== null && topic !== "" && (
          <div className="topic ell">{topic}</div>
        )}
      </div>
    </div>
  );
}
