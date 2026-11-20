// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@toki/client-core";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CreateChannelDialog } from "../../../src/features/create-channel/CreateChannelDialog";
import { setConnectionCheck } from "../../../src/patterns/online";
import { Providers } from "../../support/providers";
import { ADMIN_ID, change, fake, makePeople, resetFake } from "./fakeDeps";

vi.mock("../../../src/features/create-channel/deps", async () =>
  (await import("./fakeDeps")).makeDepsMock(),
);

beforeEach(resetFake);
afterEach(() => setConnectionCheck(null));

type HostProps = {
  onClose?: () => void;
  onCreated?: (id: string) => void;
  onOpenConversation?: (id: string) => void;
  initialOpen?: boolean;
};

function Host({
  onClose,
  onCreated,
  onOpenConversation,
  initialOpen = true,
}: HostProps) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        opener
      </button>
      <CreateChannelDialog
        open={open}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
        onCreated={onCreated}
        onOpenConversation={onOpenConversation ?? (() => {})}
      />
    </>
  );
}

function setup(props: HostProps = {}) {
  const user = userEvent.setup();
  const view = render(
    <Providers>
      <Host {...props} />
    </Providers>,
  );
  return { user, ...view };
}

const nameInput = () => screen.getByRole("textbox", { name: "Name" });
const topicInput = () =>
  screen.getByRole("textbox", { name: "Topic (optional)" });
const create = () => screen.getByRole("button", { name: "Create" });
const cancel = () => screen.getByRole("button", { name: "Cancel" });
const closeButton = () => screen.queryByRole("button", { name: "Close" });
const privateSwitch = () => screen.getByRole("switch", { name: "Private" });
const search = () => screen.getByRole("searchbox");
const line = () => screen.queryByText("That did not work. Try again.");

async function typeName(
  user: ReturnType<typeof userEvent.setup>,
  text = "qa-team",
) {
  await user.type(nameInput(), text);
}

// A request that stays open until the test settles it.
function hold() {
  let resolve!: (value: { id: string; created: boolean }) => void;
  let reject!: (error: unknown) => void;
  fake.createChannel.mockImplementation(
    () =>
      new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      }),
  );
  return {
    resolve: (id = "new-id") => act(async () => resolve({ id, created: true })),
    reject: (error: unknown) => act(async () => reject(error)),
  };
}

const http = (status: number, code: string | null = null) =>
  new ApiError({ kind: "http", status, code });

