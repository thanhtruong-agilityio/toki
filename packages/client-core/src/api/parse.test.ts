import {
  AddMembersResponseSchema,
  BootstrapResponse,
  BrowseChannelsResponseSchema,
  ChangeChannelResponseSchema,
  ChannelMembersResponseSchema,
  LeaveChannelResponseSchema,
  RemoveMemberResponseSchema,
  ChannelDetailSchema,
  ChannelResponseSchema,
  ChannelSummarySchema,
  CreateChannelResponseSchema,
  ErrorResponseSchema,
  GetChannelResponseSchema,
  OpenDirectResponseSchema,
  UpdateSettingsResponseSchema,
} from "@toki/shared";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import { bootstrapBody, detailBody, id, summaryBody } from "./fixtures";
import { lenient } from "./parse";

const parse = <T extends z.ZodType>(schema: T, value: unknown) =>
  lenient(schema).safeParse(value);

describe("lenient (R3): unknown keys are dropped at every level", () => {
  it("parses the rich body, and keeps what is known", () => {
    const body = bootstrapBody();
    const result = parse(BootstrapResponse, body);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(body);
  });

  it("drops one added key at the top, in user, in workspace, in a member, in a channel and in a direct entry", () => {
    const body = bootstrapBody() as unknown as {
      [key: string]: unknown;
      user: Record<string, unknown>;
      workspace: Record<string, unknown>;
      members: Record<string, unknown>[];
      conversations: Record<string, unknown>[];
    };
    body.extra = 1;
    body.user.extra = 1;
    body.workspace.extra = 1;
    body.members[0].extra = 1;
    body.conversations[0].extra = 1; // a channel entry
    body.conversations[3].extra = 1; // a dm entry
    body.conversations[5].extra = 1; // a group entry
    const result = parse(BootstrapResponse, body);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(bootstrapBody());
    expect(JSON.stringify(result.data)).not.toContain("extra");
  });

  it("still fails on a missing key, a wrong type and a value outside an enum", () => {
    const missing = bootstrapBody() as unknown as Record<string, unknown>;
    delete missing.eventNumber;
    expect(parse(BootstrapResponse, missing).success).toBe(false);

    const loud = bootstrapBody();
    (loud.conversations[0] as { notificationLevel: string }).notificationLevel =
      "loud";
    expect(parse(BootstrapResponse, loud).success).toBe(false);

    const nullDm = bootstrapBody();
    (nullDm.conversations[3] as { memberIds: unknown }).memberIds = null;
    expect(parse(BootstrapResponse, nullDm).success).toBe(false);

    const wrongType = bootstrapBody() as unknown as Record<string, unknown>;
    wrongType.eventNumber = "41";
    expect(parse(BootstrapResponse, wrongType).success).toBe(false);
  });

  it("keeps the checks of the leaves: a memberIds that is not a UUID, an event number of -1 or 1.5", () => {
    const bad = bootstrapBody();
    (bad.conversations[3] as { memberIds: string[] }).memberIds = ["x", "y"];
    expect(parse(BootstrapResponse, bad).success).toBe(false);
    for (const n of [-1, 1.5]) {
      expect(
        parse(BootstrapResponse, { ...bootstrapBody(), eventNumber: n })
          .success,
      ).toBe(false);
    }
    const stat = { ...summaryBody(), memberCount: -1 };
    expect(parse(ChannelSummarySchema, stat).success).toBe(false);
  });

  it("works on the channel and the direct-conversation answers", () => {
    const create = { channel: { ...detailBody(), extra: 1 }, extra: 1 };
    expect(parse(CreateChannelResponseSchema, create).data).toEqual({
      channel: detailBody(),
    });
    const direct = bootstrapBody().conversations[3];
    const answer = { conversation: { ...direct, extra: 1 }, extra: 1 };
    expect(parse(OpenDirectResponseSchema, answer).data).toEqual({
      conversation: direct,
    });
    const settings = {
      settings: {
        notificationLevel: "all",
        isMuted: true,
        isStarred: false,
        extra: 1,
      },
      changed: true,
    };
    expect(parse(UpdateSettingsResponseSchema, settings).success).toBe(true);
  });

  it("reads the error body with the shared error schema", () => {
    const result = parse(ErrorResponseSchema, {
      error: { code: "x", message: "m", details: { a: 1 }, extra: 1 },
    });
    expect(result.success).toBe(true);
  });
});

