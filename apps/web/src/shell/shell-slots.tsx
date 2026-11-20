import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

// The side panel slot (R26). A page that owns the panel passes a new `content` node at every render,
// so the node never goes through React state that the layout route reads: the provider keeps only
// `{ owner, label }` as state, and the content goes through a small store (a ref and listeners) that
// `PanelOutlet` subscribes to.
export type PanelState = { owner: object; label: string };
export type ShellPanel = { label: string; content: ReactNode };

type Store = {
  activate(owner: object): void;
  write(owner: object, content: ReactNode): void;
  release(owner: object): void;
  subscribe(listener: () => void): () => void;
  snapshot(): ReactNode;
};

type Slots = {
  claim(owner: object, label: string): void;
  unclaim(owner: object): void;
  store: Store;
};

function createStore(): Store {
  const listeners = new Set<() => void>();
  const contents = new Map<object, ReactNode>();
  let active: object | null = null;
  let shown: ReactNode = null;
  const publish = () => {
    const next = active === null ? null : (contents.get(active) ?? null);
    if (next === shown) return;
    shown = next;
    for (const listener of [...listeners]) listener();
  };
  return {
    activate(owner) {
      active = owner;
      publish();
    },
    write(owner, content) {
      contents.set(owner, content);
      publish();
    },
    release(owner) {
      contents.delete(owner);
      if (active === owner) active = null;
      publish();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    snapshot: () => shown,
  };
}

const SlotsContext = createContext<Slots | null>(null);
const StateContext = createContext<PanelState | null>(null);

export function ShellSlotsProvider({ children }: { children?: ReactNode }) {
  const [state, setState] = useState<PanelState | null>(null);
  const store = useRef<Store>(null);
  store.current ??= createStore();
  const claim = useCallback((owner: object, label: string) => {
    setState((prev) =>
      prev !== null && prev.owner === owner && prev.label === label
        ? prev
        : { owner, label },
    );
  }, []);
  const unclaim = useCallback((owner: object) => {
    setState((prev) => (prev !== null && prev.owner === owner ? null : prev));
  }, []);
  const slots = useMemo<Slots>(
    () => ({ claim, unclaim, store: store.current! }),
    [claim, unclaim],
  );
  return (
    <SlotsContext.Provider value={slots}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </SlotsContext.Provider>
  );
}

// What the layout route reads: who owns the panel and its name, or null when no one does.
export function useShellPanelState(): PanelState | null {
  return useContext(StateContext);
}

// The one stable element the layout route gives the shell as its panel.
export function PanelOutlet() {
  const slots = useContext(SlotsContext);
  const noop = useMemo(() => () => () => {}, []);
  const content = useSyncExternalStore(
    slots?.store.subscribe ?? noop,
    slots?.store.snapshot ?? (() => null),
    () => null,
  );
  return <>{content}</>;
}

// Sets the panel for as long as the caller is mounted; `null` clears it; the last call wins.
export function useShellPanel(panel: ShellPanel | null): void {
  const slots = useContext(SlotsContext);
  const owner = useRef<object>({});
  const isSet = panel !== null;
  const label = panel?.label;
  const content = panel?.content;

  useLayoutEffect(() => {
    if (!slots || !isSet) return;
    const who = owner.current;
    slots.store.activate(who);
    return () => slots.store.release(who);
  }, [slots, isSet]);
  // Every render: the content is written, and it never reaches React state.
  useLayoutEffect(() => {
    if (slots && isSet) slots.store.write(owner.current, content);
  });
  useEffect(() => {
    if (!slots || !isSet || label === undefined) return;
    const who = owner.current;
    slots.claim(who, label);
    return () => slots.unclaim(who);
  }, [slots, isSet, label]);
}
