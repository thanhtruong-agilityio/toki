import { createElement } from "react";
import { vi } from "vitest";

// A fake `membership/deps.ts` (R2): people, the signed-in person and the channel name are plain data
// that a test changes; the two requests and the store's two reads are spies. The picker and the
// hue are the real ones (the mock factory takes them from the real module).
export type FakePerson = {
  id: string;
  displayName: string;
  status: "active" | "deactivated";
};

export const fake = {
  people: [] as FakePerson[],
  userId: "me" as string | undefined,
  role: "admin" as string | null,
  channelName: "design",
  entry: undefined as unknown,
  detail: undefined as unknown,
  addMembers: vi.fn(),
  removeMember: vi.fn(),
  refresh: vi.fn(),
  readChannel: vi.fn(),
  // The props the dialog gave the picker at its last render.
  pickerProps: null as null | Record<string, unknown>,
};

export function makePeople(n: number): FakePerson[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    displayName: `Person ${String(i + 1).padStart(3, "0")}`,
    status: "active" as const,
  }));
}

export function resetFake() {
  fake.people = [
    { id: "me", displayName: "Me Myself", status: "active" },
    ...makePeople(4),
  ];
  fake.userId = "me";
  fake.role = "admin";
  fake.channelName = "design";
  fake.entry = {
    kind: "channel",
    isPrivate: false,
    isGeneral: false,
  };
  fake.detail = { archived: false };
  fake.addMembers.mockReset();
  fake.addMembers.mockResolvedValue({ added: [], alreadyMembers: [] });
  fake.removeMember.mockReset();
  fake.removeMember.mockResolvedValue({ changed: true });
  fake.refresh.mockReset();
  fake.refresh.mockResolvedValue(undefined);
  fake.readChannel.mockReset();
  fake.readChannel.mockResolvedValue(undefined);
  fake.pickerProps = null;
}

export async function fakeDepsModule() {
  const { PeoplePicker } =
    await import("../../../src/features/people/PeoplePicker");
  const { personHue } = await import("../../../src/people/person-hue");
  const { ApiError, classifyApiError } = await import("@toki/client-core");
  return {
    api: {
      channels: {
        addMembers: (...a: unknown[]) => fake.addMembers(...a),
        removeMember: (...a: unknown[]) => fake.removeMember(...a),
      },
    },
    conversations: {
      refresh: () => fake.refresh(),
      readChannel: (id: string) => fake.readChannel(id),
      getPeople: () => fake.people,
    },
    ApiError,
    classifyApiError,
    PeoplePicker: (props: Record<string, unknown>) => {
      fake.pickerProps = props;
      return createElement(PeoplePicker as never, props);
    },
    personHue,
    useConversationSelector: () => undefined,
    usePeople: () => fake.people,
    useCurrentUserId: () => fake.userId,
    useCurrentRole: () => fake.role,
    useChannelName: () => fake.channelName,
    useConversationEntry: () => fake.entry,
    useChannelDetail: () => fake.detail,
    useCurrentUser: () =>
      fake.userId === undefined
        ? undefined
        : { id: fake.userId, role: fake.role },
  };
}
