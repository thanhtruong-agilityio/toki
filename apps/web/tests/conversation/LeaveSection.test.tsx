// @vitest-environment jsdom
import { ApiError } from "@toki/client-core";
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
let router: Awaited<ReturnType<typeof mountConversation>>;
const onNoAccess = vi.fn();

const FAILED = "That did not work. Try again.";

async function setup(role: "member" | "admin" = "member") {
  onNoAccess.mockReset();
  const body = workspaceBody(
    [
      channel("c1", "project-launch"),
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
      detail("c1", "project-launch", { memberCount: 3 }),
      detail("c2", "leadership", { isPrivate: true, memberCount: 3 }),
      detail("gen", "general", { isGeneral: true, memberCount: 9 }),
      // Archived channels: the store holds no entry for them (R30).
      detail("a1", "old-project", { archived: true, memberCount: 4 }),
      detail("a2", "old-secret", {
        archived: true,
        isPrivate: true,
        memberCount: 4,
      }),
    ],
  });
  await h.loadNow();
}

const open = async (id: string) => {
  router = await mountConversation(
    (cid) => <DetailsPanel conversationId={cid} onNoAccess={onNoAccess} />,
    { path: `/c/${id}?panel=details` },
  );
};

const leaveButton = () =>
  screen.queryByRole("button", {
    name: "Leave channel",
  }) as HTMLButtonElement | null;
const undoButton = () => screen.queryByRole("button", { name: "Undo" });
const dialog = () => document.querySelector(".cfm") as HTMLElement | null;
function outsidePress() {
  const scrim = document.querySelector(".scrim") as HTMLElement;
  fireEvent.pointerDown(scrim);
  fireEvent.pointerUp(scrim);
}
const flush = () => act(async () => {});
async function press() {
  fireEvent.click(leaveButton()!);
  await flush();
}
const confirm = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Leave" }));
  await flush();
};
const setCount = (id: string, count: number) => {
  h.details[id] = { ...h.details[id], memberCount: count } as never;
};
const here = () => router.state.location.href;

beforeEach(() => {
  setConnectionCheck(null);
});
afterEach(() => {
  setConnectionCheck(null);
  vi.useRealTimers();
});

describe("where Leave is offered (R21)", () => {
  test.each([["c1"], ["c2"]])(
    "a public and a private channel have the plain Leave button in div.dp-leave",
    async (id) => {
      await setup();
      await open(id);
      const button = leaveButton()!;
      expect(button).toBeInTheDocument();
      expect(button.className).toBe("btn leave");
      expect(button.parentElement?.className).toBe("dp-leave");
    },
  );

  test.each([["member"], ["admin"]] as const)(
    "#general has none for a %s",
    async (role) => {
      await setup(role);
      await open("gen");
      expect(leaveButton()).toBeNull();
    },
  );

  test("a DM and a group have none", async () => {
    await setup();
    await open("d1");
    expect(leaveButton()).toBeNull();
    document.body.innerHTML = "";
    await open("g1");
    expect(leaveButton()).toBeNull();
  });
});

