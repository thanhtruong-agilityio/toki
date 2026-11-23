import { useTranslation } from "@toki/i18n/react";
import { useToasts } from "@toki/ui-web";
import { useRef, useState } from "react";
import { classifyApiError, conversations } from "./deps";
import { archiveFlow, readArchiveCount } from "./archiveFlow";

// The state of one archive (R9, R10): the press that reads the count, the confirmation and the
// request. The functions it calls are plain (archiveFlow.ts); this hook only binds the toast, the
// texts and the state.
export function useArchiveChannel({
  conversationId,
  name,
  onNoAccess,
}: {
  conversationId: string;
  name: string;
  onNoAccess: () => void;
}) {
  const { t } = useTranslation();
  const { show } = useToasts();
  const [reading, setReading] = useState(false);
  // The count the confirmation names; the confirmation is open while there is one.
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const pressing = useRef(false);
  const confirming = useRef(false);

  const press = async () => {
    if (pressing.current) return;
    pressing.current = true;
    setReading(true);
    try {
      const read = await readArchiveCount({
        id: conversationId,
        readChannel: (id) => conversations.readChannel(id),
        getMemberCount: (id) => conversations.getMemberCount(id),
      });
      // The confirmation names the count (F26), so it never opens without one.
      if (read === null) show({ text: t("common.error.actionFailed") });
      else setCount(read);
    } finally {
      pressing.current = false;
      setReading(false);
    }
  };

  const confirm = async () => {
    if (confirming.current) return;
    confirming.current = true;
    try {
      await archiveFlow({
        id: conversationId,
        archiveChannel: (id) => conversations.archiveChannel(id),
        readChannel: (id) => conversations.readChannel(id),
        classify: classifyApiError,
        show,
        texts: {
          done: t("archive.done", { name }),
          failed: t("common.error.actionFailed"),
        },
        onNoAccess,
        closeDialog: () => setCount(null),
        setBusy,
      });
    } finally {
      confirming.current = false;
    }
  };

  return {
    reading,
    busy,
    count,
    press: () => void press(),
    confirm: () => void confirm(),
    cancel: () => setCount(null),
  };
}
