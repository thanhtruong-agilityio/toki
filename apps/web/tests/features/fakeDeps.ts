import { vi } from "vitest";

// A fake `deps.ts` for the screens of TOKI-034 (R2): the people, the signed-in person and the store's
// commands are data and spies that a test changes. The real `ApiError` stays real.
export type FakePerson = {
  id: string;
  displayName: string;
  status: "active" | "deactivated";
  role: "member" | "admin";
};

export const ME = "me";

export const fake = {
  people: [] as FakePerson[],
  userId: ME as string | undefined,
  openDirect: vi.fn(),
  joinChannel: vi.fn(),
  readChannel: vi.fn(),
  refresh: vi.fn(async () => {}),
  hasConversation: vi.fn<(id: string) => boolean>(() => false),
  list: vi.fn(),
};

export function makePeople(n: number): FakePerson[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    displayName: `Person ${String(i + 1).padStart(3, "0")}`,
    status: "active" as const,
    role: "member" as const,
  }));
}

export function resetFake() {
  fake.people = [
    { id: ME, displayName: "Me Myself", status: "active", role: "member" },
    ...makePeople(5),
  ];
  fake.userId = ME;
  fake.openDirect.mockReset();
  fake.openDirect.mockImplementation(async () => ({ id: "c1", created: true }));
  fake.joinChannel.mockReset();
  fake.joinChannel.mockImplementation(async () => {});
  fake.readChannel.mockReset();
  fake.refresh.mockClear();
  fake.hasConversation.mockReset();
  fake.hasConversation.mockImplementation(() => false);
  fake.list.mockReset();
}

export async function makeDepsMock() {
  const actual = await vi.importActual<
    typeof import("../../src/features/deps")
  >("../../src/features/deps");
  return {
    ...actual,
    usePeople: () => fake.people,
    useCurrentUserId: () => fake.userId,
    personHue: (id: string) => id.length * 7,
    conversations: {
      openDirect: (ids: string[]) => fake.openDirect(ids),
      joinChannel: (id: string) => fake.joinChannel(id),
      readChannel: (id: string) => fake.readChannel(id),
      refresh: () => fake.refresh(),
      hasConversation: (id: string) => fake.hasConversation(id),
    },
    api: { channels: { list: (q: unknown) => fake.list(q) } },
  };
}
