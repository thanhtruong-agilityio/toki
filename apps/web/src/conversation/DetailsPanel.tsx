import { useTranslation } from "@toki/i18n/react";
import { SidePanel } from "@toki/ui-web";
import "./conversation.css";
import { useConversation } from "./useConversation";
import { useDetailsPanel } from "./useDetailsPanel";

export type DetailsPanelProps = {
  conversationId: string;
  // The person is not or no longer a member (R14): the page draws the not-found view.
  onNoAccess: () => void;
};

// The side panel of an open conversation (R11): the frame and the sections of Table A, in the
// shell's slot. The sections sit in one `div` with the id the members button names.
export function DetailsPanel({ conversationId }: DetailsPanelProps) {
  const { t } = useTranslation();
  const { entry, detail } = useConversation(conversationId);
  const { closeDetails } = useDetailsPanel(conversationId);
  // A conversation the store holds no entry for is drawn only when it is an archived channel (R30);
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
      <div id="conversation-details" />
    </SidePanel>
  );
}
