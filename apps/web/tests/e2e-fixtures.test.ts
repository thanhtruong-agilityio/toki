import { BootstrapResponse } from "@toki/shared";
import { describe, expect, test } from "vitest";
import {
  fiveHundred,
  forty,
  generalOnly,
  twelve,
} from "../../../e2e/support/fixtures";

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
