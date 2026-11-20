import { useCallback, useRef } from "react";
import { keepsKey } from "./actionOutcome";
import { newId } from "../ids";

// The idempotency keys of the page, one for each id that has a request in doubt (TOKI-025 R20, R22):
// the invite form uses the id "invite", each Resend the id of its invitation. A key is made at the
// first use, sent again by the next press when the earlier attempt ended in a way that may have
// reached the server, and dropped after a success or any other error. So a lost answer never turns
// the retry into a second mail. The keys live in memory and are dropped when the page unmounts.
export function useKeyPerId() {
  const keys = useRef(new Map<string, string>());

  const keyFor = useCallback((id: string): string => {
    let key = keys.current.get(id);
    if (key === undefined) {
      key = newId();
      keys.current.set(id, key);
    }
    return key;
  }, []);

  const drop = useCallback((id: string) => {
    keys.current.delete(id);
  }, []);

  const succeeded = drop;

  const failed = useCallback((id: string, error: unknown) => {
    if (!keepsKey(error)) keys.current.delete(id);
  }, []);

  return { keyFor, succeeded, failed, drop };
}

export type KeyPerId = ReturnType<typeof useKeyPerId>;
