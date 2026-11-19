import { describe, expect, it } from "vitest";
import {
  canAddPeopleToChannel,
  canArchiveChannel,
  canCreateChannel,
  canCreateDirectConversation,
  canEditChannelDetails,
  canJoinChannel,
  canLeaveChannel,
  canRemovePeopleFromChannel,
  canRestoreChannel,
} from "../../src/index.js";
import type { ConversationFacts } from "../../src/index.js";
import { admin, allow, conv, deny, member, roles } from "./fixtures.js";

const direct = ["dm", "group_dm"] as const;
const channels = ["public_channel", "private_channel"] as const;

// The facts with one of them left out, as a caller that forgot it would pass.
function without(
  key: keyof ConversationFacts,
  over: Partial<ConversationFacts> = {},
) {
  const facts: Partial<ConversationFacts> = conv(over);
  delete facts[key];
  return facts as ConversationFacts;
}

describe("canCreateChannel (R8)", () => {
  it("allows only an Admin", () => {
    expect(canCreateChannel(admin)).toEqual(allow);
    expect(canCreateChannel(member)).toEqual(deny("role_not_allowed"));
  });
});

describe("canCreateDirectConversation (R8)", () => {
  it("allows a Member and an Admin, also when asked about another person", () => {
    expect(canCreateDirectConversation(member)).toEqual(allow);
    expect(canCreateDirectConversation(admin)).toEqual(allow);
    expect(
      canCreateDirectConversation({ id: "user-other", role: "member" }),
    ).toEqual(allow);
  });

  it("refuses a guest", () => {
    expect(
      canCreateDirectConversation({ id: "user-other", role: "guest" }),
    ).toEqual(deny("unknown_role"));
  });
});

describe("canJoinChannel (R9)", () => {
  it("allows a Member and an Admin on a public channel, with no isMember fact", () => {
    for (const actor of roles) {
      expect(canJoinChannel(actor, conv({ isMember: false }))).toEqual(allow);
      expect(canJoinChannel(actor, conv({ isMember: true }))).toEqual(allow);
      expect(canJoinChannel(actor, without("isMember"))).toEqual(allow);
    }
  });

  it("refuses a private channel, an archived one and a DM", () => {
    for (const actor of roles) {
      expect(
        canJoinChannel(
          actor,
          conv({ kind: "private_channel", isMember: false }),
        ),
      ).toEqual(deny("private_channel"));
      expect(canJoinChannel(actor, conv({ archived: true }))).toEqual(
        deny("channel_archived"),
      );
      for (const kind of direct) {
        expect(canJoinChannel(actor, conv({ kind }))).toEqual(
          deny("not_a_channel"),
        );
      }
    }
  });

  it("names the privacy before the archive (R3)", () => {
    expect(
      canJoinChannel(member, conv({ kind: "private_channel", archived: true })),
    ).toEqual(deny("private_channel"));
  });
});

describe("canAddPeopleToChannel (R9)", () => {
  it("allows a member of a channel, of either role", () => {
    for (const actor of roles) {
      for (const kind of channels) {
        expect(canAddPeopleToChannel(actor, conv({ kind }))).toEqual(allow);
      }
    }
  });

  it("refuses a non-member, a DM and an archived channel", () => {
    for (const actor of roles) {
      expect(canAddPeopleToChannel(actor, conv({ isMember: false }))).toEqual(
        deny("not_a_member"),
      );
      expect(canAddPeopleToChannel(actor, conv({ kind: "group_dm" }))).toEqual(
        deny("not_a_channel"),
      );
      expect(canAddPeopleToChannel(actor, conv({ archived: true }))).toEqual(
        deny("channel_archived"),
      );
    }
  });
});

describe("canRemovePeopleFromChannel (R9)", () => {
  it("allows only an Admin who is a member", () => {
    for (const kind of channels) {
      expect(canRemovePeopleFromChannel(admin, conv({ kind }))).toEqual(allow);
      expect(canRemovePeopleFromChannel(member, conv({ kind }))).toEqual(
        deny("role_not_allowed"),
      );
    }
    expect(
      canRemovePeopleFromChannel(admin, conv({ isMember: false })),
    ).toEqual(deny("not_a_member"));
  });

  it("never removes from #general, a DM or an archived channel", () => {
    expect(
      canRemovePeopleFromChannel(admin, conv({ isGeneral: true })),
    ).toEqual(deny("channel_is_general"));
    expect(
      canRemovePeopleFromChannel(admin, conv({ kind: "group_dm" })),
    ).toEqual(deny("not_a_channel"));
    expect(canRemovePeopleFromChannel(admin, conv({ archived: true }))).toEqual(
      deny("channel_archived"),
    );
  });

  it("follows the order of R3", () => {
    expect(
      canRemovePeopleFromChannel(
        member,
        conv({ isMember: false, isGeneral: true, archived: true }),
      ),
    ).toEqual(deny("role_not_allowed"));
    expect(
      canRemovePeopleFromChannel(
        admin,
        conv({ isGeneral: true, archived: true }),
      ),
    ).toEqual(deny("channel_is_general"));
  });
});

