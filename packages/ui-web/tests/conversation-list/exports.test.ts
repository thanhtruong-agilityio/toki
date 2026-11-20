import { describe, expect, test } from "vitest";
import * as list from "../../src/conversation-list/index";
import * as entry from "../../src/index";
import type {
  ConversationGroup,
  ConversationListProps,
  ConversationRowData,
} from "../../src/conversation-list/index";
import type {
  ConversationGroup as ConversationGroupEntry,
  ConversationListProps as ConversationListPropsEntry,
  ConversationRowData as ConversationRowDataEntry,
} from "../../src/index";

// A missing type fails `pnpm typecheck` on the imports above; the tuple uses each one.
type ListTypes = [
  ConversationGroup,
  ConversationListProps,
  ConversationRowData,
  ConversationGroupEntry,
  ConversationListPropsEntry,
  ConversationRowDataEntry,
];
export type { ListTypes };

describe("conversation list exports (R1)", () => {
  test("the module exports the names of R1 and nothing else as a value", () => {
    expect(Object.keys(list).sort()).toEqual([
      "ConversationList",
      "conversationGroupIds",
    ]);
    expect(list.conversationGroupIds).toEqual([
      "starred",
      "channels",
      "direct",
    ]);
  });

  test("src/index.ts re-exports them", () => {
    for (const name of Object.keys(list))
      expect(entry, name).toHaveProperty(name);
  });
});
