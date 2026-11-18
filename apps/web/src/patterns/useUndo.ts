import { useTranslation } from "@toki/i18n/react";
import { useToasts, type ToastId } from "@toki/ui-web";
import { useCallback, useLayoutEffect, useRef } from "react";
import { actionPatterns, type UndoActionId } from "./actions";
import { useOnlineGate } from "./useOnlineGate";

export type UndoOutcome = "done" | "failed" | "blocked";

export type UndoRun = {
  action: UndoActionId;
  // The already translated text of the toast.
  text: string;
  perform: () => void | Promise<void>;
  undo: () => void | Promise<void>;
  // Two calls with the same key replace each other's toast (R15).
  key?: string;
};

export const UNDO_KEY_LIMIT = 50;

// Remembers the toast of a key and keeps only the most recent keys. A key that
// comes again moves to the end.
export function rememberToastKey(
  map: Map<string, ToastId>,
  key: string,
  id: ToastId,
): void {
  map.delete(key);
  map.set(key, id);
  while (map.size > UNDO_KEY_LIMIT) {
    const oldest = map.keys().next();
    if (oldest.done) break;
    map.delete(oldest.value);
  }
}

// A reversible action happens at once and offers Undo for as long as the Toast
// of TOKI-013 shows it (5000 ms, D-069). This helper adds no timer of its own.
export function useUndo(): { run: (args: UndoRun) => Promise<UndoOutcome> } {
  const toasts = useToasts();
  const { t } = useTranslation();
  const { ensureOnline } = useOnlineGate();

  // `run` keeps its identity and holds no state of the component that called it,
  // so the latest values live in a ref and an Undo outlives that component (R16).
  const latest = useRef({ toasts, t, ensureOnline });
  // Written on commit, not during render, so a render that React discards
  // cannot change what `run` uses.
  useLayoutEffect(() => {
    latest.current = { toasts, t, ensureOnline };
  });
  const keys = useRef(new Map<string, ToastId>());
  // The number of the latest call of each key, taken when `run` is called. The
  // call that started last owns the key, whatever order the requests finish in.
  const calls = useRef(new Map<string, number>());
  const counter = useRef(0);

  const run = useCallback((args: UndoRun): Promise<UndoOutcome> => {
    const row = (
      actionPatterns as Record<string, { pattern: string } | undefined>
    )[args.action];
    if (row?.pattern !== "undo") {
      throw new Error(
        `useUndo: "${args.action}" has the pattern "${row?.pattern ?? "unknown"}" in actionPatterns, not "undo"`,
      );
    }
    return runChecked(args);
  }, []);

  // Everything before the first await runs inside the call to `run`.
  async function runChecked({
    text,
    perform,
    undo,
    key,
  }: UndoRun): Promise<UndoOutcome> {
    const { ensureOnline } = latest.current;
    if (!ensureOnline()) return "blocked";
    const mine = ++counter.current;
    if (key !== undefined) rememberToastKey(calls.current, key, mine);

    try {
      await perform();
    } catch {
      const { toasts, t } = latest.current;
      toasts.show({ text: t("common.error.actionFailed") });
      return "failed";
    }

    const { toasts, t } = latest.current;
    // A later call with the same key has started: its state is the current one,
    // so an Undo for this older call would reverse the wrong thing (R15).
    if (key !== undefined && calls.current.get(key) !== mine) return "done";
    const earlier = key === undefined ? undefined : keys.current.get(key);
    if (earlier !== undefined) toasts.dismiss(earlier);

    const onPress = async () => {
      const { toasts, t, ensureOnline } = latest.current;
      if (key !== undefined) keys.current.delete(key);
      // The button is already spent, so the text says what is true: the action
      // stays done (D-079).
      if (!ensureOnline("undo")) return;
      try {
        await undo();
      } catch {
        toasts.show({ text: t("common.error.undoFailed") });
      }
    };

    try {
      const id = toasts.show({
        text,
        action: { label: t("common.undo"), onPress: () => void onPress() },
      });
      if (key !== undefined) rememberToastKey(keys.current, key, id);
    } catch {
      // The action itself worked; only its toast could not be shown.
    }
    return "done";
  }

  return { run };
}