describe("a public channel with other members (R22)", () => {
  beforeEach(() => setup());

  test("reads the count first and starts only when the read has answered; the button is disabled meanwhile", async () => {
    await open("c1");
    let release: () => void = () => {};
    h.api.channels.get.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ channel: h.details.c1 });
        }),
    );
    await press();
    expect(leaveButton()).toBeDisabled();
    expect(h.api.channels.leave).not.toHaveBeenCalled();
    fireEvent.click(leaveButton()!);
    await flush();
    expect(h.api.channels.get).toHaveBeenCalledTimes(2); // the panel's own read and this one
    await act(async () => release());
    expect(h.api.channels.leave).toHaveBeenCalledTimes(1);
    expect(h.api.channels.leave).toHaveBeenCalledWith("c1");
  });

  test("leaves at once with no dialog and a toast with Undo", async () => {
    await open("c1");
    await press();
    expect(h.api.channels.leave).toHaveBeenCalledTimes(1);
    expect(dialog()).toBeNull();
    expect(screen.getByText("You left #project-launch")).toBeInTheDocument();
    expect(undoButton()).toBeInTheDocument();
  });

  test("Undo before 5000 ms joins once; at 5000 ms Undo is gone and nothing was joined", async () => {
    await open("c1");
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await press();
    act(() => void vi.advanceTimersByTime(4999));
    expect(undoButton()).toBeInTheDocument();
    fireEvent.click(undoButton()!);
    await flush();
    expect(h.api.channels.join).toHaveBeenCalledTimes(1);
    expect(h.api.channels.join.mock.calls[0][0]).toBe("c1");

    document.body.innerHTML = "";
    await setup();
    await open("c1");
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await press();
    act(() => void vi.advanceTimersByTime(5000));
    expect(undoButton()).toBeNull();
    expect(h.api.channels.join).not.toHaveBeenCalled();
  });

  test("it does not navigate: the address is the one it had", async () => {
    await open("c1");
    const before = here();
    await press();
    expect(here()).toBe(before);
  });

  test.each([
    ["404", http(404), false],
    ["409", http(409, "channel_is_general"), true],
    ["403", http(403), false],
    ["500", http(500), false],
    ["timeout", new ApiError({ kind: "timeout" }), false],
  ])(
    "a %s on leave gives one failure toast, no Undo and no move; the channel stays joined",
    async (_n, error, refreshes) => {
      await open("c1");
      const calls = h.bootstrapCalls();
      h.api.channels.leave.mockRejectedValueOnce(error);
      await press();
      expect(screen.getAllByText(FAILED)).toHaveLength(1);
      expect(undoButton()).toBeNull();
      expect(h.store.hasConversation("c1")).toBe(true);
      expect(h.bootstrapCalls()).toBe(refreshes ? calls + 1 : calls);
      expect(onNoAccess).not.toHaveBeenCalled();
      expect(leaveButton()).toBeEnabled();
    },
  );

  test.each([[true], [false]])(
    "an answer with changed %s is a success",
    async (changed) => {
      await open("c1");
      h.api.channels.leave.mockResolvedValueOnce({ changed, archived: false });
      await press();
      expect(undoButton()).toBeInTheDocument();
    },
  );

  test("offline: nothing is left and the offline toast shows", async () => {
    await open("c1");
    setConnectionCheck(() => false);
    await press();
    expect(h.api.channels.leave).not.toHaveBeenCalled();
    expect(screen.getByText(/You are offline/)).toBeInTheDocument();
    expect(undoButton()).toBeNull();
  });

  test("a read that fails goes on as a normal leave", async () => {
    await open("c1");
    h.api.channels.get.mockRejectedValueOnce(http(500));
    await press();
    expect(h.api.channels.leave).toHaveBeenCalledTimes(1);
    expect(dialog()).toBeNull();
    expect(undoButton()).toBeInTheDocument();
  });

  test("a failed read, a leave that was a last member's and a rejected Undo give one failure toast and the channel stays left", async () => {
    await open("c1");
    h.api.channels.get.mockRejectedValueOnce(http(500));
    await press();
    h.api.channels.join.mockRejectedValueOnce(http(404));
    fireEvent.click(undoButton()!);
    await flush();
    expect(screen.getAllByText("Could not undo. Try again.")).toHaveLength(1);
    expect(h.store.hasConversation("c1")).toBe(false);
  });

  test("a second press while a leave runs is ignored", async () => {
    await open("c1");
    let release: () => void = () => {};
    h.api.channels.leave.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ changed: true, archived: false });
        }),
    );
    await press();
    fireEvent.click(leaveButton()!);
    await flush();
    expect(h.api.channels.leave).toHaveBeenCalledTimes(1);
    await act(async () => release());
  });
});

