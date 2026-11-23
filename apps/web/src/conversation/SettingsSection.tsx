import { useTranslation } from "@toki/i18n/react";
import { Switch } from "@toki/ui-web";
import { useId } from "react";
import { useConversationSettings } from "./useConversationSettings";

// Mute and star, the person's own (R18, D-143). A switch changes when the save has been answered.
export function SettingsSection({
  conversationId,
  onNoAccess,
}: {
  conversationId: string;
  onNoAccess: () => void;
}) {
  const { t } = useTranslation();
  const { values, save, pending } = useConversationSettings(
    conversationId,
    onNoAccess,
  );
  const muteId = useId();
  const starId = useId();
  return (
    <section>
      <h3>{t("conversation.panel.settings")}</h3>
      <div className="setrow">
        <span className="grow" id={muteId}>
          {t("conversation.panel.mute")}
        </span>
        <Switch
          labelledBy={muteId}
          checked={values.isMuted}
          disabled={pending.isMuted === true}
          onChange={(isMuted) => void save({ isMuted })}
        />
      </div>
      <div className="setrow">
        <span className="grow" id={starId}>
          {t("conversation.panel.star")}
        </span>
        <Switch
          labelledBy={starId}
          checked={values.isStarred}
          disabled={pending.isStarred === true}
          onChange={(isStarred) => void save({ isStarred })}
        />
      </div>
    </section>
  );
}
