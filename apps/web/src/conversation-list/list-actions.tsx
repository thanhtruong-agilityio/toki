import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

// The registry of the two openers the list draws controls for (R25). TOKI-034 mounts the dialogs and
// registers the openers; this ticket mounts no dialog and holds no open state.
export type ListAction = (options?: {
  returnFocusRef?: RefObject<HTMLElement | null>;
}) => void;

type Name = "browseChannels" | "startDirect";
type Actions = { browseChannels?: ListAction; startDirect?: ListAction };

const NAMES: readonly Name[] = ["browseChannels", "startDirect"];

type Registry = {
  register(name: Name, owner: object, call: ListAction): void;
  unregister(name: Name, owner: object): void;
};

const RegistryContext = createContext<Registry | null>(null);
const ActionsContext = createContext<Actions>({});

export function ListActionsProvider({ children }: { children?: ReactNode }) {
  // The latest registration per name, kept out of React state: only which names are registered is state.
  const held = useRef<
    Partial<Record<Name, { owner: object; call: ListAction }>>
  >({});
  const [registered, setRegistered] = useState<Record<Name, boolean>>({
    browseChannels: false,
    startDirect: false,
  });
  const sync = useCallback(() => {
    const next = {
      browseChannels: held.current.browseChannels !== undefined,
      startDirect: held.current.startDirect !== undefined,
    };
    setRegistered((prev) =>
      prev.browseChannels === next.browseChannels &&
      prev.startDirect === next.startDirect
        ? prev
        : next,
    );
  }, []);

  const registry = useMemo<Registry>(
    () => ({
      register(name, owner, call) {
        held.current[name] = { owner, call };
        sync();
      },
      unregister(name, owner) {
        // Only when it is still the registered one: a later registration stays.
        if (held.current[name]?.owner === owner) {
          delete held.current[name];
          sync();
        }
      },
    }),
    [sync],
  );

  // Stable wrappers that call the latest function given.
  const wrappers = useMemo<Record<Name, ListAction>>(
    () => ({
      browseChannels: (options) => held.current.browseChannels?.call(options),
      startDirect: (options) => held.current.startDirect?.call(options),
    }),
    [],
  );
  const actions = useMemo<Actions>(() => {
    const value: Actions = {};
    for (const name of NAMES)
      if (registered[name]) value[name] = wrappers[name];
    return value;
  }, [registered, wrappers]);

  return (
    <RegistryContext.Provider value={registry}>
      <ActionsContext.Provider value={actions}>
        {children}
      </ActionsContext.Provider>
    </RegistryContext.Provider>
  );
}

// The openers that are registered now; a name is missing while none is registered.
export function useListActions(): Actions {
  return useContext(ActionsContext);
}

function useRegisterOne(
  name: Name,
  present: boolean,
  latest: RefObject<Actions | null>,
): void {
  const registry = useContext(RegistryContext);
  const owner = useRef<object>({});
  useEffect(() => {
    if (!registry || !present) return;
    const who = owner.current;
    registry.register(name, who, (options) =>
      latest.current?.[name]?.(options),
    );
    return () => registry.unregister(name, who);
  }, [registry, present, name, latest]);
}

// Registers the given openers while the caller is mounted; `null` or a missing name removes it. The
// functions may change at every render: the latest one is called.
export function useRegisterListActions(actions: Actions | null): void {
  const latest = useRef(actions);
  useEffect(() => {
    latest.current = actions;
  });
  useRegisterOne(
    "browseChannels",
    actions?.browseChannels !== undefined,
    latest,
  );
  useRegisterOne("startDirect", actions?.startDirect !== undefined, latest);
}
