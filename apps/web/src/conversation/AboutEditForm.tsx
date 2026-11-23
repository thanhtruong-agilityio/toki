import { classifyApiError } from "@toki/client-core";
import { useTranslation } from "@toki/i18n/react";
import { CHANNEL_TOPIC_MAX, isValidChannelTopic } from "@toki/shared";
import { Button, Field, useToasts } from "@toki/ui-web";
import { useRef, useState, type KeyboardEvent } from "react";
import { conversations } from "../client";
import { useOnlineGate } from "../patterns";
import { readChannelOnce } from "./useConversation";
import { readFailure } from "./readFailure";

// The in-place edit of the topic and the description (R15, R16). The name has no field (D-105).
export function AboutEditForm({
  conversationId,
  topic,
  description,
  onClose,
  onNoAccess,
}: {
  conversationId: string;
  topic: string | null;
  description: string | null;
  onClose: () => void;
  onNoAccess: () => void;
}) {
  const { t } = useTranslation();
  const toasts = useToasts();
  const { ensureOnline } = useOnlineGate();
  const [topicText, setTopicText] = useState(topic ?? "");
  const [descriptionText, setDescriptionText] = useState(description ?? "");
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  // The message of a 400, under the field that was sent.
  const [serverError, setServerError] = useState<{
    field: "topic" | "description";
    message: string;
  } | null>(null);

  const trimmedTopic = topicText.trim();
  const trimmedDescription = descriptionText.trim();
  const topicChanged = trimmedTopic !== (topic ?? "");
  const descriptionChanged = trimmedDescription !== (description ?? "");
  const topicValid = isValidChannelTopic(
    trimmedTopic === "" ? null : trimmedTopic,
  );
  const canSave = (topicChanged || descriptionChanged) && topicValid && !busy;

  const submit = async () => {
    if (!canSave || running.current) return;
    if (!ensureOnline()) return;
    running.current = true;
    setBusy(true);
    setServerError(null);
    // Only what changed, each trimmed; an empty result is null (R16).
    const body: { topic?: string | null; description?: string | null } = {};
    if (topicChanged) body.topic = trimmedTopic === "" ? null : trimmedTopic;
    if (descriptionChanged) {
      body.description = trimmedDescription === "" ? null : trimmedDescription;
    }
    try {
      await conversations.editChannel(conversationId, body);
      onClose();
    } catch (error) {
      const kind = classifyApiError(error);
      if (kind === "field") {
        setServerError({
          field: topicChanged ? "topic" : "description",
          message: error instanceof Error ? error.message : "",
        });
      } else if (readFailure(error) === "no_access") {
        onNoAccess();
      } else if (kind === "fresh_copy") {
        readChannelOnce(conversationId).catch(() => {});
        onClose();
        toasts.show({ text: t("common.error.actionFailed") });
      } else {
        toasts.show({ text: t("common.error.actionFailed") });
      }
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  // Escape cancels the form and nothing else: the panel's own Escape sees a handled event.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    onClose();
  };

  const topicError = !topicValid
    ? t("conversation.panel.topicTooLong", { max: CHANNEL_TOPIC_MAX })
    : serverError?.field === "topic"
      ? serverError.message
      : undefined;

  return (
    <form
      onKeyDown={onKeyDown}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Field
        label={t("conversation.panel.topicLabel")}
        value={topicText}
        error={topicError}
        onChange={(event) => setTopicText(event.target.value)}
      />
      <Field
        label={t("conversation.panel.descriptionLabel")}
        multiline
        rows={3}
        value={descriptionText}
        error={
          serverError?.field === "description" ? serverError.message : undefined
        }
        onChange={(event) => setDescriptionText(event.target.value)}
      />
      <div className="dp-actions">
        <Button variant="primary" size="sm" type="submit" disabled={!canSave}>
          {t("conversation.panel.save")}
        </Button>
        <Button size="sm" onClick={onClose}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}
