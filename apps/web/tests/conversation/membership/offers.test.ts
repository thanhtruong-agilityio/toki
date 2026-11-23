import {
  canAddPeopleToChannel,
  canRemovePeopleFromChannel,
  type ConversationFacts,
} from "@toki/shared";
import { describe, expect, test } from "vitest";
import { candidatesFor } from "../../../src/conversation/membership/candidates";
import { membershipOffers } from "../../../src/conversation/membership/offers";

const admin = { id: "a1", role: "admin" };
const member = { id: "m1", role: "member" };
const open = { archived: false };

const publicCh = {
  kind: "channel",
  isPrivate: false,
  isGeneral: false,
} as const;
const privateCh = {
  kind: "channel",
  isPrivate: true,
  isGeneral: false,
} as const;
const general = { kind: "channel", isPrivate: false, isGeneral: true } as const;

describe("membershipOffers (R4)", () => {
  test.each([
    ["Member, public", publicCh, open, member, true, false],
    ["Admin, public", publicCh, open, admin, true, true],
    ["Member, private", privateCh, open, member, true, false],
    ["Admin, private", privateCh, open, admin, true, true],
    ["Member, #general", general, open, member, true, false],
    ["Admin, #general", general, open, admin, true, false],
    ["Admin, archived", publicCh, { archived: true }, admin, false, false],
    ["Member, archived", publicCh, { archived: true }, member, false, false],
    ["Admin, dm", { kind: "dm" }, open, admin, false, false],
    ["Admin, group", { kind: "group_dm" }, open, admin, false, false],
    ["detail missing", publicCh, undefined, admin, false, false],
    ["detail null", publicCh, null, admin, false, false],
    ["user missing", publicCh, open, undefined, false, false],
    ["conversation missing", undefined, open, admin, false, false],
    ["unknown role", publicCh, open, { id: "x", role: "guest" }, false, false],
  ] as const)("%s", (_name, conversation, detail, actor, add, removeRows) => {
    expect(
      membershipOffers({
        conversation: conversation as never,
        detail: detail as never,
        actor: actor as never,
      }),
    ).toEqual({ add, removeRows });
  });

  test("agrees with the two shared functions", () => {
    const kinds = [
      ["public_channel", publicCh],
      ["private_channel", privateCh],
    ] as const;
    for (const [kind, conversation] of kinds) {
      for (const isGeneral of [false, true]) {
        for (const archived of [false, true]) {
          for (const actor of [admin, member]) {
            const facts: ConversationFacts = {
              kind,
              isGeneral,
              archived,
              isMember: true,
            };
            expect(
              membershipOffers({
                conversation: { ...conversation, isGeneral },
                detail: { archived },
                actor,
              }),
            ).toEqual({
              add: canAddPeopleToChannel(actor, facts).allowed,
              removeRows: canRemovePeopleFromChannel(actor, facts).allowed,
            });
          }
        }
      }
    }
  });
});

describe("candidatesFor (R6)", () => {
  const people = [
    { id: "p1", displayName: "Ann", status: "active" },
    { id: "p2", displayName: "Bao", status: "deactivated" },
    { id: "me", displayName: "Me", status: "active" },
    { id: "p4", displayName: "Cuong", status: "active" },
    { id: "p5", displayName: "Dung", status: "active" },
  ] as never;

  test("active people who are not members and not the signed-in person, in order", () => {
    expect(
      candidatesFor({ people, memberIds: ["p4"], userId: "me" }).map(
        (p) => p.id,
      ),
    ).toEqual(["p1", "p5"]);
  });

  test("an empty member list keeps every active person but the signed-in one", () => {
    expect(
      candidatesFor({ people, memberIds: [], userId: "me" }).map((p) => p.id),
    ).toEqual(["p1", "p4", "p5"]);
  });

  test("an unknown signed-in person excludes nobody extra", () => {
    expect(
      candidatesFor({ people, memberIds: [], userId: undefined }).map(
        (p) => p.id,
      ),
    ).toEqual(["p1", "me", "p4", "p5"]);
  });
});
