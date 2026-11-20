import { vi } from "vitest";
import { useSyncExternalStore } from "react";

// A fake `deps.ts` for the tests of the screens (R3): the role, the signed-in
// person and the people are plain data that a test changes, and the store's
// `createChannel` and `refresh` are spies. The stand-in picker is the real one.
export type Person = {
  id: string;
  displayName: string;
  role: "member" | "admin";
  status: "active" | "deactivated";
};

export const ADMIN_ID = "admin-1";

export function makePeople(n: number): Person[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    displayName: `Person ${String(i + 1).padStart(3, "0")}`,
    role: "member" as const,
    status: "active" as const,
  }));
}

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

export const fake = {
  role: "admin" as "admin" | "member" | null,
  people: [] as Person[],
  storeError: null as unknown,
  createChannel: vi.fn(),
  refresh: vi.fn(async () => {}),
  newId: vi.fn(),
  opened: vi.fn(),
};

let counter = 0;
export function resetFake() {
  fake.role = "admin";
  fake.people = [
    {
      id: ADMIN_ID,
      displayName: "Admin One",
      role: "admin",
      status: "active",
    },
    ...makePeople(3),
  ];
  fake.storeError = null;
  counter = 0;
  fake.createChannel.mockReset();
  fake.createChannel.mockImplementation(async (body: { id: string }) => ({
    id: body.id,
    created: true,
  }));
  fake.refresh.mockReset();
  fake.refresh.mockImplementation(async () => {});
  fake.newId.mockReset();
  fake.newId.mockImplementation(
    () => `017f22e2-79b0-7cc3-98c4-${String(++counter).padStart(12, "0")}`,
  );
  fake.opened.mockReset();
}

export function change(update: () => void) {
  update();
  for (const listener of [...listeners]) listener();
}

export async function makeDepsMock() {
  const core = await import("@toki/client-core");
  const standIn =
    await import("../../../src/features/create-channel/PeoplePickerStandIn");
  const use = <T,>(read: () => T) => useSyncExternalStore(subscribe, read);
  return {
    ApiError: core.ApiError,
    classifyApiError: core.classifyApiError,
    PeoplePicker: standIn.PeoplePicker,
    personHue: () => 7,
    newId: (...args: []) => fake.newId(...args),
    conversations: {
      createChannel: (body: unknown) => fake.createChannel(body),
      refresh: () => fake.refresh(),
      getState: () => ({ error: fake.storeError }),
      getPeople: () => fake.people,
    },
    useCurrentRole: () => use(() => fake.role),
    useCurrentUserId: () => ADMIN_ID,
    usePeople: () => use(() => fake.people),
    useOpenConversation: () => (id: string) => fake.opened(id),
  };
}
