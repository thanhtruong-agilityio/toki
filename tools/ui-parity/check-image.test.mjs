import test from "node:test";
import assert from "node:assert/strict";
import {
  imageMismatch,
  installedRevisions,
  requiredRevision,
} from "./check-image.mjs";

const browsers = {
  browsers: [
    { name: "chromium", revision: "1255" },
    { name: "firefox", revision: "1572" },
  ],
};

test("reads the Chromium revision that Playwright needs", () => {
  assert.equal(requiredRevision(browsers), "1255");
});

test("fails when browsers.json has no Chromium", () => {
  assert.throws(() => requiredRevision({ browsers: [] }), /chromium/);
});

test("reads the Chromium revisions that the image holds", () => {
  assert.deepEqual(
    installedRevisions([
      "chromium-1255",
      "chromium_headless_shell-1255",
      "firefox-1572",
      "ffmpeg-1013",
    ]),
    ["1255"],
  );
});

test("no mismatch when the image holds the revision", () => {
  assert.equal(
    imageMismatch({
      playwrightVersion: "1.65.1",
      required: "1255",
      installed: ["1255"],
    }),
    null,
  );
});

test("a mismatch names the revision the image has, the one Playwright needs and its version", () => {
  const message = imageMismatch({
    playwrightVersion: "1.65.1",
    required: "1255",
    installed: ["1254"],
  });
  assert.match(message, /1254/);
  assert.match(message, /1255/);
  assert.match(message, /1\.65\.1/);
});

test("an image with no Chromium is a mismatch too", () => {
  assert.match(
    imageMismatch({
      playwrightVersion: "1.65.1",
      required: "1255",
      installed: [],
    }),
    /none/,
  );
});
