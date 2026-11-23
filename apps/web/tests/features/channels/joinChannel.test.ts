import { ApiError } from "@toki/client-core";
import { ErrorCodes } from "@toki/shared";
import { describe, expect, test, vi } from "vitest";
import { joinChannel } from "../../../src/features/channels/joinChannel";

function setup(join: (id: string) => Promise<void>, mounted = () => true) {
  const log: string[] = [];
  const ensureOnline = vi.fn(() => true);
  const args = {
    id: "c1",
    name: "design",
    ensureOnline,
    join: vi.fn(async (id: string) => {
      log.push("join");
      await join(id);
    }),
    show: vi.fn(({ text }: { text: string }) => void log.push(`toast:${text}`)),
    t: (_key: "browse.joined", p: { name: string }) => `Joined #${p.name}`,
    isMounted: mounted,
    onJoined: vi.fn(() => void log.push("joined")),
  };
  return { args, log, ensureOnline };
}

const http = (status: number, code: string) =>
  new ApiError({ kind: "http", status, code });

describe("joinChannel (TOKI-034 R11, R13)", () => {
  test("offline: nothing is sent", async () => {
    const { args, ensureOnline } = setup(async () => {});
    ensureOnline.mockReturnValue(false);
    expect(await joinChannel(args)).toEqual({ kind: "blocked" });
    expect(args.join).not.toHaveBeenCalled();
    expect(args.show).not.toHaveBeenCalled();
  });

  test("the store is asked, then onJoined, then the toast, in that order", async () => {
    const { args, log } = setup(async () => {});
    expect(await joinChannel(args)).toEqual({ kind: "joined" });
    expect(args.join).toHaveBeenCalledWith("c1");
    expect(log).toEqual(["join", "joined", "toast:Joined #design"]);
  });

  test("closed while the request was held: the toast still shows and onJoined is not called", async () => {
    let mounted = true;
    const { args, log } = setup(
      async () => {
        mounted = false;
      },
      () => mounted,
    );
    expect(await joinChannel(args)).toEqual({ kind: "joined" });
    expect(args.onJoined).not.toHaveBeenCalled();
    expect(log).toEqual(["join", "toast:Joined #design"]);
  });

  test("409 channel_archived is its own result and shows no toast", async () => {
    const { args } = setup(async () => {
      throw http(409, ErrorCodes.channelArchived);
    });
    expect(await joinChannel(args)).toEqual({ kind: "archived" });
    expect(args.show).not.toHaveBeenCalled();
    expect(args.onJoined).not.toHaveBeenCalled();
  });

  test.each([
    [403, ErrorCodes.forbidden],
    [404, ErrorCodes.notFound],
    [500, ErrorCodes.internalError],
    [409, ErrorCodes.channelIsGeneral],
  ])("a %s %s is a plain failure", async (status, code) => {
    const { args } = setup(async () => {
      throw http(status, code);
    });
    expect(await joinChannel(args)).toEqual({ kind: "failed" });
    expect(args.show).not.toHaveBeenCalled();
  });

  test("no answer is a plain failure", async () => {
    const { args } = setup(async () => {
      throw new ApiError({ kind: "timeout" });
    });
    expect(await joinChannel(args)).toEqual({ kind: "failed" });
  });
});
