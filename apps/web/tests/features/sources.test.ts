import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { FEATURES, ownSources, words } from "./support";

const SRC = join(FEATURES, "..");
const own = () => ownSources().filter((f) => !/\.css$/.test(f.name));

describe("the own files (TOKI-034 R1)", () => {
  test("the files of R1 exist", () => {
    for (const name of [
      "deps.ts",
      "ConversationStarters.tsx",
      "useMoreOnScroll.ts",
      "rows.css",
      "channels/BrowseChannelsDialog.tsx",
      "channels/BrowseRow.tsx",
      "channels/UnjoinedChannel.tsx",
      "channels/browseRows.ts",
      "channels/useBrowsePages.ts",
      "channels/joinChannel.ts",
      "channels/useJoinChannel.ts",
      "people/PeoplePicker.tsx",
      "people/NewMessageDialog.tsx",
      "people/matchPeople.ts",
      "people/startDirect.ts",
    ]) {
      expect(existsSync(join(FEATURES, name)), name).toBe(true);
    }
  });

  test("the names of R4, R7, R16, R18, R21 and R30 are exported from them", () => {
    const exports: Array<[string, string]> = [
      ["channels/BrowseChannelsDialog.tsx", "BrowseChannelsDialog"],
      ["channels/browseRows.ts", "browseRowAction"],
      ["channels/UnjoinedChannel.tsx", "UnjoinedChannel"],
      ["people/PeoplePicker.tsx", "PeoplePicker"],
      ["people/PeoplePicker.tsx", "PeoplePickerProps"],
      ["people/NewMessageDialog.tsx", "NewMessageDialog"],
      ["ConversationStarters.tsx", "ConversationStarters"],
    ];
    for (const [file, name] of exports) {
      const text = readFileSync(join(FEATURES, file), "utf8");
      expect(text, `${file} ${name}`).toMatch(
        new RegExp(`export (?:function|const|type) ${name}\\b`),
      );
    }
  });

  test("the body of UnjoinedView renders UnjoinedChannel (R16)", () => {
    const text = readFileSync(
      join(SRC, "conversation/UnjoinedView.tsx"),
      "utf8",
    );
    expect(text).toContain("<UnjoinedChannel {...props} />");
  });
});

describe("the scans (R3, R12, R14, R28)", () => {
  test("no own file holds a visible English word in a JSX text or a string prop (R3)", () => {
    for (const file of own().filter((f) => f.name.endsWith(".tsx"))) {
      expect(words(file.text), file.name).toEqual([]);
    }
  });

  test("no own file builds a conversation entry (R12)", () => {
    for (const file of own()) {
      expect(file.text, file.name).not.toMatch(
        /\bnotificationLevel\s*:|\bmemberIds\s*:/,
      );
    }
  });

  test("no own file of channels creates a channel (R14)", () => {
    for (const file of own().filter((f) => f.name.startsWith("channels/"))) {
      expect(file.text, file.name).not.toMatch(/createChannel/);
      expect(file.text, file.name).not.toMatch(/POST[^\n]*\/channels["'`]/);
    }
  });

  test("no own file imports a shared package by a relative path or a browser API the shared packages ban (R28)", () => {
    for (const file of own()) {
      expect(file.text, file.name).not.toMatch(
        /from\s+["'](?:\.\.\/)+packages\//,
      );
      expect(file.text, file.name).not.toMatch(
        /\b(?:localStorage|sessionStorage|indexedDB|Notification|serviceWorker|AudioContext)\b/,
      );
    }
  });

  test("rows.css is imported by the two files that need it (R26)", () => {
    for (const file of [
      "channels/BrowseChannelsDialog.tsx",
      "people/PeoplePicker.tsx",
    ]) {
      expect(readFileSync(join(FEATURES, file), "utf8")).toMatch(
        /import\s+["']\.\.\/rows\.css["']/,
      );
    }
  });
});

describe("the word scan itself (negative control)", () => {
  test("sees a JSX text and a string prop and ignores t(...)", () => {
    expect(words("<p>Create</p>")).toEqual(["Create"]);
    expect(words('<IconButton label="Close" />')).toEqual(["label=Close"]);
    expect(words("<p>{t('a')}</p>")).toEqual([]);
  });
});
