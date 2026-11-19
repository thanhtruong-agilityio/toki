import { describe, expect, it } from "vitest";
import { parseAddressList } from "../../src/index.js";

describe("parseAddressList (R35)", () => {
  it("splits at commas and at CR, LF and CRLF", () => {
    expect(
      parseAddressList(
        "a@example.com,b@example.com\nc@example.com\r\nd@example.com\re@example.com",
      ),
    ).toEqual([
      "a@example.com",
      "b@example.com",
      "c@example.com",
      "d@example.com",
      "e@example.com",
    ]);
  });

  it("trims every piece and drops empty pieces and blank lines", () => {
    expect(
      parseAddressList("  a@example.com ,, \n\n  b@example.com\n , "),
    ).toEqual(["a@example.com", "b@example.com"]);
  });

  it("puts every piece in lower case and drops a repeat", () => {
    expect(
      parseAddressList("Sam@Example.com, sam@example.com\nSAM@EXAMPLE.COM"),
    ).toEqual(["sam@example.com"]);
  });

  it("keeps a piece with a space, a semicolon or an angle bracket as typed", () => {
    expect(
      parseAddressList(
        "sam smith@example.com, a@example.com;b@example.com\nSam <sam@example.com>",
      ),
    ).toEqual([
      "sam smith@example.com",
      "a@example.com;b@example.com",
      "sam <sam@example.com>",
    ]);
  });

  it("gives an empty list for an empty or blank text", () => {
    expect(parseAddressList("")).toEqual([]);
    expect(parseAddressList(" \n , \r\n")).toEqual([]);
  });
});