describe("markup and order (R5)", () => {
  test("one Modal with the title, the close button and the fields in order", () => {
    setup();
    const dialog = screen.getByRole("dialog", { name: "Create channel" });
    expect(closeButton()).toBeInTheDocument();
    const body = dialog.querySelector(".mbd")!;
    const order = [
      nameInput(),
      privateSwitch(),
      topicInput(),
      screen.getByRole("group", { name: "Add people (optional)" }),
      search(),
    ];
    for (let i = 1; i < order.length; i++) {
      expect(
        order[i - 1]!.compareDocumentPosition(order[i]!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    for (const node of order) expect(body).toContainElement(node);
    expect(body.querySelector("form")).toBeNull();
    expect(nameInput()).toHaveAttribute("autocomplete", "off");
    expect(nameInput()).toHaveAttribute("autocapitalize", "none");
    expect(nameInput()).toHaveAttribute("spellcheck", "false");
    expect(nameInput()).toHaveAttribute("data-autofocus");
    expect(topicInput()).toHaveAttribute("autocomplete", "off");
    expect(nameInput()).not.toHaveAttribute("maxlength");
    expect(topicInput()).not.toHaveAttribute("maxlength");
  });

  test("the switch is off, has its hint, and the group is a fieldset", () => {
    setup();
    expect(privateSwitch()).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByText(
        "Only its members can find it. This cannot be changed later.",
      ),
    ).toHaveClass("cchint");
    expect(
      screen.getByRole("group", { name: "Add people (optional)" }).tagName,
    ).toBe("FIELDSET");
  });

  test("the footer is div.ccfoot with Cancel then Create, outside the body", () => {
    setup();
    const dialog = screen.getByRole("dialog");
    const foot = dialog.querySelector(".mft > .ccfoot")!;
    expect(foot).not.toBeNull();
    expect(dialog.querySelector(".mbd")).not.toContainElement(
      foot as HTMLElement,
    );
    const buttons = within(foot.querySelector(".ccbtns") as HTMLElement)
      .getAllByRole("button")
      .map((b) => b.textContent);
    expect(buttons).toEqual(["Cancel", "Create"]);
  });

  test("a failure line sits in div.ccfoot above the buttons", async () => {
    fake.createChannel.mockRejectedValue(http(500));
    const { user } = setup();
    await typeName(user);
    await user.click(create());
    const foot = screen.getByRole("dialog").querySelector(".ccfoot")!;
    const alert = within(foot as HTMLElement).getByRole("alert");
    expect(alert).toHaveClass("gerr");
    expect(foot.firstElementChild).toBe(alert);
    expect(foot.lastElementChild).toHaveClass("ccbtns");
  });

  test("focus goes to the name on open, and back to the opener on close", async () => {
    const { user } = setup({ initialOpen: false });
    const opener = screen.getByRole("button", { name: "opener" });
    await user.click(opener);
    expect(nameInput()).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });

  test("open, type, close, open again: everything is empty", async () => {
    const { user } = setup();
    await typeName(user);
    await user.type(topicInput(), "Plans");
    await user.click(privateSwitch());
    await user.click(screen.getByRole("button", { name: /Person 001/ }));
    await user.click(cancel());
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "opener" }));
    expect(nameInput()).toHaveValue("");
    expect(topicInput()).toHaveValue("");
    expect(privateSwitch()).toHaveAttribute("aria-checked", "false");
    expect(screen.queryAllByRole("button", { pressed: true })).toHaveLength(0);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("Enter while composing or with keyCode 229 sends nothing, a plain Enter sends one request", async () => {
    const { user } = setup();
    await typeName(user);
    await user.type(topicInput(), "x");
    for (const field of [nameInput(), topicInput()]) {
      fireEvent.keyDown(field, { key: "Enter", isComposing: true });
      fireEvent.keyDown(field, { key: "Enter", keyCode: 229 });
    }
    expect(fake.createChannel).not.toHaveBeenCalled();
    fireEvent.keyDown(topicInput(), { key: "Enter" });
    expect(fake.createChannel).toHaveBeenCalledTimes(1);
  });

  test("Enter in the name does nothing while Create is disabled", async () => {
    const { user } = setup();
    await user.type(nameInput(), "a&b");
    await user.keyboard("{Enter}");
    expect(fake.createChannel).not.toHaveBeenCalled();
  });
});

describe("name (R6, R7)", () => {
  test("a space and a capital become a hyphen and a lower-case letter", async () => {
    const { user } = setup();
    await user.type(nameInput(), "Q A");
    expect(nameInput()).toHaveValue("q-a");
  });

  test("a paste is normalised", async () => {
    const { user } = setup();
    await user.click(nameInput());
    await user.paste("My Team\tX");
    expect(nameInput()).toHaveValue("my-team-x");
  });

  test("a composition keeps the text as typed until compositionend, shows no message and sends nothing", () => {
    setup();
    const input = nameInput() as HTMLInputElement;
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "Q" } });
    expect(input).toHaveValue("Q");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(fake.createChannel).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input);
    expect(input).toHaveValue("q");
  });

  test("the caret stays where the person typed a space", async () => {
    const { user } = setup();
    await user.type(nameInput(), "ab");
    await user.type(nameInput(), " ", {
      initialSelectionStart: 1,
      initialSelectionEnd: 1,
    });
    const input = nameInput() as HTMLInputElement;
    expect(input).toHaveValue("a-b");
    expect(input.selectionStart).toBe(2);
  });

  test("a bad character shows the message under the field at once", async () => {
    const { user } = setup();
    await user.type(nameInput(), "a&b");
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "Use only lowercase letters, digits and hyphens.",
    );
    expect(nameInput()).toHaveAttribute("aria-invalid", "true");
    expect(create()).toBeDisabled();
  });

  test("80 characters enable Create, 81 show the message and disable it", async () => {
    const { user } = setup();
    await user.click(nameInput());
    await user.paste("a".repeat(80));
    expect(create()).toBeEnabled();
    expect(screen.queryByRole("alert")).toBeNull();
    await user.type(nameInput(), "a");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Use 80 characters or fewer.",
    );
    expect(create()).toBeDisabled();
  });

  test("an untouched form shows no error and Create is disabled", () => {
    setup();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(create()).toBeDisabled();
  });
});

