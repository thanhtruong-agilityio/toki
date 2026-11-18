import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
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

// What the layout tells the region (R28, R31): the elements that toasts stay
// above, the area they are centred in, and a way to hear that one changed.
type Registry = {
  register: (
    kind: "avoid" | "anchor",
    ref: RefObject<HTMLElement | null>,
  ) => () => void;
  subscribe: (listener: () => void) => () => void;
  // Stops the ResizeObserver; the provider calls it when it unmounts.
  disconnect: () => void;
  read: () => {
    avoid: RefObject<HTMLElement | null>[];
    anchors: RefObject<HTMLElement | null>[];
  };
};
const RegistryContext = createContext<Registry | null>(null);

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

  const registry = useMemo<Registry>(() => {
    const avoid: RefObject<HTMLElement | null>[] = [];
    const anchors: RefObject<HTMLElement | null>[] = [];
    const listeners = new Set<() => void>();
    const notify = () => listeners.forEach((listener) => listener());
    let observer: ResizeObserver | undefined;
    return {
      register(kind, ref) {
        const list = kind === "avoid" ? avoid : anchors;
        const el = ref.current;
        list.push(ref);
        // A size change, and a move by `transform`, which changes no size
        // and so fires no ResizeObserver (R28 a, e).
        if (el) {
          if (typeof ResizeObserver !== "undefined") {
            observer ??= new ResizeObserver(notify);
            observer.observe(el);
          }
          el.addEventListener("transitionend", notify);
          el.addEventListener("transitioncancel", notify);
        }
        notify();
        return () => {
          list.splice(list.indexOf(ref), 1);
          if (el) {
            observer?.unobserve(el);
            el.removeEventListener("transitionend", notify);
            el.removeEventListener("transitioncancel", notify);
          }
          notify();
        };
      },
      subscribe(listener) {
        listeners.add(listener);
        return () => void listeners.delete(listener);
      },
      read: () => ({ avoid, anchors }),
      disconnect: () => observer?.disconnect(),
    };
  }, []);

  useEffect(() => {
    const live = entries.current;
    return () => {
      live.forEach((entry) => clearTimeout(entry.handle));
      live.clear();
      registry.disconnect();
    };
  }, [registry]);

  return (
    <ApiContext.Provider value={stable.api}>
      <HoldContext.Provider value={stable.hold}>
        <RegistryContext.Provider value={registry}>
          <ListContext.Provider value={items}>
            {children}
            <ToastRegion />
          </ListContext.Provider>
        </RegistryContext.Provider>
      </HoldContext.Provider>
    </ApiContext.Provider>
  );
}

export function useToasts(): ToastApi {
  const api = useContext(ApiContext);
  if (!api) throw new Error("useToasts must be used inside a ToastProvider");
  return api;
}

// The element of `ref` is one that toasts must stay above, while the calling
// component is mounted (R28). With no ToastProvider above it does nothing.
export function useToastAvoid(ref: RefObject<HTMLElement | null>): void {
  const registry = useContext(RegistryContext);
  useEffect(() => registry?.register("avoid", ref), [registry, ref]);
}

// The element of `ref` is the area that toasts are centred in; the last one
// registered wins (R31). With no ToastProvider above it does nothing.
export function useToastAnchor(ref: RefObject<HTMLElement | null>): void {
  const registry = useContext(RegistryContext);
  useEffect(() => registry?.register("anchor", ref), [registry, ref]);
}

// For the region only.
export function useToastList(): {
  items: ToastItem[];
  api: ToastApi;
  hold: Hold;
  registry: Registry;
} {
  const api = useContext(ApiContext);
  const hold = useContext(HoldContext);
  const registry = useContext(RegistryContext);
  const items = useContext(ListContext);
  if (!api || !hold || !registry) {
    throw new Error("ToastRegion must be used inside a ToastProvider");
  }
  return { items, api, hold, registry };
}