describe("a private channel (R23)", () => {
  beforeEach(() => setup());

  test("opens ConfirmAction after the read, with the title, the target and the invite line, and calls nothing yet", async () => {
    await open("c2");
    await press();
    expect(h.api.channels.leave).not.toHaveBeenCalled();
    expect(dialog()).toHaveTextContent("Leave this channel?");
    expect(dialog()!.querySelector(".cfm-target strong")).toHaveTextContent(
      "#leadership",
    );
    expect(dialog()!.querySelector(".cfm-text")?.textContent).toBe(
      "A member will have to invite you back.",
    );
    expect(screen.getByRole("button", { name: "Leave" }).className).toContain(
      "danger",
    );
    expect(undoButton()).toBeNull();
  });

  test.each([
    [
      "Cancel",
      () => fireEvent.click(screen.getByRole("button", { name: "Cancel" })),
    ],
    ["Esc", () => fireEvent.keyDown(document, { key: "Escape" })],
    ["an outside press", () => outsidePress()],
  ])("%s leaves the person a member and calls nothing", async (_n, act_) => {
    await open("c2");
    await press();
    act(() => act_());
    await flush();
    expect(dialog()).toBeNull();
    expect(h.api.channels.leave).not.toHaveBeenCalled();
    expect(h.store.hasConversation("c2")).toBe(true);
    expect(leaveButton()).toBeInTheDocument();
  });

  test("Confirm calls leave once, the buttons are disabled while it runs, and there is never an Undo", async () => {
    await open("c2");
    await press();
    let release: () => void = () => {};
    h.api.channels.leave.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ changed: true, archived: false });
        }),
    );
    await confirm();
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    await flush();
    expect(h.api.channels.leave).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Leave" })).toBeDisabled();
    await act(async () => release());
    expect(dialog()).toBeNull();
    expect(undoButton()).toBeNull();
    expect(h.store.hasConversation("c2")).toBe(false);
  });

  test("a failure leaves the dialog open with busy off, one toast, and the command can be sent again", async () => {
    await open("c2");
    await press();
    h.api.channels.leave.mockRejectedValueOnce(http(500));
    await confirm();
    expect(dialog()).not.toBeNull();
    expect(screen.getAllByText(FAILED)).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Leave" })).toBeEnabled();
    await confirm();
    expect(h.api.channels.leave).toHaveBeenCalledTimes(2);
    expect(dialog()).toBeNull();
  });

  test("offline: the dialog stays open and nothing is called", async () => {
    await open("c2");
    await press();
    setConnectionCheck(() => false);
    await confirm();
    expect(h.api.channels.leave).not.toHaveBeenCalled();
    expect(dialog()).not.toBeNull();
  });

  test("a 404 is a success here: the store is refreshed, the dialog closes and no toast shows", async () => {
    await open("c2");
    await press();
    const calls = h.bootstrapCalls();
    h.api.channels.leave.mockRejectedValueOnce(http(404));
    await confirm();
    expect(h.bootstrapCalls()).toBe(calls + 1);
    expect(dialog()).toBeNull();
    expect(screen.queryByText(FAILED)).toBeNull();
  });

  test("a 409 refreshes the store and shows one toast; the dialog stays", async () => {
    await open("c2");
    await press();
    const calls = h.bootstrapCalls();
    h.api.channels.leave.mockRejectedValueOnce(http(409));
    await confirm();
    expect(h.bootstrapCalls()).toBe(calls + 1);
    expect(screen.getAllByText(FAILED)).toHaveLength(1);
    expect(dialog()).not.toBeNull();
  });

  test("a 403 applies the no-access rule", async () => {
    await open("c2");
    await press();
    h.api.channels.leave.mockRejectedValueOnce(http(403));
    await confirm();
    expect(onNoAccess).toHaveBeenCalledTimes(1);
  });

  test.each([[true], [false]])(
    "an answer with changed %s closes the dialog",
    async (changed) => {
      await open("c2");
      await press();
      h.api.channels.leave.mockResolvedValueOnce({ changed, archived: false });
      await confirm();
      expect(dialog()).toBeNull();
    },
  );

  test("it does not navigate", async () => {
    await open("c2");
    const before = here();
    await press();
    await confirm();
    expect(here()).toBe(before);
  });
});

