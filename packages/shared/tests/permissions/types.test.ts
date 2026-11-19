import { describe, expect, expectTypeOf, it } from "vitest";
import { DENY_REASONS } from "../../src/index.js";
import type {
  Actor,
  ActorInput,
  ConversationFacts,
  Decision,
  DeleteDecision,
  DenyReason,
  MessageFacts,
  Role,
  TargetPerson,
} from "../../src/index.js";

// expectTypeOf checks nothing at runtime: `pnpm typecheck` (tsc over src, test
// files included) is what fails when the type drifts.
describe("ConversationFacts (TOKI-027 R2)", () => {
  it("has the four facts and the four kinds", () => {
    expectTypeOf<ConversationFacts>().toEqualTypeOf<{
      kind: "public_channel" | "private_channel" | "dm" | "group_dm";
      isGeneral: boolean;
      archived: boolean;
      isMember: boolean;
    }>();
  });
});

describe("the other types (R2)", () => {
  it("has two roles and no Owner", () => {
    expectTypeOf<Role>().toEqualTypeOf<"member" | "admin">();
  });

  it("types the actor, and the actor as a caller passes it", () => {
    expectTypeOf<Actor>().toEqualTypeOf<{ id: string; role: Role }>();
    expectTypeOf<ActorInput>().toEqualTypeOf<{ id: string; role: string }>();
    expectTypeOf<Actor>().toExtend<ActorInput>();
  });

  it("types the message facts and the target person", () => {
    expectTypeOf<MessageFacts>().toEqualTypeOf<{ authorId: string }>();
    expectTypeOf<TargetPerson>().toEqualTypeOf<{
      id: string;
      role: Role;
      status: "active" | "deactivated";
    }>();
  });

  it("types the two results", () => {
    expectTypeOf<Decision>().toEqualTypeOf<
      { allowed: true } | { allowed: false; reason: DenyReason }
    >();
    expectTypeOf<DeleteDecision>().toEqualTypeOf<
      | { allowed: true; as: "author" | "admin" }
      | { allowed: false; reason: DenyReason }
    >();
  });
});

describe("DENY_REASONS (R2)", () => {
  it("is exactly the eleven codes, in the order of R3", () => {
    expect([...DENY_REASONS]).toEqual([
      "fact_missing",
      "unknown_role",
      "role_not_allowed",
      "not_a_member",
      "not_a_channel",
      "private_channel",
      "channel_is_general",
      "channel_archived",
      "not_author",
      "self_target",
      "last_admin",
    ]);
    expectTypeOf<DenyReason>().toEqualTypeOf<(typeof DENY_REASONS)[number]>();
  });
});
