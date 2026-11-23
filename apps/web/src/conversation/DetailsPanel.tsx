import { useTranslation } from "@toki/i18n/react";
import { SidePanel } from "@toki/ui-web";
import "./conversation.css";
import { AboutSection } from "./AboutSection";
import { LeaveSection } from "./LeaveSection";
import { NotificationsSection } from "./NotificationsSection";
import { PeopleSection, type PeopleControls } from "./PeopleSection";
import { SettingsSection } from "./SettingsSection";
import { useConversation, useDetailRead } from "./useConversation";
import { useDetailsPanel } from "./useDetailsPanel";

export type DetailsPanelProps = {
  conversationId: string;
  // The person is not or no longer a member (R14): the page draws the not-found view.
  onNoAccess: () => void;
  // The seam of TOKI-100 under Members, passed on to the section (R13).
  Controls?: PeopleControls;
};

// The side panel of an open conversation (R11): the frame and the sections of Table A, in the
// shell's slot. The sections sit in one `div` with the id the members button names.
export function DetailsPanel({
  conversationId,
  onNoAccess,
  Controls,
}: DetailsPanelProps) {
  const { t } = useTranslation();
  const { entry, detail } = useConversation(conversationId);
  const { closeDetails } = useDetailsPanel(conversationId);
  // The read when the panel opens: a channel, or an id with no entry (an archived channel, R30).
  const read = useDetailRead(
    conversationId,
    entry === undefined || entry.kind === "channel",
    onNoAccess,
  );
  // A conversation the store holds no entry for is drawn only when it is an archived channel (R30), with
  // About, Members and Leave and no level, mute, star or Edit (they belong to a member row it has none of);
  // after a leave neither exists and the panel draws nothing (R25).
  if (entry === undefined && detail?.archived !== true) return null;
  return (
    <SidePanel
      title={
        entry?.kind === "dm"
          ? t("conversation.panel.titleProfile")
          : t("conversation.panel.titleDetails")
      }
      labels={{ back: t("common.back"), close: t("common.closePanel") }}
      onClose={closeDetails}
    >
      <div id="conversation-details">
        <AboutSection
          conversationId={conversationId}
          read={read}
          onNoAccess={onNoAccess}
        />
        <PeopleSection
          conversationId={conversationId}
          onNoAccess={onNoAccess}
          Controls={Controls}
        />
        {entry !== undefined && (
          <>
            <NotificationsSection
              conversationId={conversationId}
              onNoAccess={onNoAccess}
            />
            <SettingsSection
              conversationId={conversationId}
              onNoAccess={onNoAccess}
            />
          </>
        )}
        <LeaveSection conversationId={conversationId} onNoAccess={onNoAccess} />
      </div>
    </SidePanel>
  );
}
