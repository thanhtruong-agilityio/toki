import { describe, expect, it } from "vitest";
import { foldSearchText, matches } from "./search";

describe("foldSearchText (R19)", () => {
  it("lower-cases, removes diacritics and turns đ and Đ into d", () => {
    expect(foldSearchText("Nguyễn Đức")).toBe("nguyen duc");
    expect(foldSearchText("Đào Thị Mai")).toBe("dao thi mai");
    expect(foldSearchText("Ánh")).toBe("anh");
    expect(foldSearchText("PRO")).toBe("pro");
  });

  it("gives the same text for a decomposed and a composed form", () => {
    expect(foldSearchText("Trần")).toBe(foldSearchText("Trần"));
    expect(foldSearchText("Trần")).toBe("tran");
  });

  it("never throws", () => {
    expect(foldSearchText("")).toBe("");
    expect(foldSearchText("\ud800")).toBeTypeOf("string");
    expect(foldSearchText(undefined as unknown as string)).toBe("");
  });
});

describe("matches (R19)", () => {
  const names = ["project-launch", "Anh", "Ánh", "Tran", "Trần", "Đào Thị Mai"];
  const find = (query: string) => names.filter((name) => matches(name, query));

  it("finds by a part of the name, ignoring case", () => {
    expect(find("Pro")).toEqual(["project-launch"]);
    expect(find("PRO")).toEqual(["project-launch"]);
  });

  it("trims the query, so a trailing space does not hide a name", () => {
    expect(find("  launch ")).toEqual(["project-launch"]);
  });

  it("ignores diacritics on both sides", () => {
    expect(find("an")).toEqual(["Anh", "Ánh"]);
    expect(find("tran")).toEqual(["Tran", "Trần"]);
    expect(find("Ánh")).toEqual(["Anh", "Ánh"]);
    expect(find("dao")).toEqual(["Đào Thị Mai"]);
    expect(find("Trần")).toEqual(["Tran", "Trần"]);
  });

  it("keeps everything for an empty or blank query, and nothing for a query that matches nothing", () => {
    expect(find("")).toEqual(names);
    expect(find("   ")).toEqual(names);
    expect(find("zzz")).toEqual([]);
  });
});
