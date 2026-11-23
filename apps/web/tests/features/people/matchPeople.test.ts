import { describe, expect, test } from "vitest";
import { matchPeople } from "../../../src/features/people/matchPeople";

const people = [
  { id: "1", displayName: "Nguyễn Văn An" },
  { id: "2", displayName: "Đào Thị Mai" },
  { id: "3", displayName: "Mai Lan" },
  { id: "4", displayName: "Trần Bình" },
];
const names = (text: string) => matchPeople(people, text).map((p) => p.id);

describe("matchPeople (TOKI-034 R19)", () => {
  test("ignores diacritics and case", () => {
    expect(names("nguyen")).toEqual(["1"]);
    expect(names("NGUYEN")).toEqual(["1"]);
    expect(names("nguyễn")).toEqual(["1"]);
  });

  test("handles Đ and đ as d", () => {
    expect(names("dao")).toEqual(["2"]);
    expect(names("Đ")).toEqual(["2"]);
    expect(names("đào")).toEqual(["2"]);
  });

  test("finds a name once and finds nobody whose name lacks the text", () => {
    expect(names("mai")).toEqual(["2", "3"]);
    expect(names("zzz")).toEqual([]);
  });

  test("an empty or blank text keeps everyone, in the order given", () => {
    expect(names("")).toEqual(["1", "2", "3", "4"]);
    expect(names("   ")).toEqual(["1", "2", "3", "4"]);
  });

  test("trims the text", () => {
    expect(names("  văn an ")).toEqual(["1"]);
  });

  test("reads a name written with combining marks (NFD)", () => {
    const nfd = [{ id: "9", displayName: "Nguyễn".normalize("NFD") }];
    expect(matchPeople(nfd, "nguyen")).toHaveLength(1);
    expect(matchPeople(people, "Nguyễn".normalize("NFD"))).toHaveLength(1);
  });

  test("never throws, whatever the text", () => {
    expect(() => matchPeople(people, "\u0000(*[")).not.toThrow();
    expect(matchPeople([], "a")).toEqual([]);
  });
});
