import { BootstrapResponse } from "@toki/shared";
import { describe, expect, test } from "vitest";
import {
  fiveHundred,
  forty,
  generalOnly,
  twelve,
} from "../../../e2e/support/fixtures";
import { LAUNCH, world } from "../../../e2e/support/prototype-world";

// R30: the workspaces of the browser tests are parsed with the strict schema the server's answer
// has, so a change of the contract fails here and not in a browser run that stubs a wrong body.
describe("the fixtures of e2e/conversation-list.spec.ts", () => {
  test.each([
    ["general only", generalOnly, 1],
    ["twelve", twelve, 12],
    ["forty", forty, 40],
    ["five hundred", fiveHundred, 500],
  ])("%s parses with the bootstrap schema", (_name, make, count) => {
    const body = make();
    expect(() => BootstrapResponse.parse(body)).not.toThrow();
    expect(body.conversations).toHaveLength(count);
    expect(body.conversations.filter((c) => c.isGeneral)).toHaveLength(1);
  });

  test("the twelve are as R30 says", () => {
    const { conversations, members } = twelve();
    const kinds = (kind: string) =>
      conversations.filter((c) => c.kind === kind).length;
    // 6 channels (one private, one starred), 5 direct messages and one group of 3.
    expect(kinds("channel")).toBe(6);
    expect(kinds("dm")).toBe(5);
    expect(kinds("group_dm")).toBe(1);
    expect(
      conversations.filter((c) => c.isPrivate && c.kind === "channel"),
    ).toHaveLength(1);
    expect(conversations.filter((c) => c.isStarred)).toHaveLength(1);
    expect(members).toHaveLength(8);
  });
});

// TOKI-141 R1: the sample workspace of the prototype, for the screens of the UI parity check.
describe("the world of the prototype (e2e/support/prototype-world.ts)", () => {
  test("parses with the bootstrap schema", () => {
    expect(() => BootstrapResponse.parse(world())).not.toThrow();
  });

  test("is Hugepig Studio with Lan as the person of the session, an Admin", () => {
    const body = world();
    expect(body.workspace.name).toBe("Hugepig Studio");
    expect(body.user.displayName).toBe("Lan Nguyễn");
    expect(body.user.role).toBe("admin");
    expect(body.members.find((m) => m.id === body.user.id)?.displayName).toBe(
      "Lan Nguyễn",
    );
  });

  test("holds 8 people and 12 conversations, one starred, as the prototype's", () => {
    const { members, conversations } = world();
    expect(members).toHaveLength(8);
    expect(conversations).toHaveLength(12);
    expect(conversations.filter((c) => c.kind === "channel")).toHaveLength(8);
    expect(conversations.filter((c) => c.kind !== "channel")).toHaveLength(4);
    const starred = conversations.filter((c) => c.isStarred);
    expect(starred).toHaveLength(1);
    expect(starred[0]?.id).toBe(LAUNCH);
    expect(starred[0]?.name).toBe("project-launch");
  });

  test("has the private channels and the one general channel", () => {
    const { conversations } = world();
    const privateNames = conversations
      .filter((c) => c.kind === "channel" && c.isPrivate)
      .map((c) => c.name)
      .sort();
    expect(privateNames).toEqual(["client-saigon-coffee", "leadership"]);
    expect(conversations.filter((c) => c.isGeneral)).toHaveLength(1);
  });
});
