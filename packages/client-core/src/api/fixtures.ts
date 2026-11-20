// Made-up bodies of the answers the client reads, shared by its tests. Parsed
// with the strict schemas of @toki/shared in the tests, so a change of the
// contract fails here.
import type {
  BootstrapResponse,
  ChannelDetail,
  ChannelSummary,
} from "@toki/shared";

export const id = (n: number) =>
  `01930b7e-7a53-7c2e-9f1a-${String(n).padStart(12, "0")}`;

export const ME = id(1);

export function bootstrapBody(): BootstrapResponse {
  return {
    user: {
      id: ME,
      email: "ada@example.com",
      displayName: "Ada",
      role: "admin",
      language: "en",
    },
    workspace: { id: id(90), name: "Acme" },
    members: [
      { id: ME, displayName: "Ada", role: "admin", status: "active" },
      { id: id(2), displayName: "Alex Phạm", role: "member", status: "active" },
      { id: id(3), displayName: "Thu Hoàng", role: "member", status: "active" },
      { id: id(4), displayName: "Dee", role: "member", status: "deactivated" },
    ],
    conversations: [
      {
        id: id(10),
        kind: "channel",
        name: "general",
        topic: null,
        isPrivate: false,
        isGeneral: true,
        notificationLevel: "mentions",
        isMuted: false,
        isStarred: false,
        memberIds: null,
      },
      {
        id: id(11),
        kind: "channel",
        name: "project-launch",
        topic: "Roadmap",
        isPrivate: false,
        isGeneral: false,
        notificationLevel: "all",
        isMuted: false,
        isStarred: true,
        memberIds: null,
      },
      {
        id: id(12),
        kind: "channel",
        name: "secret-plan",
        topic: null,
        isPrivate: true,
        isGeneral: false,
        notificationLevel: "none",
        isMuted: true,
        isStarred: false,
        memberIds: null,
      },
      {
        id: id(20),
        kind: "dm",
        name: null,
        topic: null,
        isPrivate: true,
        isGeneral: false,
        notificationLevel: "all",
        isMuted: false,
        isStarred: true,
        memberIds: [ME, id(2)],
      },
      {
        id: id(21),
        kind: "dm",
        name: null,
        topic: null,
        isPrivate: true,
        isGeneral: false,
        notificationLevel: "all",
        isMuted: false,
        isStarred: false,
        memberIds: [ME, id(4)],
      },
      {
        id: id(22),
        kind: "group_dm",
        name: null,
        topic: null,
        isPrivate: true,
        isGeneral: false,
        notificationLevel: "all",
        isMuted: false,
        isStarred: false,
        memberIds: [ME, id(2), id(3)],
      },
    ],
    eventNumber: 41,
  };
}

export const summaryBody = (n = 11): ChannelSummary => ({
  id: id(n),
  name: "project-launch",
  topic: "Roadmap",
  isPrivate: false,
  isGeneral: false,
  archived: false,
  memberCount: 5,
  isMember: true,
});

export const detailBody = (n = 11): ChannelDetail => ({
  ...summaryBody(n),
  description: "Everything about the launch",
  createdBy: ME,
  createdAt: "2026-02-01T00:00:00.000Z",
});
