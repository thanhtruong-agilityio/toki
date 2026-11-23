import type { SettingsValues } from "@toki/client-core";
import { useTranslation } from "@toki/i18n/react";
import { useToasts } from "@toki/ui-web";
import { useCallback, useRef, useState } from "react";
import { conversations } from "../client";
import { useConversationSelector } from "../conversation-list/use-conversations";
import { useOnlineGate } from "../patterns";
import { readFailure } from "./readFailure";

// An object with exactly one of the keys of `T` (R19).
export type OneOf<T> = {
  [K in keyof T]-?: { [P in K]: T[P] } & {
    [P in Exclude<keyof T, K>]?: never;
  };
}[keyof T];

export type SettingsPatch = OneOf<SettingsValues>;
export type SaveSettings = (patch: SettingsPatch) => Promise<void>;

const DEFAULTS: SettingsValues = {
  notificationLevel: "all",
  isMuted: false,
  isStarred: false,
};

// The seam of R19: the person's own level, mute and star of one conversation and the call that
// saves one of them. The store's `saveSettings` changes the entry when the answer arrives, never
// before, so a control shows the stored value until then. If the request moves, only this file moves.
export function useConversationSettings(
  conversationId: string,
  onNoAccess?: () => void,
) {
  const { t } = useTranslation();
  const toasts = useToasts();
  const { ensureOnline } = useOnlineGate();
  const level = useConversationSelector(
    (s) => s.getConversation(conversationId)?.notificationLevel,
  );
  const isMuted = useConversationSelector(
    (s) => s.getConversation(conversationId)?.isMuted,
  );
  const isStarred = useConversationSelector(
    (s) => s.getConversation(conversationId)?.isStarred,
  );
  const values: SettingsValues = {
    notificationLevel: level ?? DEFAULTS.notificationLevel,
    isMuted: isMuted ?? DEFAULTS.isMuted,
    isStarred: isStarred ?? DEFAULTS.isStarred,
  };

  const running = useRef(new Set<keyof SettingsValues>());
  const [pending, setPending] = useState<
    Partial<Record<keyof SettingsValues, boolean>>
  >({});
  const latest = useRef({ onNoAccess, ensureOnline, toasts, t });
  latest.current = { onNoAccess, ensureOnline, toasts, t };

  const save = useCallback<SaveSettings>(
    async (patch) => {
      const key = Object.keys(patch)[0] as keyof SettingsValues | undefined;
      if (key === undefined || running.current.has(key)) return;
      if (!latest.current.ensureOnline()) return;
      running.current.add(key);
      setPending((p) => ({ ...p, [key]: true }));
      try {
        await conversations.saveSettings(conversationId, patch);
      } catch (error) {
        const { onNoAccess, toasts, t } = latest.current;
        if (readFailure(error) === "no_access") onNoAccess?.();
        else toasts.show({ text: t("common.error.actionFailed") });
      } finally {
        running.current.delete(key);
        setPending((p) => {
          const { [key]: _done, ...rest } = p;
          void _done;
          return rest;
        });
      }
    },
    [conversationId],
  );

  return { values, save, pending };
}
