// @vitest-environment jsdom
import { act, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { setConnectionCheck } from "../../src/patterns/online";
import { useConversationSettings } from "../../src/conversation/useConversationSettings";
import {
  http,
  useFakeApi,
  type FakeApiHarness,
} from "../support/conversation-api";
import { channel, dm, workspaceBody } from "../support/conversation-store";
import { Providers } from "../support/providers";

vi.mock("../../src/client", async () =>
  (await import("../support/conversation-store")).clientModule(),
);

let h: FakeApiHarness;

beforeEach(async () => {
  h = useFakeApi(
    workspaceBody([
      channel("c1", "project-launch", { notificationLevel: "mentions" }),
      dm("d1", "p1"),
    ]),
  );
  await h.loadNow();
});
afterEach(() => setConnectionCheck(null));

const setup = (id = "c1", onNoAccess = vi.fn()) => ({
  onNoAccess,
  ...renderHook(() => useConversationSettings(id, onNoAccess), {
    wrapper: Providers,
  }),
});

describe("useConversationSettings (R19)", () => {
  test("values are the entry's level, mute and star", () => {
    const { result } = setup();
    expect(result.current.values).toEqual({
      notificationLevel: "mentions",
      isMuted: false,
      isStarred: false,
    });
    expect(result.current.pending).toEqual({});
  });

  test("a DM entry holds its own values", () => {
    expect(setup("d1").result.current.values.notificationLevel).toBe("all");
  });

  test("save with one key calls saveSettings once with that object and the entry changes after the answer", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.save({ notificationLevel: "none" });
    });
    expect(h.api.conversations.saveSettings).toHaveBeenCalledTimes(1);
    expect(h.api.conversations.saveSettings).toHaveBeenCalledWith("c1", {
      notificationLevel: "none",
    });
    expect(result.current.values.notificationLevel).toBe("none");
    expect(result.current.pending).toEqual({});
  });

  test("the value does not change before the answer, and only the pressed control is pending", async () => {
    let release!: () => void;
    h.api.conversations.saveSettings.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () =>
            resolve({
              settings: {
                notificationLevel: "mentions",
                isMuted: true,
                isStarred: false,
              },
              changed: true,
            });
        }),
    );
    const { result } = setup();
    let done!: Promise<unknown>;
    act(() => {
      done = result.current.save({ isMuted: true });
    });
    expect(result.current.values.isMuted).toBe(false);
    expect(result.current.pending).toEqual({ isMuted: true });
    await act(async () => {
      release();
      await done;
    });
    expect(result.current.values.isMuted).toBe(true);
    expect(result.current.pending).toEqual({});
  });

  test("two quick presses on one control make one call", async () => {
    let release!: () => void;
    h.api.conversations.saveSettings.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () =>
            resolve({
              settings: {
                notificationLevel: "mentions",
                isMuted: false,
                isStarred: true,
              },
              changed: true,
            });
        }),
    );
    const { result } = setup();
    let first!: Promise<unknown>;
    act(() => {
      first = result.current.save({ isStarred: true });
      void result.current.save({ isStarred: true });
    });
    expect(h.api.conversations.saveSettings).toHaveBeenCalledTimes(1);
    await act(async () => {
      release();
      await first;
    });
  });

  test("a reject leaves the entry as it was, clears pending and shows the one failure toast", async () => {
    h.api.conversations.saveSettings.mockRejectedValueOnce(http(500));
    const { result, onNoAccess } = setup();
    await act(async () => {
      await result.current.save({ isStarred: true });
    });
    expect(result.current.values.isStarred).toBe(false);
    expect(result.current.pending).toEqual({});
    expect(screen.getAllByText("That did not work. Try again.")).toHaveLength(
      1,
    );
    expect(onNoAccess).not.toHaveBeenCalled();
  });

  test("no_access (403, 404) goes to onNoAccess and shows no toast", async () => {
    h.api.conversations.saveSettings.mockRejectedValueOnce(http(403));
    const { result, onNoAccess } = setup();
    await act(async () => {
      await result.current.save({ isMuted: true });
    });
    expect(onNoAccess).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("That did not work. Try again.")).toBeNull();
  });

  test("offline: nothing is called, the value stays and one toast explains", async () => {
    setConnectionCheck(() => false);
    const { result } = setup();
    await act(async () => {
      await result.current.save({ isMuted: true });
    });
    expect(h.api.conversations.saveSettings).not.toHaveBeenCalled();
    expect(result.current.values.isMuted).toBe(false);
    expect(screen.getByText(/You are offline/)).toBeInTheDocument();
  });

  test("an id with no entry has no values to show", () => {
    const { result } = setup("nope");
    expect(result.current.values).toEqual({
      notificationLevel: "all",
      isMuted: false,
      isStarred: false,
    });
  });
});
