import { useEffect, useState, type ReactNode } from "react";
import { NotFoundView } from "../routes/NotFoundView";
import "./archive.css";
import { ArchivedHeader } from "./ArchivedHeader";
import { ArchivedNotice } from "./ArchivedNotice";
import { classifyApiError, conversations, readChannelOnce } from "./deps";

// What a member sees when they open an archived channel (R14): the header, the place of the history
// (`children`, which the route fills with `ArchivedHistory`) and the notice where the composer would
// be. It has no composer element and asks for no message. It reads the channel once when it mounts,
// so the label and the topic are the server's now (R16); a read that fails leaves what is held, and
// only a 403 or 404 turns the page into the not-found view (the pattern of ConversationPage).
export function ArchivedChannelPage({
  channelId,
  onBack,
  children,
}: {
  channelId: string;
  onBack: () => void;
  children?: ReactNode;
}) {
  const [noAccess, setNoAccess] = useState(false);

  useEffect(() => {
    let live = true;
    readChannelOnce(channelId).catch((error: unknown) => {
      if (live && classifyApiError(error) === "no_access") {
        setNoAccess(true);
        // A failed refresh leaves the not-found view as it is.
        conversations.refresh().catch(() => {});
      }
    });
    return () => {
      live = false;
    };
  }, [channelId]);

  if (noAccess) return <NotFoundView />;
  return (
    <div className="arch-page" data-testid="archived-channel-page">
      <ArchivedHeader channelId={channelId} onBack={onBack} />
      <div className="arch-body">{children}</div>
      <ArchivedNotice />
    </div>
  );
}
