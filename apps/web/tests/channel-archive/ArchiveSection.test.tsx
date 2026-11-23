// @vitest-environment jsdom
import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DetailsPanel } from "../../src/conversation/DetailsPanel";
import { setConnectionCheck } from "../../src/patterns/online";
import {
  detail,
  http,
  useFakeApi,
  type FakeApiHarness,
} from "../support/conversation-api";
import { mountConversation } from "../support/conversation-mount";
import {
  channel,
  dm,
  person,
  workspaceBody,
} from "../support/conversation-store";

vi.mock("../../src/client", async () =>
  (await import("../support/conversation-store")).clientModule(),
);

let h: FakeApiHarness;
const onNoAccess = vi.fn();
const FAILED = "That did not work. Try again.";

async function setup(role: "member" | "admin" = "admin") {
  onNoAccess.mockReset();
  const body = workspaceBody(
    [
      channel("c1", "design"),
      channel("c2", "leadership", { isPrivate: true }),
      channel("gen", "general", { isGeneral: true }),
      dm("d1", "p1"),
      { ...dm("g1", "p1"), kind: "group_dm", memberIds: ["me", "p1", "p2"] },
    ] as never,
    [person("p1", "Alex"), person("p2", "Thu")],
  );
  body.user = { ...body.user, role };
  h = useFakeApi(body, {
    details: [
      detail("c1", "design", { memberCount: 3 }),
      detail("c2", "leadership", { isPrivate: true, memberCount: 3 }),
      detail("gen", "general", { isGeneral: true, memberCount: 9 }),
    ],
  });
  await h.loadNow();
}

const open = async (id: string, path = `/c/${id}?panel=details`) =>
  mountConversation(
    (cid) => <DetailsPanel conversationId={cid} onNoAccess={onNoAccess} />,
    { path },
  );

const archiveButton = () =>
  screen.queryByRole("button", {
    name: "Archive channel",
  }) as HTMLButtonElement | null;
const dialog = () => document.querySelector(".cfm") as HTMLElement | null;
const flush = () => act(async () => {});
const press = async () => {
  fireEvent.click(archiveButton()!);
  await flush();
};
const confirm = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Archive" }));
  await flush();
};
const buttons = () =>
  screen.queryAllByRole("button").map((b) => b.textContent?.trim() ?? "");

beforeEach(() => setConnectionCheck(null));
afterEach(() => setConnectionCheck(null));

describe("where Archive is offered (R8)", () => {
  test.each([["c1"], ["c2"]])(
    "an Admin member sees it in div.dp-archive with the default variant (%s)",
    async (id) => {
      await setup();
      await open(id);
      await flush();
      const button = archiveButton()!;
      expect(button).toBeInTheDocument();
      expect(button.className).toBe("btn archive");
      expect(button.parentElement?.className).toBe("dp-archive");
      expect(button.closest("section")).toBeNull();
    },
  );

  test("it sits after Settings and before Leave, which stays last", async () => {
    await setup();
    await open("c1");
    await flush();
    const all = buttons();
    const at = all.indexOf("Archive channel");
    expect(at).toBeGreaterThan(-1);
    expect(all[at + 1]).toBe("Leave channel");
    expect(all[all.length - 1]).toBe("Leave channel");
  });

  test("a Member does not see it", async () => {
    await setup("member");
    await open("c1");
    await flush();
    expect(archiveButton()).toBeNull();
  });

  test.each([["admin"], ["member"]] as const)(
    "#general has none for a %s",
    async (role) => {
      await setup(role);
      await open("gen");
      await flush();
      expect(archiveButton()).toBeNull();
    },
  );

  test("a DM and a group have none", async () => {
    await setup();
    await open("d1");
    await flush();
    expect(archiveButton()).toBeNull();
    document.body.innerHTML = "";
    await open("g1");
    await flush();
    expect(archiveButton()).toBeNull();
  });

  test("there is none while no detail is held, and it appears when the detail arrives", async () => {
    await setup();
    let release: () => void = () => {};
    h.api.channels.get.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ channel: h.details["c1"] });
        }),
    );
    await open("c1");
    await flush();
    expect(archiveButton()).toBeNull();
    release();
    await flush();
    expect(archiveButton()).toBeInTheDocument();
  });
});

describe("nothing deletes a channel (R12)", () => {
  test.each([["admin"], ["member"]] as const)(
    "the buttons of the panel for a %s hold no delete action",
    async (role) => {
      await setup(role);
      await open("c1");
      await flush();
      for (const text of buttons())
        expect(text).not.toMatch(/delete|remove channel/i);
      const extra = role === "admin" ? ["Archive channel"] : ([] as string[]);
      expect(buttons().filter((text) => /archive/i.test(text))).toEqual(extra);
    },
  );
});

