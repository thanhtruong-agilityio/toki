// @vitest-environment jsdom
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ConversationHeader } from "../../src/conversation/ConversationHeader";
import { personHue } from "../../src/people/person-hue";
import {
  detail,
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

beforeEach(async () => {
  h = useFakeApi(
    workspaceBody(
      [
        channel("c1", "project-launch", { topic: "Ship it by Friday" }),
        channel("c2", "leadership", { isPrivate: true }),
        channel("c3", "starred-one", { isStarred: true }),
        channel("c4", "xss", { topic: "<b>x</b> & more" }),
        channel("c5", "emptytopic", { topic: "" }),
        dm("d1", "p1"),
        dm("d2", "p3"),
        { ...dm("g1", "p1"), kind: "group_dm", memberIds: ["me", "p1", "p2"] },
        {
          ...dm("g2", "p1"),
          kind: "group_dm",
          memberIds: ["me", "p1", "p2", "p3", "p4", "p5", "p6", "p7"],
        },
      ] as never,
      [
        person("p1", "Mai"),
        person("p2", "Thu Hoàng"),
        person("p3", "Bao Ngo", "deactivated"),
        person("p4", "Dan"),
        person("p5", "Eve"),
        person("p6", "Fay"),
        person("p7", "Gus"),
      ],
    ),
    {
      details: [
        detail("c1", "project-launch", {
          memberCount: 3,
          topic: "Ship it by Friday",
        }),
        detail("c2", "leadership", { isPrivate: true, memberCount: 2 }),
      ],
    },
  );
  await h.loadNow();
});

const show = (id: string, onBack = () => {}, path?: string) =>
  mountConversation(
    (cid) => <ConversationHeader conversationId={cid} onBack={onBack} />,
    { path: path ?? `/c/${id}` },
  );

const header = () => document.querySelector("div.mh") as HTMLElement;
const heading = () => screen.getByRole("heading", { level: 1 });
const memb = () => document.querySelector("button.memb") as HTMLElement;

describe("markup (R1)", () => {
  test("a public channel with a topic: back, grow with h1 and topic, members button, in that order", async () => {
    await show("c1");
    const kids = [...header().children].map((el) => el.className);
    expect(kids).toEqual(["ib back", "grow", "btn ghost memb"]);
    expect(header().children[0].tagName).toBe("BUTTON");
    const grow = header().children[1];
    expect(
      [...grow.children].map((el) => el.tagName + "." + el.className),
    ).toEqual(["H1.ell", "DIV.topic ell"]);
    expect(within(heading()).getByText("project-launch").className).toBe("ell");
    expect(header().querySelector(".topic")).toHaveTextContent(
      "Ship it by Friday",
    );
  });

  test("a private channel with no topic has no div.topic", async () => {
    await show("c2");
    expect(header().querySelector(".topic")).toBeNull();
  });

  test("it draws no search button, no Meet button and no tab", async () => {
    await show("c1");
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.queryByRole("button", { name: /search|meet/i })).toBeNull();
    const source = readFileSync(
      `${import.meta.dirname}/../../src/conversation/ConversationHeader.tsx`,
      "utf8",
    );
    expect(source).not.toMatch(/Meet|search/i);
  });
});

