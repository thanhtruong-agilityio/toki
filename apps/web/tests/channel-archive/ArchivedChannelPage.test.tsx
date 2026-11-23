// @vitest-environment jsdom
import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ArchivedChannelPage } from "../../src/channel-archive/ArchivedChannelPage";
import { ArchivedHistory } from "../../src/channel-archive/ArchivedHistory";
import {
  detail,
  http,
  useFakeApi,
  type FakeApiHarness,
} from "../support/conversation-api";
import { mountConversation } from "../support/conversation-mount";
import { channel, workspaceBody } from "../support/conversation-store";

vi.mock("../../src/client", async () =>
  (await import("../support/conversation-store")).clientModule(),
);

let h: FakeApiHarness;
let n = 0;
const flush = () => act(async () => {});
const HASH = "M4 9h16M4 15h16M10 3L8 21M16 3l-2 18";

// A fresh id for each test: the one-read Map is module state (plan, 7a).
async function setup(
  over: Parameters<typeof detail>[2] = {},
  role: "member" | "admin" = "member",
) {
  const id = `a${(n += 1)}`;
  const body = workspaceBody([channel("c1", "design")] as never, []);
  body.user = { ...body.user, role };
  h = useFakeApi(body, {
    details: [detail(id, "old-design", { archived: true, ...over })],
  });
  await h.loadNow();
  return id;
}

const show = async (
  id: string,
  options: {
    held?: boolean;
    onBack?: () => void;
    language?: "en" | "vi";
    children?: React.ReactNode;
  } = {},
) => {
  if (options.held !== false) await h.store.readChannel(id);
  h.api.channels.get.mockClear();
  await mountConversation(
    (cid) => (
      <ArchivedChannelPage
        channelId={cid}
        onBack={options.onBack ?? (() => {})}
      >
        {options.children}
      </ArchivedChannelPage>
    ),
    { path: `/c/${id}`, language: options.language },
  );
  await flush();
};

const page = () => screen.getByTestId("archived-channel-page");
const heading = () => screen.getByRole("heading", { level: 1 });

describe("the page (R14)", () => {
  test("holds the header, the body with the children, then the notice, in that order", async () => {
    const id = await setup();
    await show(id, { children: <i data-testid="kid" /> });
    expect(page().className).toBe("arch-page");
    const kids = [...page().children];
    expect(kids.map((k) => k.className)).toEqual([
      "mh",
      "arch-body",
      "arch-notice",
    ]);
    expect(kids[1]!.querySelector('[data-testid="kid"]')).not.toBeNull();
    expect(kids[2]!.tagName).toBe("P");
  });

  test("has no composer: no textarea, contenteditable, form or send button", async () => {
    const id = await setup();
    await show(id);
    expect(
      page().querySelector("textarea, form, [contenteditable]"),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /send/i })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  test("ArchivedHistory is a stand-in that renders nothing", async () => {
    const id = await setup();
    await show(id, { children: <ArchivedHistory channelId={id} /> });
    expect(page().querySelector(".arch-body")?.childElementCount).toBe(0);
  });
});

describe("the header (R15)", () => {
  test("a public channel with a topic: Back, hash, name, the Archived tag and the topic", async () => {
    const id = await setup({ topic: "Q3 work" });
    const onBack = vi.fn();
    await show(id, { onBack });
    const mh = page().querySelector(".mh")!;
    const back = mh.querySelector("button.ib.back") as HTMLElement;
    expect(back).toHaveAccessibleName("Back to conversations");
    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledOnce();
    expect(heading().className).toBe("ell");
    expect(heading().querySelector("svg path")?.getAttribute("d")).toBe(HASH);
    expect(heading().querySelector("span.ell")).toHaveTextContent("old-design");
    expect(heading().querySelector("span.tag")).toHaveTextContent("Archived");
    expect(mh.querySelector(".topic.ell")).toHaveTextContent("Q3 work");
  });

  test("a private channel with no topic: lock, no topic element", async () => {
    const id = await setup({ isPrivate: true, topic: null });
    await show(id);
    expect(heading().querySelector("svg path")?.getAttribute("d")).toMatch(
      /^M5 11h14/,
    );
    expect(page().querySelector(".topic")).toBeNull();
  });

  test("a topic with markup is shown as text", async () => {
    const id = await setup({ topic: "<b>x</b>" });
    await show(id);
    expect(page().querySelector(".topic")?.textContent).toBe("<b>x</b>");
    expect(page().querySelector(".topic b")).toBeNull();
  });

  test("draws no members, search, tab or Leave control", async () => {
    const id = await setup();
    await show(id);
    expect(page().querySelector(".memb")).toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /members|search|leave/i }),
    ).toBeNull();
  });

  test("one h1, the channel's name", async () => {
    const id = await setup();
    await show(id);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  test("no name while no detail is held, and the name once the read has answered", async () => {
    const id = await setup();
    let release: () => void = () => {};
    h.api.channels.get.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ channel: h.details[id] });
        }),
    );
    await mountConversation(
      (cid) => <ArchivedChannelPage channelId={cid} onBack={() => {}} />,
      { path: `/c/${id}` },
    );
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    release();
    await flush();
    expect(heading()).toHaveTextContent("old-design");
  });
});

describe("the notice (R17)", () => {
  test.each([["member"], ["admin"]] as const)(
    "is the last element, role status, with the text, for a %s",
    async (role) => {
      const id = await setup({}, role);
      await show(id);
      const notice = page().lastElementChild as HTMLElement;
      expect(notice.className).toBe("arch-notice");
      expect(notice).toHaveAttribute("role", "status");
      expect(notice).toHaveTextContent("This channel has been archived");
      expect(notice.querySelector("button, a")).toBeNull();
    },
  );

  test("reads in Vietnamese", async () => {
    const id = await setup();
    await show(id, { language: "vi" });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Kênh này đã được lưu trữ",
    );
    expect(heading().querySelector("span.tag")).toHaveTextContent("Đã lưu trữ");
  });
});

describe("the read of the page (R16)", () => {
  test("two mounts while the read runs make one request; a mount after it settled reads again", async () => {
    const id = await setup();
    let release: () => void = () => {};
    h.api.channels.get.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ channel: h.details[id] });
        }),
    );
    await mountConversation(
      (cid) => (
        <>
          <ArchivedChannelPage channelId={cid} onBack={() => {}} />
          <ArchivedChannelPage channelId={cid} onBack={() => {}} />
        </>
      ),
      { path: `/c/${id}` },
    );
    expect(h.api.channels.get).toHaveBeenCalledTimes(1);
    release();
    await flush();
    document.body.innerHTML = "";
    await show(id);
    expect(h.api.channels.get).toHaveBeenCalledTimes(1);
  });

  test("a 404 draws the not-found view", async () => {
    const id = await setup();
    h.api.channels.get.mockRejectedValueOnce(http(404));
    await show(id, { held: false });
    expect(screen.getByText("Page not found")).toBeInTheDocument();
  });

  test("any other failure keeps what is held and shows nothing", async () => {
    const id = await setup({ topic: "Q3 work" });
    await h.store.readChannel(id);
    h.api.channels.get.mockRejectedValueOnce(http(500));
    await show(id, { held: false });
    expect(heading()).toHaveTextContent("old-design");
    expect(screen.queryByText("Page not found")).toBeNull();
    expect(screen.queryByText("That did not work. Try again.")).toBeNull();
  });
});