describe("topic (R8)", () => {
  test.each([
    ["250 characters", "a".repeat(250), true],
    ["250 emoji", "😀".repeat(250), true],
    ["251 characters", "a".repeat(251), false],
    ["251 emoji", "😀".repeat(251), false],
    ["white space alone", "   ", true],
  ])("%s", async (_what, text, valid) => {
    const { user } = setup();
    await typeName(user);
    await user.click(topicInput());
    await user.paste(text);
    if (valid) {
      expect(create()).toBeEnabled();
      expect(screen.queryByRole("alert")).toBeNull();
    } else {
      expect(create()).toBeDisabled();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Use 250 characters or fewer.",
      );
    }
  });
});

describe("people (R9)", () => {
  test("offers the active people except the Admin", () => {
    fake.people = [
      ...fake.people,
      {
        ...makePeople(1)[0]!,
        id: "gone",
        displayName: "Gone",
        status: "deactivated",
      },
    ];
    setup();
    const names = screen
      .getAllByRole("button", { pressed: false })
      .map((b) => b.textContent);
    expect(names.some((n) => n?.includes("Admin One"))).toBe(false);
    expect(names.some((n) => n?.includes("Gone"))).toBe(false);
    expect(names).toHaveLength(3);
  });

  test("with 201 candidates the 201st press shows the limit and adds nobody", () => {
    fake.people = [fake.people[0]!, ...makePeople(201)];
    setup();
    const rows = () =>
      Array.from(document.querySelectorAll<HTMLButtonElement>("button.prow"));
    expect(rows()).toHaveLength(201);
    for (let i = 0; i < 200; i++) fireEvent.click(rows()[i]!);
    expect(screen.queryByText("You can add up to 200 people.")).toBeNull();
    fireEvent.click(rows()[200]!);
    expect(
      screen.getByText("You can add up to 200 people."),
    ).toBeInTheDocument();
    expect(rows().filter((r) => r.ariaPressed === "true")).toHaveLength(200);
  }, 30_000);
});

