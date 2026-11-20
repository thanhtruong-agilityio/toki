import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";
import { FOLDER } from "./support";

const SRC = join(FOLDER, "../..");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)
      ? [path]
      : [];
  });
}

const outside = files(SRC).filter((file) => !file.startsWith(FOLDER + "/"));

// R18: the dialog has one door, the button and the hook of its own folder.
describe("no other way to open the dialog (R18)", () => {
  test("no file outside the folder names CreateChannelDialog", () => {
    expect(
      outside
        .filter((f) => /CreateChannelDialog/.test(readFileSync(f, "utf8")))
        .map((f) => relative(SRC, f)),
    ).toEqual([]);
  });

  test("no file of features/channels (Browse) calls createChannel", () => {
    expect(
      outside
        .filter((f) => relative(SRC, f).startsWith("features/channels/"))
        .filter((f) => /createChannel\(/.test(readFileSync(f, "utf8"))),
    ).toEqual([]);
  });

  test("the scan sees a file that names it (negative control)", () => {
    expect(/CreateChannelDialog/.test("import { CreateChannelDialog }")).toBe(
      true,
    );
  });

  test("inside the folder only the hook imports the dialog", () => {
    const own = files(FOLDER)
      .filter((f) =>
        /from\s+["']\.\/CreateChannelDialog["']/.test(readFileSync(f, "utf8")),
      )
      .map((f) => relative(FOLDER, f));
    expect(own).toEqual(["useCreateChannelDialog.tsx"]);
  });
});
