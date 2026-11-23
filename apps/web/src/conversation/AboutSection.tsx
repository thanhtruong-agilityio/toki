import { useTranslation } from "@toki/i18n/react";
import {
  canEditChannelDetails,
  formatDate,
  type DateContext,
} from "@toki/shared";
import { Button, Icon } from "@toki/ui-web";
import { useState } from "react";
import { clock } from "../clock";
import { AboutEditForm } from "./AboutEditForm";
import {
  isFullDetail,
  panelKind,
  useConversation,
  type DetailRead,
} from "./useConversation";
import { useConversationSelector } from "../conversation-list/use-conversations";
import { ReadFailed } from "./ReadFailed";

// The facts of a conversation (R12). The date is written by `formatDate` with no weekday, in the
// browser's time zone until a person's own zone is stored (TOKI-078).
function useCreatedDate(createdAt: string | undefined): string | null {
  const { language } = useTranslation();
  if (createdAt === undefined) return null;
  const at = Date.parse(createdAt);
  if (!Number.isFinite(at)) return null;
  const ctx: DateContext = {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    now: clock.now(),
    language,
  };
  return formatDate(at, ctx, { weekday: false });
}

export function AboutSection({
  conversationId,
  read,
  onNoAccess,
}: {
  conversationId: string;
  read: DetailRead;
  onNoAccess: () => void;
}) {
  const { t } = useTranslation();
  const { entry, name, detail } = useConversation(conversationId);
  const full =
    detail !== undefined && isFullDetail(detail) ? detail : undefined;
  const creator = useConversationSelector((s) =>
    full === undefined ? undefined : s.getPerson(full.createdBy),
  );
  const date = useCreatedDate(full?.createdAt);
  const user = useConversationSelector((s) => s.getUser());
  const [editing, setEditing] = useState(false);

  const isChannel = entry === undefined || entry.kind === "channel";
  const isPrivate =
    entry?.kind === "channel" ? entry.isPrivate : detail?.isPrivate === true;
  const shownName = entry === undefined ? (detail?.name ?? "") : name;
  const topic =
    entry?.kind === "channel" ? entry.topic : (detail?.topic ?? null);

  // Edit (R15): `archived` comes from the held detail; while it is missing the function answers
  // `fact_missing` and no button is drawn. No role is compared here.
  const canEdit =
    user !== null &&
    entry?.kind === "channel" &&
    canEditChannelDetails(user, {
      kind: panelKind(entry),
      isGeneral: entry.isGeneral,
      archived: full?.archived as boolean,
      isMember: true,
    }).allowed;

  const created =
    creator !== undefined && date !== null
      ? t("conversation.panel.createdBy", { name: creator.displayName, date })
      : creator !== undefined
        ? t("conversation.panel.createdByOnly", { name: creator.displayName })
        : date !== null
          ? t("conversation.panel.createdOn", { date })
          : null;

  return (
    <section>
      <h3>{t("conversation.panel.about")}</h3>
      <div className="dp-name">
        {isChannel && <Icon name={isPrivate ? "lock" : "hash"} />}
        <span>{shownName}</span>
      </div>
      {isChannel ? (
        <>
          {editing ? (
            <AboutEditForm
              conversationId={conversationId}
              topic={topic}
              description={full?.description ?? null}
              onClose={() => setEditing(false)}
              onNoAccess={onNoAccess}
            />
          ) : (
            <>
              <div className="sm dp-topic">
                {topic !== null && topic !== "" ? (
                  topic
                ) : (
                  <span className="muted">
                    {t("conversation.panel.noTopic")}
                  </span>
                )}
              </div>
              {full !== undefined && (
                <p className="sm muted">
                  {full.description !== null && full.description !== ""
                    ? full.description
                    : t("conversation.panel.noDescription")}
                </p>
              )}
            </>
          )}
          {full !== undefined && created !== null && (
            <div className="xs muted">{created}</div>
          )}
          {canEdit && !editing && (
            <Button size="sm" onClick={() => setEditing(true)}>
              {t("conversation.panel.edit")}
            </Button>
          )}
          {full === undefined && read.status === "failed" && (
            <ReadFailed error={read.error} onRetry={read.retry} />
          )}
        </>
      ) : (
        <div className="sm muted">
          {t("conversation.panel.directConversation")}
        </div>
      )}
    </section>
  );
}
