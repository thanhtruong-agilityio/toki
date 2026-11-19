import { describe, expect, it } from "vitest";
import {
  canDeleteMessage,
  canEditMessage,
  canPinMessage,
  canPostInConversation,
  canReadConversation,
  canUseAtChannel,
} from "../../src/index.js";
import type { ConversationFacts } from "../../src/index.js";
import { admin, allow, conv, deny, member, roles } from "./fixtures.js";

const kinds: ConversationFacts["kind"][] = [
  "public_channel",
  "private_channel",
  "dm",
  "group_dm",
];
const other = { authorId: "user-someone-else" };

describe("canReadConversation (R5)", () => {
  it("allows a member of any kind of conversation, archived or not", () => {
    for (const actor of roles) {
      for (const kind of kinds) {
        expect(canReadConversation(actor, conv({ kind }))).toEqual(allow);
        expect(
          canReadConversation(actor, conv({ kind, archived: true })),
        ).toEqual(allow);
      }
    }
  });

  it("gives an Admin no extra right to read (D-047)", () => {
    for (const actor of roles) {
      for (const kind of kinds) {
        expect(
          canReadConversation(actor, conv({ kind, isMember: false })),
        ).toEqual(deny("not_a_member"));
      }
    }
  });
});

describe("canPostInConversation (R5)", () => {
  it("allows a member of a conversation that is not archived", () => {
    for (const actor of roles) {
      for (const kind of kinds) {
        expect(canPostInConversation(actor, conv({ kind }))).toEqual(allow);
      }
    }
  });

  it("refuses an archived conversation and a non-member", () => {
    for (const actor of roles) {
      expect(canPostInConversation(actor, conv({ archived: true }))).toEqual(
        deny("channel_archived"),
      );
      expect(
        canPostInConversation(actor, conv({ kind: "dm", isMember: false })),
      ).toEqual(deny("not_a_member"));
    }
  });

  it("names the membership before the archive (R3)", () => {
    expect(
      canPostInConversation(admin, conv({ isMember: false, archived: true })),
    ).toEqual(deny("not_a_member"));
  });
});

describe("canUseAtChannel (R6)", () => {
  it("allows any member of a channel", () => {
    for (const actor of roles) {
      expect(canUseAtChannel(actor, conv())).toEqual(allow);
      expect(canUseAtChannel(actor, conv({ kind: "private_channel" }))).toEqual(
        allow,
      );
      expect(canUseAtChannel(actor, conv({ isGeneral: true }))).toEqual(allow);
    }
  });

  it("refuses a DM, a non-member and an archived channel", () => {
    for (const actor of roles) {
      expect(canUseAtChannel(actor, conv({ kind: "dm" }))).toEqual(
        deny("not_a_channel"),
      );
      expect(canUseAtChannel(actor, conv({ kind: "group_dm" }))).toEqual(
        deny("not_a_channel"),
      );
      expect(canUseAtChannel(actor, conv({ isMember: false }))).toEqual(
        deny("not_a_member"),
      );
      expect(canUseAtChannel(actor, conv({ archived: true }))).toEqual(
        deny("channel_archived"),
      );
    }
  });

  it("follows the order of R3", () => {
    expect(
      canUseAtChannel(member, conv({ kind: "dm", isMember: false })),
    ).toEqual(deny("not_a_member"));
    expect(
      canUseAtChannel(member, conv({ kind: "dm", archived: true })),
    ).toEqual(deny("not_a_channel"));
  });
});

describe("canPinMessage (R6)", () => {
  it("allows any member of a conversation of any kind", () => {
    for (const actor of roles) {
      for (const kind of kinds) {
        expect(canPinMessage(actor, conv({ kind }))).toEqual(allow);
      }
    }
  });

  it("refuses a non-member and an archived conversation", () => {
    for (const actor of roles) {
      expect(canPinMessage(actor, conv({ isMember: false }))).toEqual(
        deny("not_a_member"),
      );
      expect(canPinMessage(actor, conv({ archived: true }))).toEqual(
        deny("channel_archived"),
      );
    }
  });
});

describe("canEditMessage (R7)", () => {
  it("allows only the author, a Member and an Admin alike", () => {
    for (const actor of roles) {
      expect(canEditMessage(actor, conv(), { authorId: actor.id })).toEqual(
        allow,
      );
      expect(canEditMessage(actor, conv(), other)).toEqual(deny("not_author"));
    }
  });

  it("refuses a non-member and an archived conversation", () => {
    for (const actor of roles) {
      const own = { authorId: actor.id };
      expect(canEditMessage(actor, conv({ isMember: false }), own)).toEqual(
        deny("not_a_member"),
      );
      expect(canEditMessage(actor, conv({ archived: true }), own)).toEqual(
        deny("channel_archived"),
      );
    }
  });

  it("names the archive before the author (R3)", () => {
    expect(canEditMessage(admin, conv({ archived: true }), other)).toEqual(
      deny("channel_archived"),
    );
  });

  it("compares the ids as they are, case included (R4)", () => {
    expect(
      canEditMessage(member, conv(), { authorId: member.id.toUpperCase() }),
    ).toEqual(deny("not_author"));
  });
});

describe("canDeleteMessage (R7)", () => {
  it("allows the author, as the author, also when the author is an Admin", () => {
    for (const actor of roles) {
      expect(canDeleteMessage(actor, conv(), { authorId: actor.id })).toEqual({
        allowed: true,
        as: "author",
      });
    }
  });

  it("allows an Admin who is a member to delete another person's message, as an admin", () => {
    for (const kind of kinds) {
      expect(canDeleteMessage(admin, conv({ kind }), other)).toEqual({
        allowed: true,
        as: "admin",
      });
    }
  });

  it("refuses a Member who is not the author", () => {
    expect(canDeleteMessage(member, conv(), other)).toEqual(deny("not_author"));
  });

  it("refuses an Admin who is not a member of a private channel or a DM", () => {
    for (const kind of ["private_channel", "dm"] as const) {
      expect(
        canDeleteMessage(admin, conv({ kind, isMember: false }), other),
      ).toEqual(deny("not_a_member"));
    }
  });

  it("refuses everyone in an archived conversation", () => {
    for (const actor of roles) {
      expect(
        canDeleteMessage(actor, conv({ archived: true }), {
          authorId: actor.id,
        }),
      ).toEqual(deny("channel_archived"));
    }
    expect(canDeleteMessage(admin, conv({ archived: true }), other)).toEqual(
      deny("channel_archived"),
    );
  });
});
