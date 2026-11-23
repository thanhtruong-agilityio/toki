import { createContext, useContext, type ReactNode } from "react";

// The panel's `onNoAccess` (the shared page of D-131), which the `Controls` contract of
// `PeopleSection` does not carry. `DetailsPanel` wraps the section in this provider.
const NoAccessContext = createContext<() => void>(() => {});

export function NoAccessProvider({
  onNoAccess,
  children,
}: {
  onNoAccess: () => void;
  children: ReactNode;
}) {
  return (
    <NoAccessContext.Provider value={onNoAccess}>
      {children}
    </NoAccessContext.Provider>
  );
}

export function useNoAccess(): () => void {
  return useContext(NoAccessContext);
}