describe("the press (R9)", () => {
  beforeEach(() => setup());

  test("opens the confirmation with the target and the count, and calls nothing yet", async () => {
    await open("c1");
    await flush();
    await press();
    expect(h.api.channels.archive).not.toHaveBeenCalled();
    expect(dialog()).toHaveTextContent("Archive this channel?");
    expect(dialog()!.querySelector(".cfm-target strong")).toHaveTextContent(
      "#design",
    );
    expect(dialog()!.querySelector(".cfm-text")?.textContent).toContain(
      "3 members can still read its history.",
    );
    expect(screen.getByRole("button", { name: "Archive" }).className).toContain(
      "danger",
    );
  });

  test("one member reads in the singular", async () => {
    h.details["c1"] = { ...h.details["c1"], memberCount: 1 } as never;
    await open("c1");
    await flush();
    await press();
    expect(dialog()!.querySelector(".cfm-text")?.textContent).toContain(
      "1 member can still read",
    );
  });

  test("the count is the fresh read, not the one held", async () => {
    await open("c1");
    await flush();
    h.details["c1"] = { ...h.details["c1"], memberCount: 25 } as never;
    await press();
    expect(dialog()!.querySelector(".cfm-text")?.textContent).toContain(
      "25 members",
    );
  });

  test("a failed read uses the held count", async () => {
    h.details["c1"] = { ...h.details["c1"], memberCount: 7 } as never;
    await open("c1");
    await flush();
    h.api.channels.get.mockRejectedValueOnce(http(500));
    await press();
    expect(dialog()!.querySelector(".cfm-text")?.textContent).toContain(
      "7 members",
    );
  });

  test("the button is disabled with aria-busy while the read runs, and a second press opens one dialog", async () => {
    await open("c1");
    await flush();
    let release: () => void = () => {};
    h.api.channels.get.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ channel: h.details["c1"] });
        }),
    );
    fireEvent.click(archiveButton()!);
    await flush();
    expect(archiveButton()).toBeDisabled();
    expect(archiveButton()).toHaveAttribute("aria-busy", "true");
    fireEvent.click(archiveButton()!);
    release();
    await flush();
    expect(document.querySelectorAll(".cfm")).toHaveLength(1);
    expect(archiveButton()).not.toBeDisabled();
  });

  test.each([
    [
      "Cancel",
      () => fireEvent.click(screen.getByRole("button", { name: "Cancel" })),
    ],
    ["Esc", () => fireEvent.keyDown(document, { key: "Escape" })],
    [
      "an outside press",
      () => {
        const scrim = document.querySelector(".scrim") as HTMLElement;
        fireEvent.pointerDown(scrim);
        fireEvent.pointerUp(scrim);
      },
    ],
  ])("%s changes nothing and returns focus to the button", async (_n, act_) => {
    await open("c1");
    await flush();
    await press();
    act(() => act_());
    await flush();
    expect(dialog()).toBeNull();
    expect(h.api.channels.archive).not.toHaveBeenCalled();
    expect(h.store.hasConversation("c1")).toBe(true);
    expect(document.activeElement).toBe(archiveButton());
  });

  test("offline: the dialog stays and nothing is sent", async () => {
    await open("c1");
    await flush();
    await press();
    setConnectionCheck(() => false);
    await confirm();
    expect(h.api.channels.archive).not.toHaveBeenCalled();
    expect(dialog()).not.toBeNull();
    expect(screen.getByText(/You are offline/)).toBeInTheDocument();
  });
});

describe("Confirm (R10, R11)", () => {
  beforeEach(() => setup());

  async function toConfirm() {
    await open("c1");
    await flush();
    await press();
  }

  test("calls archive once, shows one plain toast with no Undo and the store drops the entry", async () => {
    await toConfirm();
    await confirm();
    expect(h.api.channels.archive).toHaveBeenCalledOnce();
    expect(screen.getByText("Archived #design")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    expect(h.store.hasConversation("c1")).toBe(false);
    expect(h.store.getChannelDetail("c1")?.archived).toBe(true);
    expect(dialog()).toBeNull();
  });

  test("a double press of Archive in the dialog sends one request", async () => {
    await toConfirm();
    let release: () => void = () => {};
    h.api.channels.archive.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ channel: h.details["c1"], changed: true });
        }),
    );
    const go = screen.getByRole("button", { name: "Archive" });
    fireEvent.click(go);
    fireEvent.click(go);
    await flush();
    expect(h.api.channels.archive).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    release();
    await flush();
  });

  test("403 (no longer an Admin): the dialog closes and onNoAccess is called once", async () => {
    await toConfirm();
    h.api.channels.archive.mockRejectedValueOnce(http(403));
    await confirm();
    expect(dialog()).toBeNull();
    expect(onNoAccess).toHaveBeenCalledOnce();
  });

  test("409 (a stale screen): reads the channel, closes, one failure toast", async () => {
    await toConfirm();
    h.api.channels.get.mockClear();
    h.api.channels.archive.mockRejectedValueOnce(
      http(409, "channel_is_general"),
    );
    await confirm();
    expect(h.api.channels.get).toHaveBeenCalledWith("c1");
    expect(dialog()).toBeNull();
    expect(screen.getAllByText(FAILED)).toHaveLength(1);
    expect(onNoAccess).not.toHaveBeenCalled();
  });

  test("a 500 keeps the dialog open, busy off, with the failure toast", async () => {
    await toConfirm();
    h.api.channels.archive.mockRejectedValueOnce(http(500));
    await confirm();
    expect(dialog()).not.toBeNull();
    expect(screen.getByRole("button", { name: "Archive" })).not.toBeDisabled();
    expect(screen.getAllByText(FAILED)).toHaveLength(1);
  });

  test("the panel survives the render after a success (no throw, no dialog left)", async () => {
    await toConfirm();
    await confirm();
    expect(document.querySelectorAll(".cfm")).toHaveLength(0);
  });
});
