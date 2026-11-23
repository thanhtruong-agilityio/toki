import { describe, expect, it } from "vitest";
import { translate, type MessageKey } from "../src/translate";

// A copy of the "Texts" table of the TOKI-097 spec: key, English, Vietnamese (R39). All eight are
// accepted as written by the product owner (concern 2).
const PLAIN: [string, string, string][] = [
  [
    "join.notFound.title",
    "This link is not valid",
    "Liên kết này không hợp lệ",
  ],
  [
    "join.expired.title",
    "This invitation has expired",
    "Lời mời này đã hết hạn",
  ],
  [
    "join.expired.body",
    "Ask the person who invited you for a new one.",
    "Hãy nhờ người đã mời bạn gửi lời mời mới.",
  ],
  [
    "join.revoked.title",
    "This invitation is no longer valid",
    "Lời mời này không còn hiệu lực",
  ],
  ["join.revoked.body", "Ask an admin.", "Hãy liên hệ quản trị viên."],
  ["join.signedIn.signOut", "Sign out and continue", "Đăng xuất và tiếp tục"],
  ["join.signedIn.stay", "Stay signed in", "Giữ đăng nhập"],
];

describe("join texts (TOKI-097, R35, R36, R39)", () => {
  it.each(PLAIN)("%s", (key, en, vi) => {
    expect(translate("en", key as MessageKey)).toBe(en);
    expect(translate("vi", key as MessageKey)).toBe(vi);
  });

  it("the question carries both addresses as values, not as translated text", () => {
    const values = { current: "ann@example.com", invited: "sam@example.com" };
    expect(
      translate("en", "join.signedIn.question" as MessageKey, values),
    ).toBe(
      "You are signed in as ann@example.com. Sign out to continue as sam@example.com?",
    );
    expect(
      translate("vi", "join.signedIn.question" as MessageKey, values),
    ).toBe(
      "Bạn đang đăng nhập với ann@example.com. Đăng xuất để tiếp tục với sam@example.com?",
    );
  });
});
