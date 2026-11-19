import { afterEach, describe, expect, it, vi } from "vitest";
import {
  onMemberChanged,
  publishMemberChanged,
  type MemberChange,
} from "../../src/modules/members/events.js";

const event: MemberChange = {
  kind: "role_changed",
  actorId: "actor-1",
  targetId: "target-1",
  before: { role: "member", status: "active" },
  after: { role: "admin", status: "active" },
  at: new Date("2026-01-01T00:00:00.000Z"),
};

const stops: Array<() => void> = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
});
const listen = (listener: (e: MemberChange) => void) => {
  stops.push(onMemberChanged(listener));
};

describe("onMemberChanged (R40)", () => {
  it("calls every listener once with the event", () => {
    const a = vi.fn();
    const b = vi.fn();
    listen(a);
    listen(b);
    publishMemberChanged(event, { error: vi.fn() });
    expect(a).toHaveBeenCalledTimes(1);
    expect(a).toHaveBeenCalledWith(event);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("stops calling a listener that was removed", () => {
    const a = vi.fn();
    const stop = onMemberChanged(a);
    stop();
    publishMemberChanged(event, { error: vi.fn() });
    expect(a).not.toHaveBeenCalled();
  });

  it("logs a listener that throws, with the kind and the two ids only, and calls the next", () => {
    const error = vi.fn();
    const b = vi.fn();
    listen(() => {
      throw new Error("listener failed");
    });
    listen(b);
    expect(() => publishMemberChanged(event, { error })).not.toThrow();
    expect(b).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0]![0]).toEqual({
      kind: "role_changed",
      actorId: "actor-1",
      targetId: "target-1",
    });
  });
});
