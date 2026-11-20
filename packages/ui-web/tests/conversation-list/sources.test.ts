import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const dir = `${import.meta.dirname}/../../src/conversation-list`;
const sources = readdirSync(dir).filter(
  (f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f),
);

describe("conversation list sources (R2)", () => {
  test("there are sources to read", () => {
    expect(sources).toEqual(
      expect.arrayContaining(["ConversationList.tsx", "index.ts"]),
    );
  });
  test.each(sources)(
    "%s imports no i18n, platform, shared or client-core",
    (file) => {
      const text = readFileSync(resolve(dir, file), "utf8");
      expect(text).not.toMatch(/@toki\/(i18n|platform|shared|client-core)/);
    },
  );
});
