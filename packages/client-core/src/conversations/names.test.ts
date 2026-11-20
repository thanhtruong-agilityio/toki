import type { BootstrapConversation, BootstrapPerson } from "@toki/shared";
import { describe, expect, it } from "vitest";
import { bootstrapBody, id } from "../api/fixtures";
import { compareByName, conversationName } from "./names";

const people = (list: Partial<BootstrapPerson>[]) =>
  Object.fromEntries(
    list.map((p) => [
      p.id!,
      { role: "member", status: "active", ...p } as BootstrapPerson,
    ]),
  );
const ME = id(1);
const PEOPLE = people([
  { id: ME, displayName: "Ada" },
  { id: id(2), displayName: "Alex Phạm" },
  { id: id(3), displayName: "Thu Hoàng" },
  { id: id(4), displayName: "Dee", status: "deactivated" },
]);
const entry = (
  kind: "dm" | "group_dm",
  memberIds: string[],
): BootstrapConversation => ({
  id: id(50),
  kind,
  name: null,
  topic: null,
  isPrivate: true,
  isGeneral: false,
  notificationLevel: "all",
  isMuted: false,
  isStarred: false,
  memberIds,
});

describe("conversationName (R17)", () => {
  it("is the name of a channel", () => {
    const channel = bootstrapBody().conversations[1]!;
    expect(conversationName(channel, ME, PEOPLE)).toBe("project-launch");
  });

  it("is the displayName of the other person for a dm", () => {
    expect(conversationName(entry("dm", [ME, id(2)]), ME, PEOPLE)).toBe(
      "Alex Phạm",
    );
    expect(conversationName(entry("dm", [id(2), ME]), ME, PEOPLE)).toBe(
      "Alex Phạm",
    );
  });

  it("is the full names of the other members for a group, in collator order, joined with a comma and a space", () => {
    // names given out of order in memberIds
    expect(
      conversationName(entry("group_dm", [id(3), ME, id(2)]), ME, PEOPLE),
    ).toBe("Alex Phạm, Thu Hoàng");
  });

  it("adds no part for a person who is not in the people, and is empty when nobody is known", () => {
    expect(
      conversationName(entry("group_dm", [ME, id(2), id(99)]), ME, PEOPLE),
    ).toBe("Alex Phạm");
    expect(conversationName(entry("dm", [ME, id(99)]), ME, PEOPLE)).toBe("");
    expect(conversationName(entry("dm", [ME, id(2)]), ME, {})).toBe("");
  });

  it("keeps the name of a deactivated person", () => {
    expect(conversationName(entry("dm", [ME, id(4)]), ME, PEOPLE)).toBe("Dee");
  });
});

describe("compareByName (R18)", () => {
  const sortNames = (names: string[]) =>
    names
      .map((name, i) => ({ name, id: String(i).padStart(2, "0") }))
      .sort(compareByName)
      .map((x) => x.name);

  it("orders channel names the way the collator does, digits first", () => {
    expect(sortNames(["b", "a-1", "a", "10", "9"])).toEqual([
      "10",
      "9",
      "a",
      "a-1",
      "b",
    ]);
  });

  it("keeps accents apart and orders them: Anh, Ánh, Tran, Trần, whatever the input order", () => {
    const expected = ["Anh", "Ánh", "Tran", "Trần"];
    expect(sortNames(["Trần", "Tran", "Ánh", "Anh"])).toEqual(expected);
    expect(sortNames(["Anh", "Trần", "Ánh", "Tran"])).toEqual(expected);
    expect(sortNames(["Tran", "Anh", "Trần", "Ánh"])).toEqual(expected);
  });

  it("breaks a tie by id in code-point order: Anh and anh", () => {
    const a = { name: "Anh", id: "b" };
    const b = { name: "anh", id: "a" };
    expect([a, b].sort(compareByName).map((x) => x.id)).toEqual(["a", "b"]);
    expect([b, a].sort(compareByName).map((x) => x.id)).toEqual(["a", "b"]);
  });
});