describe("the state of Create (R10)", () => {
  test("a valid name enables it, the switch counts for nothing", async () => {
    const { user } = setup();
    await typeName(user);
    expect(create()).toBeEnabled();
    expect(create()).not.toHaveAttribute("aria-busy");
    await user.click(privateSwitch());
    expect(create()).toBeEnabled();
  });

  test("a request held open: busy, one request for two presses, nothing can change, enabled after", async () => {
    const request = hold();
    const { user } = setup();
    await typeName(user);
    await user.click(screen.getByRole("button", { name: /Person 001/ }));
    await user.click(create());
    await user.click(create());
    fireEvent.keyDown(nameInput(), { key: "Enter" });
    expect(fake.createChannel).toHaveBeenCalledTimes(1);
    expect(create()).toBeDisabled();
    expect(create()).toHaveAttribute("aria-busy", "true");
    expect(cancel()).toBeDisabled();
    expect(privateSwitch()).toBeDisabled();
    expect(nameInput()).toHaveAttribute("readonly");
    expect(topicInput()).toHaveAttribute("readonly");
    expect(search()).toBeDisabled();
    expect(
      screen.getByRole("group", { name: "Add people (optional)" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Remove Person 001" }),
    ).toBeDisabled();
    await request.reject(http(500));
    expect(create()).toBeEnabled();
    expect(create()).not.toHaveAttribute("aria-busy");
    expect(cancel()).toBeEnabled();
    expect(privateSwitch()).toBeEnabled();
    expect(nameInput()).not.toHaveAttribute("readonly");
    expect(search()).toBeEnabled();
  });
});

describe("sending (R11, R12)", () => {
  test("a plain form sends name and isPrivate only", async () => {
    const { user } = setup();
    await typeName(user);
    await user.click(create());
    expect(fake.createChannel).toHaveBeenCalledWith({
      id: expect.stringMatching(/^017f22e2/),
      name: "qa-team",
      isPrivate: false,
    });
  });

  test("a full form sends the topic and the people in the order pressed", async () => {
    const { user } = setup();
    await typeName(user);
    await user.click(privateSwitch());
    await user.type(topicInput(), "  Plans ");
    await user.click(screen.getByRole("button", { name: /Person 002/ }));
    await user.click(screen.getByRole("button", { name: /Person 001/ }));
    await user.click(create());
    expect(fake.createChannel).toHaveBeenCalledWith({
      id: expect.any(String),
      name: "qa-team",
      isPrivate: true,
      topic: "Plans",
      memberIds: ["p2", "p1"],
    });
    expect(JSON.stringify(fake.createChannel.mock.calls[0])).not.toContain(
      ADMIN_ID,
    );
  });

  test.each([
    ["201", true],
    ["200", false],
  ])(
    "an answer %s calls onCreated, onClose, onOpenConversation once each in order, with no toast",
    async (_status, created) => {
      fake.createChannel.mockImplementation(async (body: { id: string }) => ({
        id: body.id,
        created,
      }));
      const calls: string[] = [];
      const { user } = setup({
        onCreated: (id) => calls.push(`created:${id}`),
        onClose: () => calls.push("close"),
        onOpenConversation: (id) => calls.push(`open:${id}`),
      });
      await typeName(user);
      await user.click(create());
      const id = (fake.createChannel.mock.calls[0]![0] as { id: string }).id;
      expect(calls).toEqual([`created:${id}`, "close", `open:${id}`]);
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.queryByText(/created|success/i)).toBeNull();
    },
  );

  test("a dialog unmounted before the answer closes and opens nothing, and leaves onCreated to its owner's check", async () => {
    const request = hold();
    const onClose = vi.fn();
    const onOpenConversation = vi.fn();
    const onCreated = vi.fn();
    const { user, unmount } = setup({ onClose, onOpenConversation, onCreated });
    await typeName(user);
    await user.click(create());
    unmount();
    await request.resolve("late");
    expect(onClose).not.toHaveBeenCalled();
    expect(onOpenConversation).not.toHaveBeenCalled();
    expect(onCreated).toHaveBeenCalledWith("late");
  });

  test("offline sends nothing, the dialog stays and the toast explains", async () => {
    setConnectionCheck(() => false);
    const { user } = setup();
    await typeName(user);
    await user.click(create());
    expect(fake.createChannel).not.toHaveBeenCalled();
    expect(fake.newId).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(nameInput()).toHaveValue("qa-team");
    expect(screen.getByText(/You are offline/)).toBeInTheDocument();
    expect(create()).toBeEnabled();
  });
});

describe("a name in use (R13)", () => {
  test("shows the message, focuses the name, keeps the rest, and enables Create after an edit", async () => {
    fake.createChannel.mockRejectedValue(http(409, "channel_name_taken"));
    const { user } = setup();
    await typeName(user);
    await user.type(topicInput(), "Plans");
    await user.click(screen.getByRole("button", { name: /Person 001/ }));
    await user.click(create());
    expect(screen.getByRole("alert")).toHaveTextContent(
      "A channel with this name already exists.",
    );
    expect(nameInput()).toHaveAttribute("aria-invalid", "true");
    expect(nameInput()).toHaveFocus();
    expect(create()).toBeDisabled();
    expect(topicInput()).toHaveValue("Plans");
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(1);
    expect(line()).toBeNull();
    await user.type(nameInput(), "2");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(create()).toBeEnabled();
    await user.keyboard("{Backspace}");
    expect(create()).toBeDisabled();
  });

  test("a 409 with another code does not show the name message", async () => {
    fake.createChannel.mockRejectedValue(http(409, "something_else"));
    const { user } = setup();
    await typeName(user);
    await user.click(create());
    expect(
      screen.queryByText("A channel with this name already exists."),
    ).toBeNull();
    expect(line()).toBeInTheDocument();
  });
});

describe("the other answers (R14)", () => {
  const failures: Array<[string, unknown]> = [
    ["400 validation_failed", http(400, "validation_failed")],
    ["403", http(403, "forbidden")],
    ["404", http(404, "not_found")],
    ["409 channel_id_in_use", http(409, "channel_id_in_use")],
    ["429", http(429, "rate_limited")],
    ["500", http(500)],
    ["timeout", new ApiError({ kind: "timeout" })],
    ["network", new ApiError({ kind: "network" })],
    ["invalid_response", new ApiError({ kind: "invalid_response" })],
  ];
  test.each(failures)(
    "%s shows the plain line, enables Create, focuses it and keeps the fields",
    async (_name, error) => {
      fake.createChannel.mockRejectedValue(error);
      const { user } = setup();
      await typeName(user);
      await user.type(topicInput(), "Plans");
      await user.click(create());
      expect(line()).toBeInTheDocument();
      expect(create()).toBeEnabled();
      expect(create()).toHaveFocus();
      expect(nameInput()).toHaveValue("qa-team");
      expect(topicInput()).toHaveValue("Plans");
      expect(closeButton()).toBeInTheDocument();
    },
  );

  test.each([
    ["aborted", new ApiError({ kind: "aborted" })],
    ["401 session_ended", http(401, "session_ended")],
  ])("%s shows no line and enables Create", async (_name, error) => {
    fake.createChannel.mockRejectedValue(error);
    const { user } = setup();
    await typeName(user);
    await user.click(create());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(create()).toBeEnabled();
  });

  test("the line is replaced by the next message and removed when the next press starts", async () => {
    const { user } = setup();
    fake.createChannel.mockRejectedValueOnce(http(500));
    await typeName(user);
    await user.click(create());
    expect(line()).toBeInTheDocument();
    const request = hold();
    await user.click(create());
    expect(line()).toBeNull();
    await request.reject(http(500));
    expect(line()).toBeInTheDocument();
  });

  test("channel_id_in_use makes the next press use a new id", async () => {
    const { user } = setup();
    fake.createChannel.mockRejectedValueOnce(http(409, "channel_id_in_use"));
    await typeName(user);
    await user.click(create());
    await user.click(create());
    const [first, second] = fake.createChannel.mock.calls.map(
      (call) => (call[0] as { id: string }).id,
    );
    expect(second).not.toBe(first);
  });

  test("invalid_member refreshes, drops the people who are gone and says so", async () => {
    fake.createChannel.mockRejectedValue(http(400, "invalid_member"));
    fake.refresh.mockImplementation(async () => {
      change(() => {
        fake.people = fake.people.map((p) =>
          p.id === "p2" ? { ...p, status: "deactivated" as const } : p,
        );
      });
    });
    const { user } = setup();
    await typeName(user);
    await user.click(screen.getByRole("button", { name: /Person 001/ }));
    await user.click(screen.getByRole("button", { name: /Person 002/ }));
    await user.click(create());
    expect(fake.refresh).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(
        "Someone you chose can no longer be added. Check the list and try again.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Remove Person 001" }),
    ).toBeInTheDocument();
    expect(create()).toBeEnabled();
    expect(create()).toHaveFocus();
    expect(nameInput()).toHaveValue("qa-team");
    // the chosen ids themselves lost the person who is gone
    fake.createChannel.mockImplementation(async (b: { id: string }) => ({
      id: b.id,
      created: true,
    }));
    await user.click(create());
    expect(fake.createChannel.mock.calls[1]![0]).toMatchObject({
      memberIds: ["p1"],
    });
  });

  test("invalid_member with a failed refresh keeps both chips and shows the generic line", async () => {
    fake.createChannel.mockRejectedValue(http(400, "invalid_member"));
    fake.refresh.mockImplementation(async () => {
      fake.storeError = new ApiError({ kind: "network" });
    });
    const { user } = setup();
    await typeName(user);
    await user.click(screen.getByRole("button", { name: /Person 001/ }));
    await user.click(screen.getByRole("button", { name: /Person 002/ }));
    await user.click(create());
    expect(line()).toBeInTheDocument();
    expect(screen.queryByText(/can no longer be added/)).toBeNull();
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(2);
    fake.createChannel.mockImplementation(async (b: { id: string }) => ({
      id: b.id,
      created: true,
    }));
    await user.click(create());
    expect(fake.createChannel.mock.calls[1]![0]).toMatchObject({
      memberIds: ["p1", "p2"],
    });
  });
});