describe("canLeaveChannel (R9)", () => {
  it("allows a member of a channel other than #general, archived or not", () => {
    for (const actor of roles) {
      for (const kind of channels) {
        expect(canLeaveChannel(actor, conv({ kind }))).toEqual(allow);
        expect(canLeaveChannel(actor, conv({ kind, archived: true }))).toEqual(
          allow,
        );
      }
    }
  });

  it("refuses #general, a non-member and a DM", () => {
    for (const actor of roles) {
      expect(canLeaveChannel(actor, conv({ isGeneral: true }))).toEqual(
        deny("channel_is_general"),
      );
      expect(canLeaveChannel(actor, conv({ isMember: false }))).toEqual(
        deny("not_a_member"),
      );
      expect(canLeaveChannel(actor, conv({ kind: "dm" }))).toEqual(
        deny("not_a_channel"),
      );
    }
  });
});

describe("canArchiveChannel (R9)", () => {
  it("allows only an Admin who is a member, whether or not it is archived already", () => {
    for (const kind of channels) {
      expect(canArchiveChannel(admin, conv({ kind }))).toEqual(allow);
      expect(canArchiveChannel(admin, conv({ kind, archived: true }))).toEqual(
        allow,
      );
      expect(canArchiveChannel(member, conv({ kind }))).toEqual(
        deny("role_not_allowed"),
      );
      expect(canArchiveChannel(admin, conv({ kind, isMember: false }))).toEqual(
        deny("not_a_member"),
      );
    }
  });

  it("never archives #general or a DM", () => {
    expect(canArchiveChannel(admin, conv({ isGeneral: true }))).toEqual(
      deny("channel_is_general"),
    );
    expect(canArchiveChannel(admin, conv({ kind: "dm" }))).toEqual(
      deny("not_a_channel"),
    );
  });

  it("follows the order of R3 (R13)", () => {
    expect(
      canArchiveChannel(member, conv({ isMember: false, archived: true })),
    ).toEqual(deny("role_not_allowed"));
    expect(
      canArchiveChannel(admin, conv({ isMember: false, archived: true })),
    ).toEqual(deny("not_a_member"));
  });

  it("refuses when the archived fact is missing, though it does not decide", () => {
    expect(canArchiveChannel(admin, without("archived"))).toEqual(
      deny("fact_missing"),
    );
  });
});

describe("canRestoreChannel (R9, concern 1)", () => {
  it("allows any Admin, a member of the channel or not", () => {
    for (const kind of channels) {
      for (const isMember of [true, false]) {
        expect(
          canRestoreChannel(admin, conv({ kind, isMember, archived: true })),
        ).toEqual(allow);
      }
    }
  });

  // Hiding a private channel from an Admin who is not a member is the work
  // of the API (TOKI-029 R1); the function only answers who may restore.
  it("reads only the kind and #general: no isMember and no archived fact", () => {
    expect(canRestoreChannel(admin, without("isMember"))).toEqual(allow);
    expect(canRestoreChannel(admin, without("archived"))).toEqual(allow);
    expect(canRestoreChannel(admin, conv({ archived: false }))).toEqual(allow);
  });

  it("refuses a Member, #general and a DM", () => {
    expect(canRestoreChannel(member, conv({ archived: true }))).toEqual(
      deny("role_not_allowed"),
    );
    expect(canRestoreChannel(admin, conv({ isGeneral: true }))).toEqual(
      deny("channel_is_general"),
    );
    for (const kind of direct) {
      expect(canRestoreChannel(admin, conv({ kind }))).toEqual(
        deny("not_a_channel"),
      );
    }
  });

  it("never answers not_a_member (R13)", () => {
    expect(
      canRestoreChannel(member, conv({ isMember: false, archived: true })),
    ).toEqual(deny("role_not_allowed"));
    expect(
      canRestoreChannel(admin, conv({ isMember: false, archived: true })),
    ).toEqual(allow);
  });
});

describe("canEditChannelDetails (R9)", () => {
  it("allows a member of a public or a private channel, of either role", () => {
    for (const actor of roles) {
      for (const kind of channels) {
        expect(canEditChannelDetails(actor, conv({ kind }))).toEqual(allow);
      }
      expect(canEditChannelDetails(actor, conv({ isGeneral: true }))).toEqual(
        allow,
      );
    }
  });

  it("refuses a non-member, a DM, a group DM and an archived channel", () => {
    for (const actor of roles) {
      expect(canEditChannelDetails(actor, conv({ isMember: false }))).toEqual(
        deny("not_a_member"),
      );
      for (const kind of direct) {
        expect(canEditChannelDetails(actor, conv({ kind }))).toEqual(
          deny("not_a_channel"),
        );
      }
      expect(canEditChannelDetails(actor, conv({ archived: true }))).toEqual(
        deny("channel_archived"),
      );
    }
  });

  it("follows the order of R3", () => {
    expect(
      canEditChannelDetails(
        member,
        conv({ kind: "dm", isMember: false, archived: true }),
      ),
    ).toEqual(deny("not_a_member"));
  });
});
