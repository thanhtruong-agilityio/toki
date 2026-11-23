import { useTranslation } from "@toki/i18n/react";
import { useId } from "react";
import { useConversationSettings } from "./useConversationSettings";

const LEVELS = ["all", "mentions", "none"] as const;

// The person's own notification level of this conversation (R17). The checked radio is the stored
// value; a choice is saved at once and the radio changes when the save has been answered.
export function NotificationsSection({
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
  const name = useId();
  return (
    <section>
      <h3>{t("conversation.panel.notifications")}</h3>
      {LEVELS.map((level) => (
        <label key={level} className="opt">
          <input
            type="radio"
            name={name}
            value={level}
            checked={values.notificationLevel === level}
            disabled={pending.notificationLevel === true}
            onChange={() => void save({ notificationLevel: level })}
          />
          {t(`conversation.panel.level.${level}`)}
        </label>
      ))}
    </section>
  );
}
