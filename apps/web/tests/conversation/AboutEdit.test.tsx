// @vitest-environment jsdom
import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ConversationHeader } from "../../src/conversation/ConversationHeader";
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

async function setup(role: "member" | "admin" = "member") {
  onNoAccess.mockReset();
  const body = workspaceBody(
    [
      channel("c1", "project-launch", { topic: "Ship it" }),
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
      detail("c1", "project-launch", {
        topic: "Ship it",
        description: "Old text",
      }),
      detail("c2", "leadership", { isPrivate: true }),
      detail("gen", "general", { isGeneral: true }),
    ],
  });
  await h.loadNow();
}

const open = (id = "c1") =>
  mountConversation(
    (cid) => (
      <>
        <ConversationHeader conversationId={cid} onBack={() => {}} />
        <DetailsPanel conversationId={cid} onNoAccess={onNoAccess} />
      </>
    ),
    { path: `/c/${id}?panel=details` },
  );

const about = () =>
  screen.getByRole("heading", { level: 3, name: "About" })
    .parentElement as HTMLElement;
const editButton = () => screen.queryByRole("button", { name: "Edit" });
const topicField = () => screen.getByLabelText("Topic") as HTMLInputElement;
const descField = () =>
  screen.getByLabelText("Description") as HTMLTextAreaElement;
const save = () =>
  screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;

async function type(field: HTMLElement, text: string) {
  await userEvent.clear(field);
  if (text !== "") {
    await userEvent.click(field);
    await userEvent.paste(text);
  }
}

beforeEach(() => setConnectionCheck(null));
afterEach(() => setConnectionCheck(null));

describe("who may edit (R15)", () => {
  test.each([["member"], ["admin"]] as const)(
    "a %s of a channel sees Edit",
    async (role) => {
      await setup(role);
      await open("c1");
      expect(editButton()).toBeInTheDocument();
    },
  );

  test("#general shows Edit too", async () => {
    await setup();
    await open("gen");
    expect(editButton()).toBeInTheDocument();
  });

  test("a DM and a group have no Edit", async () => {
    await setup();
    await open("d1");
    expect(editButton()).toBeNull();
    document.body.innerHTML = "";
    await open("g1");
    expect(editButton()).toBeNull();
  });

  test("no Edit while the detail is not held, and it appears when the detail arrives", async () => {
    await setup();
    let release: () => void = () => {};
    h.api.channels.get.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ channel: h.details.c1 });
        }),
    );
    await open("c1");
    expect(editButton()).toBeNull();
    await act(async () => release());
    expect(editButton()).toBeInTheDocument();
  });

  test("an archived channel has no Edit", async () => {
    await setup();
    h.details.c1 = { ...h.details.c1, archived: true } as never;
    await open("c1");
    expect(editButton()).toBeNull();
  });

  test("no input is named for the name of the channel in any state", async () => {
    await setup();
    await open("c1");
    await userEvent.click(editButton()!);
    expect(screen.queryByLabelText(/^name$/i)).toBeNull();
    const inputs = [...document.querySelectorAll("input, textarea")];
    expect(inputs.map((i) => (i as HTMLInputElement).value)).not.toContain(
      "project-launch",
    );
  });
});

describe("the form (R15)", () => {
  test("Edit replaces the topic and the description by two labelled fields filled with the current text; Save is disabled", async () => {
    await setup();
    await open("c1");
    await userEvent.click(editButton()!);
    expect(topicField()).toHaveValue("Ship it");
    expect(topicField().tagName).toBe("INPUT");
    expect(descField()).toHaveValue("Old text");
    expect(descField().tagName).toBe("TEXTAREA");
    expect(save()).toBeDisabled();
    expect(
      within(about()).getByRole("button", { name: "Cancel" }),
    ).toBeInTheDocument();
    expect(about().querySelector("p.sm.muted")).toBeNull();
    expect(editButton()).toBeNull();
  });

  test("Cancel closes the form with nothing sent", async () => {
    await setup();
    await open("c1");
    await userEvent.click(editButton()!);
    await type(topicField(), "changed");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Topic")).toBeNull();
    expect(within(about()).getByText("Old text")).toBeInTheDocument();
    expect(h.api.channels.update).not.toHaveBeenCalled();
  });

  test.each([
    ["isComposing", { isComposing: true }],
    ["keyCode 229", { keyCode: 229 }],
  ])(
    "an Escape during an IME composition (%s) keeps the form",
    async (_n, init) => {
      await setup();
      await open("c1");
      await userEvent.click(editButton()!);
      topicField().focus();
      fireEvent.keyDown(topicField(), { key: "Escape", ...init });
      expect(topicField()).toBeInTheDocument();
      fireEvent.keyDown(topicField(), { key: "Escape" });
      expect(screen.queryByLabelText("Topic")).toBeNull();
    },
  );

  test("Escape cancels the form only: the panel stays open", async () => {
    await setup();
    const router = await open("c1");
    await userEvent.click(editButton()!);
    topicField().focus();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByLabelText("Topic")).toBeNull();
    expect(router.state.location.search).toEqual({ panel: "details" });
    // A second Escape, with no form, closes the panel as the shell does.
    await userEvent.keyboard("{Escape}");
    expect(router.state.location.search).toEqual({});
  });
});

