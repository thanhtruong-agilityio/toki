import { createContext, useContext, useRef, type ReactNode } from "react";

// What one session of the signed-in app has seen (R21, R32). `seen` holds every conversation id the
// store held while ready, `memberChecked` the ids for which `onMember` already ran. They live in a
// provider above the route and the layout, so both share them and a remount of either (StrictMode)
// does not lose them; `clear` empties both at every reset of the store.
export type SessionSets = {
  seen: Set<string>;
  memberChecked: Set<string>;
  clear(): void;
};

const SessionSetsContext = createContext<SessionSets | null>(null);

export function SessionSetsProvider({ children }: { children?: ReactNode }) {
  const sets = useRef<SessionSets>(null);
  if (sets.current === null) {
    const seen = new Set<string>();
    const memberChecked = new Set<string>();
    sets.current = {
      seen,
      memberChecked,
      clear() {
        seen.clear();
        memberChecked.clear();
      },
    };
  }
  return (
    <SessionSetsContext.Provider value={sets.current}>
      {children}
    </SessionSetsContext.Provider>
  );
}

export function useSessionSets(): SessionSets {
  const sets = useContext(SessionSetsContext);
  if (sets === null) {
    throw new Error("useSessionSets needs a SessionSetsProvider above it");
  }
  return sets;
}