describe("an attempt (R15)", () => {
  async function pressTwice(
    between: (user: ReturnType<typeof userEvent.setup>) => Promise<void>,
  ) {
    fake.createChannel.mockRejectedValue(new ApiError({ kind: "network" }));
    const { user } = setup();
    await typeName(user);
    await user.click(create());
    await between(user);
    await user.click(create());
    return fake.createChannel.mock.calls.map(
      (call) => (call[0] as { id: string }).id,
    );
  }

  test("the same form after a failure sends the same id", async () => {
    const [a, b] = await pressTwice(async () => {});
    expect(a).toBe(b);
  });

  test.each<
    [string, (user: ReturnType<typeof userEvent.setup>) => Promise<void>]
  >([
    ["the name", async (u) => void (await u.type(nameInput(), "2"))],
    ["the switch", async (u) => void (await u.click(privateSwitch()))],
    ["the topic", async (u) => void (await u.type(topicInput(), "t"))],
    [
      "a person",
      async (u) =>
        void (await u.click(
          screen.getByRole("button", { name: /Person 001/ }),
        )),
    ],
  ])("a change of %s sends another id", async (_what, change) => {
    const [a, b] = await pressTwice(change);
    expect(a).not.toBe(b);
  });

  test("after a close and an open the id is new", async () => {
    fake.createChannel.mockRejectedValue(new ApiError({ kind: "network" }));
    const { user } = setup();
    await typeName(user);
    await user.click(create());
    await user.click(cancel());
    await user.click(screen.getByRole("button", { name: "Discard" }));
    await user.click(screen.getByRole("button", { name: "opener" }));
    await typeName(user);
    await user.click(create());
    const [a, b] = fake.createChannel.mock.calls.map(
      (call) => (call[0] as { id: string }).id,
    );
    expect(a).not.toBe(b);
  });
});