describe("the last member (R24)", () => {
  beforeEach(() => setup());
  const LAST = "You are the last member. The channel will be archived.";
  const INVITE = "A member will have to invite you back.";

  test("a private channel of 1 shows both lines, and of 2 only the invite line", async () => {
    setCount("c2", 1);
    await open("c2");
    await press();
    expect(dialog()!.querySelector(".cfm-text")?.textContent).toBe(
      `${INVITE} ${LAST}`,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await flush();
    setCount("c2", 2);
    await press();
    expect(dialog()!.querySelector(".cfm-text")?.textContent).toBe(INVITE);
  });

  test("the count of the fresh read counts, not the held one", async () => {
    setCount("c2", 2);
    await open("c2");
    await act(async () => void (await h.store.readChannel("c2")));
    expect(h.store.getMemberCount("c2")).toBe(2);
    setCount("c2", 1);
    await press();
    expect(dialog()!.querySelector(".cfm-text")?.textContent).toBe(
      `${INVITE} ${LAST}`,
    );
  });

  test("a failed fresh read of a private channel opens the dialog with the invite line only", async () => {
    await open("c2");
    h.api.channels.get.mockRejectedValueOnce(http(500));
    await press();
    expect(dialog()!.querySelector(".cfm-text")?.textContent).toBe(INVITE);
  });

  test("the button is disabled while the read runs and a second press starts one flow", async () => {
    await open("c2");
    let release: () => void = () => {};
    h.api.channels.get.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ channel: h.details.c2 });
        }),
    );
    await press();
    expect(leaveButton()).toBeDisabled();
    fireEvent.click(leaveButton()!);
    await act(async () => release());
    expect(document.querySelectorAll(".cfm")).toHaveLength(1);
  });

  test("a public channel of 1 opens the dialog with the last-member line only: no invite, no Undo, no toast", async () => {
    setCount("c1", 1);
    await open("c1");
    await press();
    expect(h.api.channels.leave).not.toHaveBeenCalled();
    expect(dialog()!.querySelector(".cfm-text")?.textContent).toBe(LAST);
    expect(dialog()!.querySelector(".cfm-target strong")).toHaveTextContent(
      "#project-launch",
    );
    expect(dialog()).toHaveTextContent("Leave this channel?");
    expect(undoButton()).toBeNull();
    await confirm();
    expect(h.api.channels.leave).toHaveBeenCalledTimes(1);
    expect(undoButton()).toBeNull();
    expect(screen.queryByText("You left #project-launch")).toBeNull();
    expect(dialog()).toBeNull();
  });

  test.each([
    [
      "Cancel",
      () => fireEvent.click(screen.getByRole("button", { name: "Cancel" })),
    ],
    ["Esc", () => fireEvent.keyDown(document, { key: "Escape" })],
    ["an outside press", () => outsidePress()],
  ])("a public last-member dialog: %s changes nothing", async (_n, act_) => {
    setCount("c1", 1);
    await open("c1");
    await press();
    act(() => act_());
    await flush();
    expect(dialog()).toBeNull();
    expect(h.api.channels.leave).not.toHaveBeenCalled();
    expect(h.store.hasConversation("c1")).toBe(true);
  });

  test("a failure of the public last-member leave keeps the dialog open; a 404 is a failure here", async () => {
    setCount("c1", 1);
    await open("c1");
    await press();
    h.api.channels.leave.mockRejectedValueOnce(http(404));
    await confirm();
    expect(dialog()).not.toBeNull();
    expect(screen.getAllByText(FAILED)).toHaveLength(1);
    expect(h.store.hasConversation("c1")).toBe(true);
  });

  test("a public channel with 2 is left at once as in R22", async () => {
    setCount("c1", 2);
    await open("c1");
    await press();
    expect(dialog()).toBeNull();
    expect(undoButton()).toBeInTheDocument();
  });

  test("no flow shows a confirmation and an Undo together", async () => {
    for (const [id, count] of [
      ["c1", 1],
      ["c1", 2],
      ["c2", 1],
      ["c2", 3],
    ] as const) {
      document.body.innerHTML = "";
      await setup();
      setCount(id, count);
      await open(id);
      await press();
      if (dialog()) await confirm();
      expect(dialog() !== null && undoButton() !== null).toBe(false);
      expect(!(dialog() !== null) || undoButton() === null).toBe(true);
    }
  });
});

describe("an archived channel (R30)", () => {
  beforeEach(() => setup());

  test("Leave is enabled at once and no count is read on the press", async () => {
    await open("a1");
    const reads = h.api.channels.get.mock.calls.length;
    expect(leaveButton()).toBeEnabled();
    await press();
    expect(h.api.channels.get.mock.calls.length).toBe(reads);
    expect(h.api.channels.leave).toHaveBeenCalledTimes(1);
  });

  test("a public archived channel is left with Undo, with the toast of R22", async () => {
    await open("a1");
    await press();
    expect(undoButton()).toBeInTheDocument();
    expect(screen.getByText("You left #old-project")).toBeInTheDocument();
  });

  test("a private archived channel asks the confirmation without the last-member line, whatever its count", async () => {
    await open("a2");
    await press();
    expect(dialog()!.querySelector(".cfm-text")?.textContent).toBe(
      "A member will have to invite you back.",
    );
    expect(dialog()!.querySelector(".cfm-target strong")).toHaveTextContent(
      "#old-secret",
    );
  });

  test("an Undo that the server refuses gives one failure toast", async () => {
    await open("a1");
    await press();
    h.api.channels.join.mockRejectedValueOnce(http(409));
    fireEvent.click(undoButton()!);
    await flush();
    expect(screen.getAllByText("Could not undo. Try again.")).toHaveLength(1);
  });
});
