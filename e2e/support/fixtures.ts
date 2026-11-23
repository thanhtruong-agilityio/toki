// Made-up workspaces for the browser tests (TOKI-033 R30): plain data in the shape of
// `GET /api/v1/bootstrap`, with no import, so a unit test of apps/web can parse each one with the
// strict schema of packages/shared and a drift of the contract fails there. Fake addresses on
// example.com; every id has the shape of a UUID.

export const uuid = (n: number): string =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

// The person of the session stubs (e2e/support/session.ts, sign-in.ts).
export const ME = uuid(1);
export const GENERAL = uuid(100);

type Person = {
  id: string;
  displayName: string;
  role: "member" | "admin";
  status: "active" | "deactivated";
};

type Entry = {
  id: string;
  kind: "channel" | "dm" | "group_dm";
  name: string | null;
  topic: null;
  isPrivate: boolean;
  isGeneral: boolean;
  notificationLevel: "all" | "mentions" | "nothing";
  isMuted: boolean;
  isStarred: boolean;
  memberIds: string[] | null;
};

export type Workspace = {
  user: {
    id: string;
    email: string;
    displayName: string;
    role: "member" | "admin";
    language: "en" | "vi";
  };
  workspace: { id: string; name: string };
  members: Person[];
  conversations: Entry[];
  eventNumber: number;
};

const ALEX = uuid(2);
const THU = uuid(3);
const NGOC = uuid(4);
const BINH = uuid(5);
const CHI = uuid(6);
const DUNG = uuid(7); // deactivated
const EM = uuid(8);

const people = (): Person[] => [
  { id: ME, displayName: "Ada", role: "member", status: "active" },
  { id: ALEX, displayName: "Alex Phạm", role: "member", status: "active" },
  { id: THU, displayName: "Thu Hoàng", role: "member", status: "active" },
  { id: NGOC, displayName: "Ngọc", role: "member", status: "active" },
  { id: BINH, displayName: "Bình", role: "member", status: "active" },
  { id: CHI, displayName: "Chi", role: "member", status: "active" },
  { id: DUNG, displayName: "Dũng", role: "member", status: "deactivated" },
  { id: EM, displayName: "Em", role: "member", status: "active" },
];

const channel = (
  id: string,
  name: string,
  over: Partial<Entry> = {},
): Entry => ({
  id,
  kind: "channel",
  name,
  topic: null,
  isPrivate: false,
  isGeneral: false,
  notificationLevel: "all",
  isMuted: false,
  isStarred: false,
  memberIds: null,
  ...over,
});

const direct = (id: string, others: string[], over: Partial<Entry> = {}) =>
  ({
    id,
    kind: others.length > 1 ? "group_dm" : "dm",
    name: null,
    topic: null,
    isPrivate: true,
    isGeneral: false,
    notificationLevel: "all",
    isMuted: false,
    isStarred: false,
    memberIds: [ME, ...others],
    ...over,
  }) as Entry;

const body = (conversations: Entry[]): Workspace => ({
  user: {
    id: ME,
    email: "ada@example.com",
    displayName: "Ada",
    role: "member",
    language: "en",
  },
  workspace: { id: uuid(90), name: "Acme Studio" },
  members: people(),
  conversations,
  eventNumber: 1,
});

// Only #general: the sample test (TOKI-008 R11) and the stubs that need no list.
export const generalOnly = (): Workspace =>
  body([channel(GENERAL, "general", { isGeneral: true })]);

// 12 conversations: 6 channels (one private, one starred), 5 direct messages (one with a deactivated
// person, one group of 3), and #general counted among the channels.
export const twelve = (): Workspace =>
  body([
    channel(GENERAL, "general", { isGeneral: true }),
    channel(uuid(101), "design"),
    channel(uuid(102), "random"),
    channel(uuid(103), "launch-plan"),
    channel(uuid(104), "secret-project", { isPrivate: true }),
    channel(uuid(105), "engineering", { isStarred: true }),
    direct(uuid(110), [ALEX]),
    direct(uuid(111), [THU]),
    direct(uuid(112), [NGOC]),
    direct(uuid(113), [DUNG]),
    direct(uuid(114), [BINH, CHI]),
    direct(uuid(115), [EM]),
  ]);

// A name no sidebar row can hold at 360 px, for the ellipsis check of R14.
export const LONG_NAME =
  "a-channel-with-a-name-that-is-much-too-long-for-any-row-of-the-sidebar";

// `count` conversations in all: the twelve and then channels with a number in the name, one in ten
// of them a direct message with a person of the workspace.
function many(count: number): Workspace {
  const base = twelve();
  const others = [ALEX, THU, NGOC, BINH, CHI, EM];
  for (let i = base.conversations.length; i < count; i += 1) {
    base.conversations.push(
      i === 12
        ? channel(uuid(1000 + i), LONG_NAME)
        : i % 10 === 0
          ? direct(uuid(1000 + i), [others[i % others.length]!])
          : channel(uuid(1000 + i), `channel-${String(i).padStart(3, "0")}`),
    );
  }
  return base;
}

export const forty = (): Workspace => many(40);
export const fiveHundred = (): Workspace => many(500);