describe("lenient (R3): a union picks its branch by its keys", () => {
  it("reads a detail plus an added key as a detail, never as a summary that loses fields", () => {
    const answer = { channel: { ...detailBody(), extra: 1 } };
    const result = parse(GetChannelResponseSchema, answer);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ channel: detailBody() });
  });

  it("reads a summary plus an added key as a summary", () => {
    const answer = { channel: { ...summaryBody(), extra: 1 } };
    const result = parse(GetChannelResponseSchema, answer);
    expect(result.data).toEqual({ channel: summaryBody() });
  });

  it("tries the union option with the most required keys first, whatever the order of the schema", () => {
    const reversed = z.union([ChannelSummarySchema, ChannelDetailSchema]);
    const result = parse(reversed, { ...detailBody(), extra: 1 });
    expect(result.data).toEqual(detailBody());
    const plain = parse(ChannelResponseSchema, detailBody());
    expect(plain.data).toEqual(detailBody());
  });

  it("separates the entries of a conversation by kind", () => {
    const body = bootstrapBody();
    const result = parse(BootstrapResponse, body);
    expect(result.success).toBe(true);
    expect(
      (result.data as { conversations: { kind: string }[] }).conversations.map(
        (c) => c.kind,
      ),
    ).toEqual(["channel", "channel", "channel", "dm", "dm", "group_dm"]);
  });
});

describe("lenient: the schema types of the shared response schemas", () => {
  it("walks every response schema the client reads, and they use only the listed types", () => {
    const schemas = [
      BootstrapResponse,
      CreateChannelResponseSchema,
      GetChannelResponseSchema,
      ChannelResponseSchema,
      OpenDirectResponseSchema,
      UpdateSettingsResponseSchema,
      ErrorResponseSchema,
      BrowseChannelsResponseSchema,
      ChannelMembersResponseSchema,
      ChangeChannelResponseSchema,
      AddMembersResponseSchema,
      LeaveChannelResponseSchema,
      RemoveMemberResponseSchema,
    ];
    const seen = new Set<string>();
    const visit = (schema: unknown): void => {
      const def = (schema as { _zod: { def: Record<string, unknown> } })._zod
        .def;
      seen.add(def.type as string);
      if (def.type === "object")
        Object.values(def.shape as object).forEach(visit);
      if (def.type === "array") visit(def.element);
      if (def.type === "union") (def.options as unknown[]).forEach(visit);
      if (["optional", "nullable"].includes(def.type as string))
        visit(def.innerType);
    };
    for (const schema of schemas) {
      visit(schema);
      expect(() => lenient(schema)).not.toThrow();
    }
    // A new type in a shared schema must be decided here, not found in production.
    expect([...seen].sort()).toEqual(
      [
        "array",
        "boolean",
        "enum",
        "literal",
        "null",
        "nullable",
        "number",
        "object",
        "optional",
        "string",
        "union",
        "unknown",
      ].sort(),
    );
  });
});

describe("lenient: the schemas of the shared package are untouched", () => {
  it("still rejects an added key", () => {
    expect(
      BootstrapResponse.safeParse({ ...bootstrapBody(), extra: 1 }).success,
    ).toBe(false);
    expect(
      ChannelDetailSchema.safeParse({ ...detailBody(), extra: 1 }).success,
    ).toBe(false);
    lenient(BootstrapResponse);
    expect(
      BootstrapResponse.safeParse({ ...bootstrapBody(), extra: 1 }).success,
    ).toBe(false);
  });

  it("returns the same schema for the same schema (cached)", () => {
    expect(lenient(BootstrapResponse)).toBe(lenient(BootstrapResponse));
  });

  it("throws on a schema type it does not know, naming it", () => {
    const odd = z.object({ a: z.lazy(() => z.string()) });
    expect(() => lenient(odd)).toThrow(/lazy/);
  });

  it("passes z.undefined() and z.unknown() through", () => {
    expect(parse(z.undefined(), undefined).success).toBe(true);
    expect(parse(z.unknown(), { a: 1 }).data).toEqual({ a: 1 });
  });

  it("an id helper exists", () => {
    expect(id(1)).toHaveLength(36);
  });
});
