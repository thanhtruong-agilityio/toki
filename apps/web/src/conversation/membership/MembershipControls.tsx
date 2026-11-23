import type { BootstrapPerson } from "@toki/shared";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AddPeopleButton } from "./AddPeopleButton";
import { AddPeopleDialog } from "./AddPeopleDialog";
import {
  conversations,
  useChannelDetail,
  useChannelName,
  useConversationEntry,
  useCurrentUser,
} from "./deps";
import { membershipOffers } from "./offers";
import { RemoveMemberButton } from "./RemoveMemberButton";
import { RemoveMemberDialog } from "./RemoveMemberDialog";
import { useRemoveMember } from "./useRemoveMember";
import "./membership.css";

export type MembershipSlots = {
  heading: ReactNode;
  row: (person: BootstrapPerson) => ReactNode;
  dialogs: ReactNode;
};

// What `PeopleSection` hands to its `Controls` prop (R16).
export type MembershipControlsProps = {
  conversationId: string;
  members: {
    ids: string[];
    status: "loading" | "ready" | "failed";
    reload: () => Promise<void>;
    clearSearch: () => void;
  };
  children: (slots: MembershipSlots) => ReactNode;
};

export function MembershipControls({
  conversationId,
  members,
  children,
}: MembershipControlsProps) {
  const entry = useConversationEntry(conversationId);
  const detail = useChannelDetail(conversationId);
  const user = useCurrentUser();
  const channel = useChannelName(conversationId);
  const remove = useRemoveMember();
  const [addOpen, setAddOpen] = useState(false);
  const addRef = useRef<HTMLButtonElement>(null);
  const returnRef = useRef<HTMLElement | null>(null);
  const [focusAsk, setFocusAsk] = useState(0);

  const offers = membershipOffers({
    conversation: entry,
    detail,
    actor: user ? { id: user.id, role: user.role } : undefined,
  });

  // Each change gets a read that starts after it: `reload()` reuses a read already running, so the
  // reads are chained and never skipped (R14).
  const pending = useRef<Promise<unknown>>(Promise.resolve());
  const latest = useRef({ members, conversationId });
  latest.current = { members, conversationId };
  const afterChange = useCallback((kind: "add" | "remove") => {
    if (kind === "add") latest.current.members.clearSearch();
    const next = pending.current.then(async () => {
      const { members: m, conversationId: id } = latest.current;
      await Promise.allSettled([m.reload(), conversations.readChannel(id)]);
      setFocusAsk((n) => n + 1);
    });
    pending.current = next;
  }, []);

  // After the reload was drawn: focus goes to "Add people" when focus was lost with a removed row.
  useEffect(() => {
    if (focusAsk === 0) return;
    const active = document.activeElement;
    if (active === null || active === document.body || !active.isConnected) {
      addRef.current?.focus();
    }
  }, [focusAsk]);

  const heading = offers.add ? (
    <div className="mbr-add">
      <AddPeopleButton
        buttonRef={addRef}
        disabled={members.status !== "ready"}
        onOpen={(button) => {
          returnRef.current = button;
          setAddOpen(true);
        }}
      />
    </div>
  ) : null;

  const row = (person: BootstrapPerson) =>
    offers.removeRows && person.id !== user?.id ? (
      <RemoveMemberButton person={person} onAsk={remove.ask} />
    ) : null;

  const dialogs = (
    <>
      {offers.add ? (
        <AddPeopleDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onAdded={() => afterChange("add")}
          conversationId={conversationId}
          memberIds={members.ids}
          returnFocusRef={returnRef}
        />
      ) : null}
      {offers.removeRows ? (
        <RemoveMemberDialog
          conversationId={conversationId}
          channel={channel}
          isPrivate={entry?.kind === "channel" && entry.isPrivate}
          target={remove.target}
          onClose={remove.close}
          onRemoved={() => afterChange("remove")}
        />
      ) : null}
    </>
  );

  return <>{children({ heading, row, dialogs })}</>;
}
