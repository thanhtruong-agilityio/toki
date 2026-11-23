import type { BootstrapPerson } from "@toki/shared";
import { useCallback, useRef, useState } from "react";
import { classifyApiError } from "./deps";

export type RemoveTarget = {
  person: BootstrapPerson;
  returnFocusRef: { current: HTMLElement | null };
};

// The person asked about, read at the press, so a later change of the list does not change the
// dialog's target (R11). One hook for the whole section, not one for each row.
export function useRemoveMember(): {
  target: RemoveTarget | null;
  ask: (person: BootstrapPerson, button: HTMLElement) => void;
  close: () => void;
} {
  const [target, setTarget] = useState<RemoveTarget | null>(null);
  const ref = useRef<HTMLElement | null>(null);
  const ask = useCallback((person: BootstrapPerson, button: HTMLElement) => {
    ref.current = button;
    setTarget({ person, returnFocusRef: ref });
  }, []);
  const close = useCallback(() => setTarget(null), []);
  return { target, ask, close };
}

export type RemoveResult =
  | { kind: "removed" }
  // 409: the screen is stale; the channel and the list are read again (R13).
  | { kind: "stale" }
  // 403 or 404: the shared page of D-131 (R13).
  | { kind: "no_access"; error: unknown }
  | { kind: "silent" }
  // Any other failure: the dialog stays open (R13).
  | { kind: "failed" };

// A plain function: it calls no hook. `ConfirmAction` has already checked the connection (R12).
export async function removePerson(input: {
  conversationId: string;
  userId: string;
  removeMember: (id: string, userId: string) => Promise<{ changed: boolean }>;
}): Promise<RemoveResult> {
  try {
    await input.removeMember(input.conversationId, input.userId);
    return { kind: "removed" };
  } catch (error) {
    switch (classifyApiError(error)) {
      case "fresh_copy":
        return { kind: "stale" };
      case "no_access":
        return { kind: "no_access", error };
      case "unauthenticated":
      case "ignore":
        return { kind: "silent" };
      default:
        return { kind: "failed" };
    }
  }
}