describe("validation (R16)", () => {
  test("a topic of 250 emoji is valid and a topic of 251 is refused on screen as it is typed", async () => {
    await setup();
    await open("c1");
    await userEvent.click(editButton()!);
    await type(topicField(), "😀".repeat(250));
    expect(save()).toBeEnabled();
    expect(screen.queryByText(/at most 250/)).toBeNull();
    await userEvent.click(topicField());
    await userEvent.paste("😀");
    expect(save()).toBeDisabled();
    const error = screen.getByText(
      "The topic can have at most 250 characters.",
    );
    expect(error.className).toBe("gerr");
    expect(topicField().getAttribute("aria-describedby")).toContain(error.id);
  });

  test("white space only: Save stays disabled when the topic was already empty", async () => {
    await setup();
    await open("c2");
    await userEvent.click(editButton()!);
    await type(topicField(), "   ");
    expect(save()).toBeDisabled();
  });

  test("white space only replaces a topic: sent as null", async () => {
    await setup();
    await open("c1");
    await userEvent.click(editButton()!);
    await type(topicField(), "   ");
    expect(save()).toBeEnabled();
    await userEvent.click(save());
    expect(h.api.channels.update).toHaveBeenCalledWith("c1", { topic: null });
  });

  test("a description has no limit on the screen", async () => {
    await setup();
    await open("c1");
    await userEvent.click(editButton()!);
    await type(descField(), "x".repeat(900));
    expect(save()).toBeEnabled();
  });
});

describe("the request (R16)", () => {
  test("a change of the topic only sends only the topic, trimmed", async () => {
    await setup();
    await open("c1");
    await userEvent.click(editButton()!);
    await type(topicField(), "  x  ");
    await userEvent.click(save());
    expect(h.api.channels.update).toHaveBeenCalledTimes(1);
    expect(h.api.channels.update).toHaveBeenCalledWith("c1", { topic: "x" });
    expect(screen.queryByLabelText("Topic")).toBeNull();
  });

  test("a change of the description only never sends the topic", async () => {
    await setup();
    await open("c1");
    await userEvent.click(editButton()!);
    await type(descField(), "New text");
    await userEvent.click(save());
    expect(h.api.channels.update).toHaveBeenCalledWith("c1", {
      description: "New text",
    });
  });

  test("both changed send both; an emptied description is null", async () => {
    await setup();
    await open("c1");
    await userEvent.click(editButton()!);
    await type(topicField(), "t");
    await type(descField(), "");
    await userEvent.click(save());
    expect(h.api.channels.update).toHaveBeenCalledWith("c1", {
      topic: "t",
      description: null,
    });
  });

  test("the header, About and the entry redraw after the save", async () => {
    await setup();
    await open("c1");
    await userEvent.click(editButton()!);
    await type(topicField(), "Fresh topic");
    await userEvent.click(save());
    expect(document.querySelector(".mh .topic")).toHaveTextContent(
      "Fresh topic",
    );
    expect(about().querySelector(".dp-topic")).toHaveTextContent("Fresh topic");
    expect(h.store.getConversation("c1")).toMatchObject({
      topic: "Fresh topic",
    });
  });

  test("changed false closes the form the same way", async () => {
    await setup();
    await open("c1");
    await userEvent.click(editButton()!);
    await type(topicField(), "same on the server");
    h.api.channels.update.mockResolvedValueOnce({
      channel: h.details.c1,
      changed: false,
    });
    await userEvent.click(save());
    expect(screen.queryByLabelText("Topic")).toBeNull();
  });

  test("offline: nothing is sent, the form stays open with its text and one toast says so", async () => {
    await setup();
    await open("c1");
    await userEvent.click(editButton()!);
    await type(topicField(), "typed");
    setConnectionCheck(() => false);
    await userEvent.click(save());
    expect(h.api.channels.update).not.toHaveBeenCalled();
    expect(topicField()).toHaveValue("typed");
    expect(screen.getByText(/You are offline/)).toBeInTheDocument();
  });

  test("a double press sends one command and Save is disabled while it runs", async () => {
    await setup();
    await open("c1");
    await userEvent.click(editButton()!);
    await type(topicField(), "typed");
    let release: () => void = () => {};
    h.api.channels.update.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () =>
            resolve({
              channel: { ...h.details.c1, topic: "typed" },
              changed: true,
            });
        }),
    );
    const button = save();
    fireEvent.click(button);
    fireEvent.click(button);
    expect(h.api.channels.update).toHaveBeenCalledTimes(1);
    expect(save()).toBeDisabled();
    await act(async () => release());
    expect(screen.queryByLabelText("Topic")).toBeNull();
  });
});

describe("failures (R16, D-131)", () => {
  async function failWith(error: unknown) {
    await setup();
    await open("c1");
    await userEvent.click(editButton()!);
    await type(topicField(), "typed");
    h.api.channels.update.mockRejectedValueOnce(error);
    await userEvent.click(save());
  }

  test("a 400 shows the server's message under the field and keeps the form with its text", async () => {
    await failWith(
      Object.assign(http(400, "validation_failed"), {
        message: "Topic is not valid.",
      }),
    );
    expect(screen.getByText("Topic is not valid.").className).toBe("gerr");
    expect(topicField()).toHaveValue("typed");
    expect(save()).toBeEnabled();
  });

  test.each([
    ["403", http(403)],
    ["404", http(404)],
  ])("a %s goes to onNoAccess", async (_n, error) => {
    await failWith(error);
    expect(onNoAccess).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("That did not work. Try again.")).toBeNull();
  });

  test("a 409 reads the channel again, closes the form and shows the failure toast", async () => {
    await failWith(http(409, "channel_archived"));
    expect(h.api.channels.get.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByLabelText("Topic")).toBeNull();
    expect(screen.getAllByText("That did not work. Try again.")).toHaveLength(
      1,
    );
  });

  test.each([
    ["500", http(500)],
    ["429", http(429)],
  ])(
    "a %s keeps the form open and shows the failure toast",
    async (_n, error) => {
      await failWith(error);
      expect(topicField()).toHaveValue("typed");
      expect(screen.getAllByText("That did not work. Try again.")).toHaveLength(
        1,
      );
    },
  );
});
