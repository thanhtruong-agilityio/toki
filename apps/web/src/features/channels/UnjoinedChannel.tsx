import { useTranslation } from "@toki/i18n/react";
import type { ChannelSummary } from "@toki/shared";
import { Button, HashIcon, LockIcon, Tag } from "@toki/ui-web";
import { useEffect, useRef, useState } from "react";
import { ApiError, conversations } from "../deps";
import { useJoinChannel } from "./useJoinChannel";

export type UnjoinedChannelProps = {
  channelId: string;
  // The store holds the channel after a join, so the route draws it; nothing more to do here.
  onJoined: (channelId: string) => void;
  // The person is a member after all (joined elsewhere, or a member of an archived channel).
  onMember: (detail: ChannelSummary) => void;
  onNotFound: () => void;
};

type Read =
  | { kind: "loading" }
  | { kind: "failed" }
  // Handed on (a member, or not found): nothing of the channel is drawn.
  | { kind: "gone" }
  | { kind: "channel"; channel: ChannelSummary };

// The view of a public channel the person has not joined, for an address that is not in their list
// (TOKI-034 R16). It reads the channel through the store's command, so the answer is kept for the
// header that follows a join, and shows name, topic and member count: never a message.
export function UnjoinedChannel({
  channelId,
  onJoined,
  onMember,
  onNotFound,
}: UnjoinedChannelProps) {
  const { t } = useTranslation();
  const join = useJoinChannel();
  const [read, setRead] = useState<Read>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [joinFailed, setJoinFailed] = useState(false);
  const [joining, setJoining] = useState(false);
  const mounted = useRef(false);
  const latest = useRef({ onMember, onNotFound });
  latest.current = { onMember, onNotFound };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let current = true;
    setRead({ kind: "loading" });
    conversations.readChannel(channelId).then(
      (channel) => {
        if (!current) return;
        if (channel.isMember) {
          setRead({ kind: "gone" });
          latest.current.onMember(channel);
          return;
        }
        setRead({ kind: "channel", channel });
      },
      (error: unknown) => {
        if (!current) return;
        if (
          error instanceof ApiError &&
          error.kind === "http" &&
          // A malformed id (400) can never succeed either: Retry would be pointless.
          (error.status === 404 || error.status === 403 || error.status === 400)
        ) {
          setRead({ kind: "gone" });
          latest.current.onNotFound();
          return;
        }
        setRead({ kind: "failed" });
      },
    );
    return () => {
      current = false;
    };
  }, [channelId, attempt]);

  if (read.kind === "gone") return null;
  if (read.kind === "loading") {
    return <p className="muted">{t("browse.loading")}</p>;
  }
  if (read.kind === "failed") {
    return (
      <>
        <p className="muted">{t("browse.error.load")}</p>
        <Button size="sm" onClick={() => setAttempt((n) => n + 1)}>
          {t("browse.error.retry")}
        </Button>
      </>
    );
  }

  const { channel } = read;
  const press = async () => {
    if (joining) return;
    setJoining(true);
    setJoinFailed(false);
    const result = await join({
      id: channel.id,
      name: channel.name,
      isMounted: () => mounted.current,
      onJoined: () => onJoined(channel.id),
    });
    if (!mounted.current) return;
    setJoining(false);
    // Archived since the page was read: read it again, which now shows the label and no button.
    if (result.kind === "archived") setAttempt((n) => n + 1);
    else if (result.kind === "failed") setJoinFailed(true);
  };

  return (
    <div>
      <h2>
        {channel.isPrivate ? <LockIcon /> : <HashIcon />}
        {channel.name}
      </h2>
      {channel.topic !== null && channel.topic !== "" ? (
        <p>{channel.topic}</p>
      ) : null}
      <p className="muted">
        {t("browse.row.members", { count: channel.memberCount })}
      </p>
      {channel.archived ? (
        <Tag>{t("browse.row.archived")}</Tag>
      ) : (
        <Button
          variant="primary"
          disabled={joining}
          aria-busy={joining ? "true" : undefined}
          onClick={() => void press()}
        >
          {t("browse.row.join")}
        </Button>
      )}
      {joinFailed ? (
        <div className="gerr" role="alert">
          {t("common.error.actionFailed")}
        </div>
      ) : null}
    </div>
  );
}
