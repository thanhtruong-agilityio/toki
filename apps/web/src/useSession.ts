import { getSessionState, subscribeSession } from "@toki/client-core";
import { useSyncExternalStore } from "react";

// The one binding of the session state to React (R39). The shell, the guard and the account menu read
// the state through this and add no second one.
export function useSession() {
  return useSyncExternalStore(
    subscribeSession,
    getSessionState,
    getSessionState,
  );
}
