import { useTranslation } from "@toki/i18n/react";
import { useToasts } from "@toki/ui-web";
import { useRef, useState } from "react";
import { classifyApiError, conversations } from "./deps";
import { restoreFlow } from "./restoreFlow";

// The state of one restore (R19): the confirmation and the request. The request itself is the plain
// function of restoreFlow.ts.
export function useRestoreChannel({
  channelId,
  name,
  onChanged,
}: {
  channelId: string;
  name: string;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const { show } = useToasts();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirming = useRef(false);

  const confirm = async () => {
    if (confirming.current) return;
    confirming.current = true;
    try {
      await restoreFlow({
        id: channelId,
        restoreChannel: (id) => conversations.restoreChannel(id),
        classify: classifyApiError,
        show,
        texts: {
          restored: t("archive.restored", { name }),
          failed: t("common.error.actionFailed"),
        },
        onChanged,
        closeDialog: () => setOpen(false),
        setBusy,
      });
    } finally {
      confirming.current = false;
    }
  };

  return {
    open,
    busy,
    press: () => setOpen(true),
    confirm: () => void confirm(),
    cancel: () => setOpen(false),
  };
}
