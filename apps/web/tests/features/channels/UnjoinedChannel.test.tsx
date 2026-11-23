// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@toki/client-core";
import { ErrorCodes } from "@toki/shared";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { UnjoinedChannel } from "../../../src/features/channels/UnjoinedChannel";
import { UnjoinedView } from "../../../src/conversation/UnjoinedView";
import { setConnectionCheck } from "../../../src/patterns/online";
import { Providers } from "../../support/providers";
import { fake, resetFake } from "../fakeDeps";

vi.mock("../../../src/features/deps", async () =>
  (await import("../fakeDeps")).makeDepsMock(),
);

const summary = (over: Record<string, unknown> = {}) => ({
  id: "c1",
  name: "design",
  topic: "Pixels and type",
  isPrivate: false,
  isGeneral: false,
  archived: false,
  memberCount: 12,
  isMember: false,
  ...over,
});
const http = (status: number, code: string) =>
  new ApiError({ kind: "http", status, code });

beforeEach(resetFake);
afterEach(() => setConnectionCheck(null));

function setup() {
  const props = {
    channelId: "c1",
    onJoined: vi.fn(),
    onMember: vi.fn(),
    onNotFound: vi.fn(),
  };
  const view = render(
    <Providers>
      <UnjoinedChannel {...props} />
    </Providers>,
  );
  return { props, ...view };
}

describe("UnjoinedChannel (TOKI-034 R16)", () => {
  test("shows loading, then (a) the name, topic, count and Join, and nothing else", async () => {
    let release: (v: unknown) => void = () => {};
    fake.readChannel.mockReturnValue(new Promise((r) => (release = r)));
    const { container } = setup();
    expect(screen.getByText("Loading channels")).toHaveClass("muted");
    expect(fake.readChannel).toHaveBeenCalledWith("c1");
    await act(async () => release(summary()));
    expect(container.textContent).toBe("designPixels and type12 membersJoin");
    expect(container.querySelector("h2")!.textContent).toBe("design");
    expect(screen.getByRole("button", { name: "Join" }).className).toContain(
      "primary",
    );
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  test("(b) an archived channel shows the label and no button", async () => {
    fake.readChannel.mockResolvedValue(summary({ archived: true }));
    setup();
    expect(await screen.findByText("Archived")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("(c) a member: nothing is drawn and onMember gets the answer once", async () => {
    const detail = summary({ isMember: true });
    fake.readChannel.mockResolvedValue(detail);
    const { props, container } = setup();
    await waitFor(() => expect(props.onMember).toHaveBeenCalledTimes(1));
    expect(props.onMember).toHaveBeenCalledWith(detail);
    expect(container.textContent).toBe("");
  });

  test.each([404, 403, 400])(
    "(d) a %s calls onNotFound once and draws nothing of the channel",
    async (status) => {
      fake.readChannel.mockRejectedValue(http(status, ErrorCodes.notFound));
      const { props, container } = setup();
      await waitFor(() => expect(props.onNotFound).toHaveBeenCalledTimes(1));
      expect(container.textContent).toBe("");
      expect(props.onMember).not.toHaveBeenCalled();
    },
  );

  test("another failure shows the line and Retry, which asks again", async () => {
    const user = userEvent.setup();
    fake.readChannel.mockRejectedValueOnce(http(500, ErrorCodes.internalError));
    fake.readChannel.mockResolvedValueOnce(summary());
    setup();
    expect(
      await screen.findByText("Channels could not be loaded."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("design")).toBeInTheDocument();
    expect(fake.readChannel).toHaveBeenCalledTimes(2);
  });

  test("Join follows R11: the store is asked, then onJoined(id), then the toast", async () => {
    const user = userEvent.setup();
    fake.readChannel.mockResolvedValue(summary());
    const { props } = setup();
    await user.click(await screen.findByRole("button", { name: "Join" }));
    expect(fake.joinChannel).toHaveBeenCalledWith("c1");
    expect(props.onJoined).toHaveBeenCalledWith("c1");
    expect(await screen.findByText("Joined #design")).toBeInTheDocument();
  });

  test("Join offline sends nothing", async () => {
    const user = userEvent.setup();
    setConnectionCheck(() => false);
    fake.readChannel.mockResolvedValue(summary());
    setup();
    await user.click(await screen.findByRole("button", { name: "Join" }));
    expect(fake.joinChannel).not.toHaveBeenCalled();
  });

  test("a join that fails shows one line and keeps the view", async () => {
    const user = userEvent.setup();
    fake.readChannel.mockResolvedValue(summary());
    fake.joinChannel.mockRejectedValue(http(500, ErrorCodes.internalError));
    const { props } = setup();
    await user.click(await screen.findByRole("button", { name: "Join" }));
    expect(
      await screen.findByText("That did not work. Try again."),
    ).toHaveAttribute("role", "alert");
    expect(props.onJoined).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Join" })).toBeEnabled();
  });

  test("a join refused because the channel was archived reads it again and shows the label", async () => {
    const user = userEvent.setup();
    fake.readChannel
      .mockResolvedValueOnce(summary())
      .mockResolvedValueOnce(summary({ archived: true }));
    fake.joinChannel.mockRejectedValue(http(409, ErrorCodes.channelArchived));
    setup();
    await user.click(await screen.findByRole("button", { name: "Join" }));
    expect(await screen.findByText("Archived")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Join" })).toBeNull();
  });

  test("asks only readChannel and joinChannel (R15)", async () => {
    const user = userEvent.setup();
    fake.readChannel.mockResolvedValue(summary());
    setup();
    await user.click(await screen.findByRole("button", { name: "Join" }));
    expect(fake.list).not.toHaveBeenCalled();
    expect(fake.openDirect).not.toHaveBeenCalled();
  });

  test("the body of UnjoinedView renders UnjoinedChannel with the four props", async () => {
    fake.readChannel.mockResolvedValue(summary());
    render(
      <Providers>
        <UnjoinedView
          channelId="c1"
          onJoined={() => {}}
          onMember={() => {}}
          onNotFound={() => {}}
        />
      </Providers>,
    );
    expect(await screen.findByText("Pixels and type")).toBeInTheDocument();
  });
});