describe("closing (R16, R17)", () => {
  const question = () => screen.queryByText("Discard what you typed?");
  const scrim = () => screen.getByRole("dialog").parentElement as HTMLElement;

  test("with nothing typed every close request closes at once", async () => {
    for (const how of ["escape", "outside", "close", "cancel"]) {
      const { user, unmount } = setup();
      if (how === "escape") await user.keyboard("{Escape}");
      if (how === "outside") await user.click(scrim());
      if (how === "close") await user.click(closeButton()!);
      if (how === "cancel") await user.click(cancel());
      expect(
        screen.queryByRole("dialog", { name: "Create channel" }),
      ).toBeNull();
      unmount();
    }
  });

  test("the Private switch alone is not content", async () => {
    const { user } = setup();
    await user.click(privateSwitch());
    await user.click(cancel());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  const contents: Array<
    [string, (user: ReturnType<typeof userEvent.setup>) => Promise<void>]
  > = [
    ["a name", async (u) => void (await u.type(nameInput(), "a"))],
    ["a topic", async (u) => void (await u.type(topicInput(), "a"))],
    [
      "one person",
      async (u) =>
        void (await u.click(
          screen.getByRole("button", { name: /Person 001/ }),
        )),
    ],
  ];
  test.each(contents)(
    "with %s: outside does nothing, close and Cancel and Esc ask",
    async (_what, fill) => {
      const { user } = setup();
      await fill(user);
      await user.click(scrim());
      expect(question()).toBeNull();
      expect(
        screen.getByRole("dialog", { name: "Create channel" }),
      ).toBeInTheDocument();
      await user.click(closeButton()!);
      expect(question()).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Keep editing" }));
      expect(question()).toBeNull();
      await user.click(cancel());
      expect(question()).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Keep editing" }));
      await user.keyboard("{Escape}");
      expect(question()).toBeInTheDocument();
      // the question names the form
      expect(
        screen.getByText('What you typed in "Create channel" will be lost.'),
      ).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Discard" }));
      expect(screen.queryByRole("dialog")).toBeNull();
    },
  );

  test("a held request: Esc, an outside press and Cancel leave it open, and the header has no close button", async () => {
    const request = hold();
    const { user } = setup();
    await typeName(user);
    await user.click(create());
    expect(closeButton()).toBeNull();
    await user.keyboard("{Escape}");
    await user.click(scrim());
    await user.click(cancel());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(question()).toBeNull();
    await request.reject(http(500));
    expect(closeButton()).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(question()).toBeInTheDocument();
  });
});

describe("access (R18)", () => {
  test.each<["member" | null]>([["member"], [null]])(
    "the role %s gets no dialog and no request",
    async (role) => {
      fake.role = role;
      setup();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.body.querySelector(".ccfoot")).toBeNull();
      expect(fake.createChannel).not.toHaveBeenCalled();
    },
  );

  test("a role that changes to member while open removes the dialog and sends nothing", async () => {
    const request = hold();
    const onClose = vi.fn();
    const { user } = setup({ onClose });
    await typeName(user);
    await user.click(create());
    act(() => change(() => (fake.role = "member")));
    expect(screen.queryByRole("dialog")).toBeNull();
    await request.resolve("x");
    expect(onClose).not.toHaveBeenCalled();
    expect(fake.createChannel).toHaveBeenCalledTimes(1);
  });
});
