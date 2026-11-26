import type { Page, Route } from "@playwright/test";
import { stubBootstrap } from "./bootstrap";
import { uuid, type Workspace } from "./fixtures";

// The app's data made as the prototype's sample workspace (TOKI-141): Hugepig Studio, 8 people and
// the conversations of `freshData()` in e2e/prototype/index.html that Lan is in, so that a screen of
// the app is not different from the prototype only because of other names. The prototype has more
// than the contract carries (job titles, presence, unread counts): those are not here. Fake data only.
const P = {
  lan: uuid(1),
  minh: uuid(2),
  alex: uuid(3),
  sam: uuid(4),
  thu: uuid(5),
  khoa: uuid(6),
  mai: uuid(7),
  jordan: uuid(8),
} as const;
export const LAUNCH = uuid(101);

type Chan = {
  id: string;
  name: string;
  topic: string;
  desc: string;
  by: keyof typeof P;
  created: string;
  members: (keyof typeof P)[];
  priv?: boolean;
  notif?: "all" | "mentions";
  starred?: boolean;
};
const CHANNELS: Chan[] = [
  {
    id: uuid(100),
    name: "general",
    topic: "Company-wide announcements and general chat",
    desc: "Everything that concerns the whole studio. Keep it friendly and keep it short.",
    by: "lan",
    created: "2026-01-08",
    members: ["lan", "minh", "alex", "sam", "thu", "khoa", "mai", "jordan"],
  },
  {
    id: LAUNCH,
    name: "project-launch",
    topic: "Everything for the 1.0 launch: checklist, builds, announcement",
    desc: "The working room for the launch. Decisions get pinned. Daily Meet when we are close.",
    by: "lan",
    created: "2026-09-02",
    members: ["lan", "minh", "alex", "sam", "thu", "khoa", "mai", "jordan"],
    starred: true,
  },
  {
    id: uuid(102),
    name: "mobile-release",
    topic: "TestFlight builds, store review, release notes",
    desc: "Builds, crashes and store submissions for iOS and Android.",
    by: "minh",
    created: "2026-09-14",
    members: ["lan", "minh", "alex", "khoa", "jordan"],
  },
  {
    id: uuid(103),
    name: "design-crit",
    topic: "Share work in progress and get quick feedback",
    desc: "Post a screen, say what kind of feedback you want, and we respond within the day.",
    by: "sam",
    created: "2026-09-20",
    members: ["lan", "sam", "thu", "mai", "alex"],
    notif: "mentions",
  },
  {
    id: uuid(104),
    name: "dev-infra",
    topic: "Servers, tailnet, certificates, snapshots",
    desc: "Infrastructure notes for the dev environment on the company tailnet.",
    by: "minh",
    created: "2026-10-01",
    members: ["lan", "minh", "khoa"],
  },
  {
    id: uuid(105),
    name: "random",
    topic: "Everything that is not work",
    desc: "Lunch plans, football, music.",
    by: "lan",
    created: "2026-01-08",
    members: ["lan", "minh", "alex", "sam", "thu", "khoa", "mai"],
    notif: "mentions",
  },
  {
    id: uuid(106),
    name: "client-saigon-coffee",
    topic: "Pilot rollout with Saigon Coffee Co.",
    desc: "Shared with our client for the pilot.",
    by: "thu",
    created: "2026-11-09",
    members: ["lan", "thu", "minh"],
    priv: true,
  },
  {
    id: uuid(107),
    name: "reading-club",
    topic: "One book a month, chat on Fridays",
    desc: "Optional. Pick up any time.",
    by: "sam",
    created: "2026-03-04",
    members: ["minh", "sam", "mai"],
    notif: "mentions",
  },
  {
    id: uuid(108),
    name: "leadership",
    topic: "Private: hiring, budget, roadmap",
    desc: "Only the three of us.",
    by: "lan",
    created: "2026-02-03",
    members: ["lan", "minh", "thu"],
    priv: true,
  },
];

