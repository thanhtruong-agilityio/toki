import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ToastRegion } from "./ToastRegion";
import type { ToastAction } from "./Toast";
import { TOAST_MAX, TOAST_MS_PLAIN, TOAST_MS_WITH_ACTION } from "./toastPlace";

export type ToastId = number;
export type ToastItem = { id: ToastId; text: string; action?: ToastAction };
export type ToastApi = {
  // Adds a toast at once and returns its id.
  show: (toast: { text: string; action?: ToastAction }) => ToastId;
  // Removes a toast; nothing happens for an id that is not shown.
  dismiss: (id: ToastId) => void;
};
export type HoldKind = "pointer" | "focus";
type Hold = (id: ToastId, kind: HoldKind, on: boolean) => void;

// Three contexts (Design, Toast): the stable api, the list that only the
// region reads, and the stable internals the region needs.
const ApiContext = createContext<ToastApi | null>(null);
const ListContext = createContext<ToastItem[]>([]);
const HoldContext = createContext<Hold | null>(null);

type Entry = {
  ms: number;
  handle: ReturnType<typeof setTimeout> | undefined;
  pointer: boolean;
  focus: boolean;
};

export function ToastProvider({ children }: { children?: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const entries = useRef(new Map<ToastId, Entry>());
  const nextId = useRef(1);

  const stable = useMemo(() => {
    const remove = (id: ToastId) => {
      const entry = entries.current.get(id);
      if (!entry) return;
      clearTimeout(entry.handle);
      entries.current.delete(id);
      setItems((list) => list.filter((item) => item.id !== id));
    };
    const start = (id: ToastId, entry: Entry) => {
      entry.handle = setTimeout(() => remove(id), entry.ms);
    };
    const show: ToastApi["show"] = ({ text, action }) => {
      // The cap: the oldest leaves, and its onPress is not called (R25).
      while (entries.current.size >= TOAST_MAX) {
        remove(entries.current.keys().next().value!);
      }
      const id = nextId.current++;
      const entry: Entry = {
        ms: action ? TOAST_MS_WITH_ACTION : TOAST_MS_PLAIN,
        handle: undefined,
        pointer: false,
        focus: false,
      };
      entries.current.set(id, entry);
      start(id, entry);
      setItems((list) => [...list, { id, text, action }]);
      return id;
    };
    // The timer stops while the pointer is over the toast or focus is inside
    // it, and starts again with the full time when neither holds it (R23).
    const hold: Hold = (id, kind, on) => {
      const entry = entries.current.get(id);
      if (!entry) return;
      const was = entry.pointer || entry.focus;
      entry[kind] = on;
      const now = entry.pointer || entry.focus;
      if (!was && now) {
        clearTimeout(entry.handle);
        entry.handle = undefined;
      } else if (was && !now) {
        start(id, entry);
      }
    };
    return { api: { show, dismiss: remove } as ToastApi, hold };
  }, []);

  useEffect(() => {
    const live = entries.current;
    return () => {
      live.forEach((entry) => clearTimeout(entry.handle));
      live.clear();
    };
  }, []);

  return (
    <ApiContext.Provider value={stable.api}>
      <HoldContext.Provider value={stable.hold}>
        <ListContext.Provider value={items}>
          {children}
          <ToastRegion />
        </ListContext.Provider>
      </HoldContext.Provider>
    </ApiContext.Provider>
  );
}

export function useToasts(): ToastApi {
  const api = useContext(ApiContext);
  if (!api) throw new Error("useToasts must be used inside a ToastProvider");
  return api;
}

// For the region only.
export function useToastList(): {
  items: ToastItem[];
  api: ToastApi;
  hold: Hold;
} {
  const api = useContext(ApiContext);
  const hold = useContext(HoldContext);
  const items = useContext(ListContext);
  if (!api || !hold) {
    throw new Error("ToastRegion must be used inside a ToastProvider");
  }
  return { items, api, hold };
}
