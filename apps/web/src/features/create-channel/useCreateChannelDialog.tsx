import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type RefObject,
} from "react";
import { CreateChannelDialog } from "./CreateChannelDialog";
import { useCurrentRole, useOpenConversation } from "./deps";

export type OpenOptions = { returnFocusRef?: RefObject<HTMLElement | null> };

// The open state of the dialog and the dialog itself, for a screen to render
// beside its own markup (R4). `CreateChannelButton` is built on it.
export function useCreateChannelDialog({
  onCreated,
}: { onCreated?: (id: string) => void } = {}): {
  open: (options?: OpenOptions) => void;
  element: ReactElement | null;
} {
  const role = useCurrentRole();
  const isAdmin = role === "admin";
  const openConversation = useOpenConversation();
  const [isOpen, setIsOpen] = useState(false);
  const returnFocusRef = useRef<RefObject<HTMLElement | null> | undefined>(
    undefined,
  );
  const adminRef = useRef(isAdmin);
  adminRef.current = isAdmin;
  const mounted = useRef(false);
  const latestOnCreated = useRef(onCreated);
  latestOnCreated.current = onCreated;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // A role that stops being admin closes the dialog, so it is not open again if
  // the role comes back.
  useEffect(() => {
    if (!isAdmin) setIsOpen(false);
  }, [isAdmin]);

  const open = useCallback((options?: OpenOptions) => {
    if (!adminRef.current) return;
    returnFocusRef.current = options?.returnFocusRef;
    setIsOpen(true);
  }, []);

  // `onCreated` is called only while the owner is mounted, so a page that was
  // left during the wait gets no call on a state that is gone (R12).
  const created = useCallback((id: string) => {
    if (mounted.current) latestOnCreated.current?.(id);
  }, []);

  const element = isAdmin ? (
    <CreateChannelDialog
      open={isOpen}
      onClose={() => setIsOpen(false)}
      onCreated={created}
      onOpenConversation={openConversation}
      returnFocusRef={returnFocusRef.current}
    />
  ) : null;

  return { open, element };
}