describe("the glyph and the name (R2)", () => {
  test("public: hash icon and the channel's name, with no #", async () => {
    await show("c1");
    expect(heading()).toHaveTextContent(/^project-launch$/);
    expect(heading().querySelector("svg path")?.getAttribute("d")).toBe(
      "M4 9h16M4 15h16M10 3L8 21M16 3l-2 18",
    );
    expect(heading().querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  test("private: lock icon", async () => {
    await show("c2");
    expect(heading()).toHaveTextContent(/^leadership$/);
    expect(heading().querySelector("svg path")?.getAttribute("d")).toMatch(
      /^M5 11h14/,
    );
  });

  test("a DM: an Avatar of size 28 and the hue of the other person, named with the other person", async () => {
    await show("d1");
    expect(heading()).toHaveAccessibleName("Mai");
    const avatar = heading().querySelector(
      "span.av, [style*='--h']",
    ) as HTMLElement;
    expect(avatar).toBeTruthy();
    expect(avatar.getAttribute("style")).toContain(`--h: ${personHue("p1")}`);
    expect(avatar.getAttribute("style")).toContain("--s: 28px");
  });

  test("a deactivated person in a DM is still named", async () => {
    await show("d2");
    expect(heading()).toHaveTextContent("Bao Ngo");
  });

  test("a group: the users icon and the store's full names", async () => {
    await show("g1");
    expect(heading()).toHaveTextContent("Mai, Thu Hoàng");
    expect(heading().querySelector("svg")).toBeTruthy();
    expect(heading().querySelector("span[style]")).toBeNull();
  });

  test("an id with no entry draws nothing", async () => {
    await show("nope");
    expect(header()).toBeNull();
  });
});

describe("the second line (R3)", () => {
  test("an empty topic and a null topic draw no div.topic", async () => {
    await show("c5");
    expect(header().querySelector(".topic")).toBeNull();
  });

  test("a topic with markup is shown as typed", async () => {
    await show("c4");
    expect(header().querySelector(".topic")).toHaveTextContent(
      "<b>x</b> & more",
    );
    expect(header().querySelector(".topic b")).toBeNull();
  });

  test("a DM and a group have none", async () => {
    await show("d1");
    expect(header().querySelector(".topic")).toBeNull();
    document.body.innerHTML = "";
    await show("g1");
    expect(header().querySelector(".topic")).toBeNull();
  });
});

describe("the members button (R4)", () => {
  test("named, collapsed, controls the details id, holds the count of the held detail", async () => {
    await show("c1");
    await act(async () => {}); // the read of the detail answers
    expect(memb()).toHaveAccessibleName("Members and details");
    expect(memb()).toHaveAttribute("aria-expanded", "false");
    expect(memb()).toHaveAttribute("aria-controls", "conversation-details");
    expect(memb().querySelector("span.mono")).toHaveTextContent("3");
    expect(memb().querySelector("svg")).toBeTruthy();
  });

  test("a DM counts 2 and a group of 8 counts 8, with no read", async () => {
    await show("d1");
    expect(memb().querySelector(".mono")).toHaveTextContent("2");
    expect(h.api.channels.get).not.toHaveBeenCalled();
    document.body.innerHTML = "";
    await show("g2");
    expect(memb().querySelector(".mono")).toHaveTextContent("8");
  });

  test("while the detail is pending the button shows no number and can still be pressed", async () => {
    let release!: () => void;
    h.api.channels.get.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ channel: detail("c1", "project-launch") });
        }),
    );
    const router = await show("c1");
    expect(memb().querySelector(".mono")).toBeNull();
    await userEvent.click(memb());
    expect(router.state.location.search).toEqual({ panel: "details" });
    await act(async () => release());
    expect(memb().querySelector(".mono")).toHaveTextContent("3");
  });

  test("a press opens the panel by a pushed entry and aria-expanded follows; a second press closes it", async () => {
    const router = await show("c1");
    await userEvent.click(memb());
    expect(memb()).toHaveAttribute("aria-expanded", "true");
    expect(router.state.location.search).toEqual({ panel: "details" });
    expect(router.state.location.state.detailsPushed).toBe(true);
    await userEvent.click(memb());
    expect(memb()).toHaveAttribute("aria-expanded", "false");
    expect(router.state.location.search).toEqual({});
  });

  test("one header on a channel reads the detail once, and a second header shares the read", async () => {
    await show("c1");
    expect(h.api.channels.get).toHaveBeenCalledTimes(1);
  });
});

describe("the Back button (R5)", () => {
  test("a press calls onBack once", async () => {
    const onBack = vi.fn();
    await show("c1", onBack);
    await userEvent.click(
      screen.getByRole("button", { name: "Back to conversations" }),
    );
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe("the star (R6)", () => {
  test("a starred entry shows the star with a name; another does not", async () => {
    await show("c3");
    const star = heading().querySelector("span.later-ic") as HTMLElement;
    expect(star).toBeTruthy();
    expect(star).toHaveAccessibleName("Starred");
    expect(star.querySelector("svg")).toBeTruthy();
    document.body.innerHTML = "";
    await show("c1");
    expect(heading().querySelector(".later-ic")).toBeNull();
  });

  test("a saved star redraws the header with no reload", async () => {
    await show("c1");
    expect(heading().querySelector(".later-ic")).toBeNull();
    await act(
      async () => void (await h.store.saveSettings("c1", { isStarred: true })),
    );
    expect(heading().querySelector(".later-ic")).toBeTruthy();
  });

  test("a saved topic redraws the topic line", async () => {
    await show("c1");
    await act(
      async () =>
        void (await h.store.editChannel("c1", { topic: "New topic" })),
    );
    expect(header().querySelector(".topic")).toHaveTextContent("New topic");
  });
});

describe("an archived channel (R30)", () => {
  test("with no entry and an archived read the header draws the name and topic from the read, with no star", async () => {
    h.details.arch = detail("arch", "old-project", {
      archived: true,
      topic: "Done",
      memberCount: 4,
    });
    await act(async () => void (await h.store.readChannel("arch")));
    await show("arch");
    expect(heading()).toHaveTextContent(/^old-project$/);
    expect(header().querySelector(".topic")).toHaveTextContent("Done");
    expect(heading().querySelector(".later-ic")).toBeNull();
    expect(memb().querySelector(".mono")).toHaveTextContent("4");
  });

  test("a held detail of a channel that is not archived and has no entry (just left) draws nothing", async () => {
    await act(async () => void (await h.store.leaveChannel("c1")));
    await show("c1");
    expect(header()).toBeNull();
  });
});