const person = (id: string, displayName: string, role: "member" | "admin") => ({
  id,
  displayName,
  role,
  status: "active" as const,
});

export function world(): Workspace {
  const mine = CHANNELS.filter((c) => c.members.includes("lan"));
  const dm = (
    id: number,
    others: string[],
    kind: "dm" | "group_dm" = "dm",
  ) => ({
    id: uuid(id),
    kind,
    name: null,
    topic: null,
    isPrivate: true,
    isGeneral: false,
    notificationLevel: "all" as const,
    isMuted: false,
    isStarred: false,
    memberIds: [P.lan, ...others],
  });
  return {
    user: {
      id: P.lan,
      email: "lan@example.com",
      displayName: "Lan Nguyễn",
      role: "admin",
      language: "en",
    },
    workspace: { id: uuid(90), name: "Hugepig Studio" },
    members: [
      person(P.lan, "Lan Nguyễn", "admin"),
      person(P.minh, "Minh Trần", "admin"),
      person(P.alex, "Alex Phạm", "member"),
      person(P.sam, "Sam Lê", "member"),
      person(P.thu, "Thu Hoàng", "member"),
      person(P.khoa, "Khoa Đỗ", "member"),
      person(P.mai, "Mai Vũ", "member"),
      person(P.jordan, "Jordan Davis", "member"),
    ],
    conversations: [
      ...mine.map((c) => ({
        id: c.id,
        kind: "channel" as const,
        name: c.name,
        topic: null,
        isPrivate: !!c.priv,
        isGeneral: c.name === "general",
        notificationLevel: c.notif ?? ("all" as const),
        isMuted: false,
        isStarred: !!c.starred,
        memberIds: null,
      })),
      dm(110, [P.minh]),
      dm(111, [P.sam]),
      dm(112, [P.jordan]),
      dm(113, [P.alex, P.thu], "group_dm"),
    ],
    eventNumber: 1,
  };
}

const json = (route: Route, body: unknown) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

const summary = (c: Chan) => ({
  id: c.id,
  name: c.name,
  topic: c.topic,
  isPrivate: !!c.priv,
  isGeneral: c.name === "general",
  archived: false,
  memberCount: c.members.length,
  isMember: c.members.includes("lan"),
});

// The calls of the pages that these screens open, answered with the prototype's data. The routes
// registered here answer before the ones of `stubBootstrap`, which handles the rest.
export async function stubWorld(page: Page): Promise<void> {
  await stubBootstrap(page, world);
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/v1", "");
    if (request.method() !== "GET") return route.fallback();
    if (path === "/auth/session") {
      return json(route, { user: world().user });
    }
    if (path === "/auth/sessions") {
      return json(route, {
        sessions: [
          {
            id: "s1",
            current: true,
            deviceKind: "desktop",
            browser: "chrome",
            lastUsedAt: "2026-11-10T10:30:00.000Z",
          },
        ],
      });
    }
    if (path === "/channels") {
      const q = (url.searchParams.get("search") ?? "").toLowerCase();
      return json(route, {
        channels: CHANNELS.filter((c) => !c.priv && c.name.includes(q)).map(
          summary,
        ),
        nextCursor: null,
      });
    }
    const members = /^\/channels\/([^/]+)\/members$/.exec(path);
    if (members) {
      const c = CHANNELS.find((x) => x.id === decodeURIComponent(members[1]!));
      if (!c) return route.fallback();
      return json(route, {
        members: c.members.map((m) => ({
          userId: P[m],
          joinedAt: "2026-09-02T09:00:00.000Z",
        })),
        nextCursor: null,
      });
    }
    const one = /^\/channels\/([^/]+)$/.exec(path);
    if (one) {
      const c = CHANNELS.find((x) => x.id === decodeURIComponent(one[1]!));
      if (!c) return route.fallback();
      return json(route, {
        channel: {
          ...summary(c),
          description: c.desc,
          createdBy: P[c.by],
          createdAt: `${c.created}T09:00:00.000Z`,
        },
      });
    }
    return route.fallback();
  });
}
