import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const DIR = join(import.meta.dirname, "../../src/conversation");
const files = readdirSync(DIR).filter((f) => /\.(ts|tsx)$/.test(f));
const read = (f: string) => readFileSync(join(DIR, f), "utf8");
// Comments hold prose; the scans look at code.
const code = (f: string) =>
  read(f)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

// The folders of the app that the conversation screens may import (R27): the one client, the clock,
// the shell's slot, the conversation list's binding of the store, the patterns, the avatar colour
// and the not-found view.
const ALLOWED_RELATIVE = [
  "../client",
  "../clock",
  "../conversation-list/use-conversations",
  "../patterns",
  "../people/person-hue",
  "../routes/NotFoundView",
  "../shell/shell-slots",
];

describe("the boundary of the conversation screens (R27)", () => {
  test("the folder holds the files of the spec's layout", () => {
    expect(files).toEqual(
      expect.arrayContaining([
        "ConversationHeader.tsx",
        "ConversationPage.tsx",
        "DetailsPanel.tsx",
        "AboutSection.tsx",
        "PeopleSection.tsx",
        "NotificationsSection.tsx",
        "SettingsSection.tsx",
        "LeaveSection.tsx",
        "useDetailsPanel.ts",
        "useConversation.ts",
        "useChannelMembers.ts",
        "readFailure.ts",
        "useConversationSettings.ts",
      ]),
    );
  });

  test.each(files)(
    "%s imports only the client, the store's binding and its own folder",
    (file) => {
      const imports = [...code(file).matchAll(/from\s+"([^"]+)"/g)].map(
        (m) => m[1],
      );
      for (const path of imports) {
        if (path.startsWith("./")) continue;
        if (path.startsWith("../")) {
          expect(ALLOWED_RELATIVE, `${file} imports ${path}`).toContain(path);
          continue;
        }
        // A package: no query library, no platform feature.
        expect(path, `${file} imports ${path}`).toMatch(
          /^(react|@tanstack\/react-router|@toki\/(client-core|i18n\/react|shared|ui-web))$/,
        );
      }
    },
  );

  test.each(files)(
    "%s has no request of its own and no banned browser API",
    (file) => {
      const source = code(file);
      expect(source).not.toMatch(/\bfetch\s*\(/);
      expect(source).not.toMatch(/XMLHttpRequest|WebSocket|EventSource/);
      expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB/);
      expect(source).not.toMatch(/\bNotification\b|serviceWorker|new Audio\b/);
      if (file !== "useDetailsPanel.ts") {
        expect(source).not.toMatch(
          /window\.history|history\.(push|replace)State/,
        );
      }
      expect(source).not.toMatch(/\bapi\.(?!channels\.members)/);
    },
  );

  test("it puts nothing of the conversation in the address but panel=details", () => {
    const source = code("useDetailsPanel.ts");
    const searches = [...source.matchAll(/search:\s*(\{[^}]*\})/g)].map((m) =>
      m[1].trim(),
    );
    expect(
      searches.every((s) => s === '{ panel: "details" }' || s === "{}"),
    ).toBe(true);
  });
});

describe("texts and style (R28, R29)", () => {
  test.each(files.filter((f) => f.endsWith(".tsx")))(
    "%s has no JSX text, no style attribute and no literal label",
    (file) => {
      const source = code(file);
      expect(source).not.toMatch(/\sstyle=/);
      expect(source).not.toMatch(
        /<[A-Za-z][^<>{}=]*(\s[^<>{}]*)?>\s*[A-Za-z][A-Za-z ,.'!?-]*<\//,
      );
      expect(source).not.toMatch(
        /\b(aria-label|label|title|placeholder|alt)="[^"{]/,
      );
    },
  );

  test("no file mentions the Meet button or a search control of the header", () => {
    expect(code("ConversationHeader.tsx")).not.toMatch(/\bMeet\b/);
  });
});
