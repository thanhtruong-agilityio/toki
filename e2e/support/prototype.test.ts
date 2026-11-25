import { describe, expect, it } from "vitest";
import { checkHash, prepareHtml, sha256 } from "./prototype";

describe("checkHash (R17)", () => {
  const file = Buffer.from("abc");

  it("accepts the recorded hash", () => {
    expect(checkHash(file, sha256(file))).toBeNull();
  });

  it("accepts the recorded hash with a trailing newline", () => {
    expect(checkHash(file, `${sha256(file)}\n`)).toBeNull();
  });

  it("names the change when the file differs", () => {
    expect(checkHash(Buffer.from("abd"), sha256(file))).toBe(
      "the prototype changed: make the references again and record the new hash",
    );
  });
});

describe("prepareHtml (R1)", () => {
  const html =
    '<!doctype html><link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=X" rel="stylesheet"><p>x</p>';
  const css =
    '@font-face{font-family:"A";src:url("./a.woff2") format("woff2")}';
  const out = prepareHtml(html, css, (name) => Buffer.from(`bytes of ${name}`));

  it("removes every link to a font host", () => {
    expect(out).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
  });

  it("inlines the font files as data URIs", () => {
    const b64 = Buffer.from("bytes of a.woff2").toString("base64");
    expect(out).toContain(`data:font/woff2;base64,${b64}`);
    expect(out).not.toContain("./a.woff2");
  });

  it("keeps the rest of the page", () => {
    expect(out).toContain("<p>x</p>");
  });
});
