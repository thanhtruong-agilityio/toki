import type { IconName } from "@toki/ui-web";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
  type MouseEvent,
  type ReactNode,
} from "react";

// The registry of the entries of the account menu (R3). Each ticket registers
// its own entry from a component that is mounted while the entry applies, so
// the menu never shows an entry whose ticket is not built.

export const accountEntryIds = [
  "setStatus",
  "pause",
  "focus",
  "preferences",
  "signOut",
] as const;
export type AccountEntryId = (typeof accountEntryIds)[number];

export type AccountItem = {
  id?: string;
  label: string;
  icon?: IconName;
  variant?: "default" | "danger";
  disabled?: boolean;
  onSelect: (event: MouseEvent<HTMLElement>) => void;
};
export type AccountGroup = {
  id: string;
  heading: string;
  items: AccountItem[];
};
export type AccountEntry = AccountItem | AccountGroup;

const groupIds: readonly AccountEntryId[] = ["pause", "focus"];
const isGroup = (entry: AccountEntry): entry is AccountGroup =>
  "items" in entry && Array.isArray(entry.items);
// `pause` and `focus` are groups, the other three are items.
const fits = (id: AccountEntryId, entry: AccountEntry) =>
  groupIds.includes(id) === isGroup(entry);

type Slot = { token: symbol; entry: AccountEntry };
type Store = {
  set(id: AccountEntryId, token: symbol, entry: AccountEntry): void;
  remove(id: AccountEntryId, token: symbol): void;
  subscribe(listener: () => void): () => void;
  snapshot(): readonly AccountEntry[];
};

function createStore(): Store {
  const slots = new Map<AccountEntryId, Slot>();
  const listeners = new Set<() => void>();
  let cached: readonly AccountEntry[] = [];
  const rebuild = () => {
    cached = accountEntryIds.flatMap((id) => {
      const slot = slots.get(id);
      return slot ? [slot.entry] : [];
    });
    for (const listener of [...listeners]) listener();
  };
  return {
    set(id, token, entry) {
      slots.set(id, { token, entry });
      rebuild();
    },
    remove(id, token) {
      // Only the registration that is still the current one removes.
      if (slots.get(id)?.token !== token) return;
      slots.delete(id);
      rebuild();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    snapshot: () => cached,
  };
}

const StoreContext = createContext<Store | null>(null);
const noEntries: readonly AccountEntry[] = [];

export function AccountEntriesProvider({ children }: { children: ReactNode }) {
  const ref = useRef<Store | null>(null);
  ref.current ??= createStore();
  return (
    <StoreContext.Provider value={ref.current}>
      {children}
    </StoreContext.Provider>
  );
}

// The entries in the fixed order, whatever the order of registration.
export function useAccountEntries(): readonly AccountEntry[] {
  const store = useContext(StoreContext);
  return useSyncExternalStore(
    store ? store.subscribe : noopSubscribe,
    store ? store.snapshot : () => noEntries,
    () => noEntries,
  );
}
const noopSubscribe = () => () => {};

// What the menu needs to redraw: every field but the functions.
function signature(entry: AccountEntry): string {
  const plain = (item: AccountItem) => [
    item.id,
    item.label,
    item.icon,
    item.variant,
    item.disabled === true,
  ];
  return JSON.stringify(
    isGroup(entry)
      ? [entry.id, entry.heading, entry.items.map(plain)]
      : plain(entry),
  );
}

// Registers `entry` for as long as the caller is mounted; `null` removes it.
// For one id the last registration wins. The entry kept in the registry holds
// stable wrappers that call the latest `onSelect` given, so a caller that
// passes a new function on every render does not redraw the menu.
export function useRegisterAccountEntry(
  id: AccountEntryId,
  entry: AccountEntry | null,
): void {
  const store = useContext(StoreContext);
  const latest = useRef(entry);
  latest.current = entry;
  const key = entry && fits(id, entry) ? signature(entry) : null;

  useEffect(() => {
    const current = latest.current;
    if (!store || key === null || !current) return;
    const token = Symbol(id);
    const call = (event: MouseEvent<HTMLElement>, index?: number) => {
      const now = latest.current;
      if (!now) return;
      if (index === undefined) {
        if (!isGroup(now)) now.onSelect(event);
      } else if (isGroup(now)) {
        now.items[index]?.onSelect(event);
      }
    };
    const wrapped: AccountEntry = isGroup(current)
      ? {
          ...current,
          items: current.items.map((item, index) => ({
            ...item,
            onSelect: (event) => call(event, index),
          })),
        }
      : { ...current, onSelect: (event) => call(event) };
    store.set(id, token, wrapped);
    return () => store.remove(id, token);
  }, [store, id, key]);
}
