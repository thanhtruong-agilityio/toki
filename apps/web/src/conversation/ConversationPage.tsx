import { useTranslation } from "@toki/i18n/react";
import { useCallback, useState } from "react";
import { conversations } from "../client";
import { NotFoundView } from "../routes/NotFoundView";
import { useShellPanel } from "../shell/shell-slots";
import { ConversationHeader } from "./ConversationHeader";
import { DetailsPanel } from "./DetailsPanel";
import { useDetailsPanel } from "./useDetailsPanel";

// The page of an open conversation. TOKI-041 and TOKI-043 add the message list and the composer
// below the header and keep this file, its props and its test id (TOKI-033 R21). It sits in the
// shell's `main`, so it is not a `main` itself.
export function ConversationPage({
  conversationId,
  onBack,
}: {
  conversationId: string;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const { open } = useDetailsPanel(conversationId);
  // A read or a write answered 403 or 404: the person is not or no longer a member, so the page draws
  // the not-found view and asks the store to refresh; the route then moves on if the entry is gone
  // (R14, R25).
  const [noAccess, setNoAccess] = useState(false);
  const onNoAccess = useCallback(() => {
    setNoAccess(true);
    // A failed refresh leaves the not-found view as it is.
    conversations.refresh().catch(() => {});
  }, []);

  useShellPanel(
    open && !noAccess
      ? {
          label: t("conversation.panel.label"),
          content: (
            <DetailsPanel
              conversationId={conversationId}
              onNoAccess={onNoAccess}
            />
          ),
        }
      : null,
  );

  if (noAccess) return <NotFoundView />;
  return (
    <div data-testid="conversation-page">
      <ConversationHeader conversationId={conversationId} onBack={onBack} />
    </div>
  );
}
