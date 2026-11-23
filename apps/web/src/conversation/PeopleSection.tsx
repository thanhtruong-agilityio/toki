import { useTranslation } from "@toki/i18n/react";
import type { BootstrapPerson } from "@toki/shared";
import { Avatar, Field, Tag } from "@toki/ui-web";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { useConversationSelector } from "../conversation-list/use-conversations";
import { personHue } from "../people/person-hue";
import { ReadFailed } from "./ReadFailed";
import { compareByName, useChannelMembers } from "./useChannelMembers";
import { useConversation } from "./useConversation";

// The window of the screen (D-109): 50 rows, and 50 more each time the panel body is scrolled to
// within 100 px of its end. It is not the size of a request.
const WINDOW = 50;
const NEAR_END = 100;

export type PeopleSlots = {
  heading: ReactNode;
  row: (person: BootstrapPerson) => ReactNode;
  dialogs: ReactNode;
};

// The seam that TOKI-100 uses to add Add people and Remove under Members (R13).
export type PeopleControls = ComponentType<{
  conversationId: string;
  members: {
    ids: string[];
    status: "loading" | "ready" | "failed";
    reload: () => Promise<void>;
    clearSearch: () => void;
  };
  children: (slots: PeopleSlots) => ReactNode;
}>;

const NO_SLOTS: PeopleSlots = {
  heading: null,
  row: () => null,
  dialogs: null,
};

function Row({
  person,
  slot,
}: {
  person: BootstrapPerson;
  slot: (person: BootstrapPerson) => ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="mrow">
      <div className="mrow-main">
        <Avatar
          name={person.displayName}
          hue={personHue(person.id)}
          size={32}
        />
        <b>{person.displayName}</b>
        {person.status === "deactivated" && (
          <Tag>{t("conversation.panel.deactivated")}</Tag>
        )}
      </div>
      {slot(person)}
    </div>
  );
}

// Who is in the conversation (R13): the members of a channel, the people of a group, or the other
// person of a DM.
export function PeopleSection({
  conversationId,
  onNoAccess,
  Controls,
}: {
  conversationId: string;
  onNoAccess: () => void;
  Controls?: PeopleControls;
}) {
  const { t } = useTranslation();
  const { entry, memberCount } = useConversation(conversationId);
  const userId = useConversationSelector((s) => s.getUser()?.id);
  const people = useConversationSelector((s) => s.getState().people);
  // An id with no entry is an archived channel (R30): it is read as a channel.
  const isChannel = entry === undefined || entry.kind === "channel";
  const isDm = entry?.kind === "dm";
  const members = useChannelMembers(conversationId, onNoAccess, isChannel);

  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(WINDOW);
  const ref = useRef<HTMLElement>(null);
  const clearSearch = () => setQuery("");

  useEffect(() => setShown(WINDOW), [query]);
  // `SidePanel` gives no ref, so the scroll box is the panel's own `.sb` (R13, concern 8 (n)).
  useEffect(() => {
    const box = ref.current?.closest(".sb");
    if (!box) return;
    const onScroll = () => {
      if (box.scrollHeight - box.scrollTop - box.clientHeight < NEAR_END) {
        setShown((n) => n + WINDOW);
      }
    };
    box.addEventListener("scroll", onScroll);
    return () => box.removeEventListener("scroll", onScroll);
  }, []);

  const all = useMemo<BootstrapPerson[]>(() => {
    if (isChannel) return members.rows;
    const ids = entry?.memberIds?.filter((id) => !isDm || id !== userId) ?? [];
    return ids
      .map((id) => people[id])
      .filter((p): p is BootstrapPerson => p !== undefined)
      .sort(compareByName);
  }, [isChannel, isDm, members.rows, entry, userId, people]);

  const needle = query.trim().toLowerCase();
  const matching = useMemo(
    () =>
      needle === ""
        ? all
        : all.filter((p) => p.displayName.toLowerCase().includes(needle)),
    [all, needle],
  );
  const visible = matching.slice(0, shown);
  const searchable = isChannel || !isDm ? all.length > WINDOW : false;

  const count = isChannel ? (memberCount ?? members.ids.length) : all.length;
  const heading = isDm
    ? t("conversation.panel.person")
    : t("conversation.panel.members", { count });

  const body = (slots: PeopleSlots) => (
    <>
      <h3>{heading}</h3>
      {slots.heading}
      {searchable && (
        <Field
          variant="search"
          type="search"
          aria-label={t("conversation.panel.membersSearch")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      )}
      {isChannel && members.status === "loading" ? (
        <p className="sm muted">{t("conversation.panel.membersLoading")}</p>
      ) : isChannel && members.status === "failed" ? (
        <ReadFailed
          error={members.error}
          onRetry={() => void members.reload()}
        />
      ) : matching.length === 0 && needle !== "" ? (
        <div className="dp-empty">{t("conversation.panel.membersNone")}</div>
      ) : (
        <div>
          {visible.map((person) => (
            <Row key={person.id} person={person} slot={slots.row} />
          ))}
        </div>
      )}
      {slots.dialogs}
    </>
  );

  if (Controls !== undefined && isChannel) {
    return (
      <section ref={ref}>
        <Controls
          conversationId={conversationId}
          members={{
            ids: members.ids,
            status: members.status,
            reload: members.reload,
            clearSearch,
          }}
        >
          {body}
        </Controls>
      </section>
    );
  }
  return <section ref={ref}>{body(NO_SLOTS)}</section>;
}
