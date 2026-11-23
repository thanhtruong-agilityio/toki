import { describe, expect, it } from "vitest";
import { translate, type MessageKey } from "../src/translate";

// A copy of Table B of the TOKI-033 spec: key, English, Vietnamese (R27).
const PLAIN: [string, string, string][] = [
  ["conversationList.group.starred", "Starred", "Đã gắn sao"],
  ["conversationList.group.channels", "Channels", "Kênh"],
  ["conversationList.group.direct", "Direct messages", "Tin nhắn riêng"],
  ["conversationList.search.label", "Search conversations", "Tìm hội thoại"],
  [
    "conversationList.search.placeholder",
    "Search conversations",
    "Tìm hội thoại",
  ],
  ["conversationList.filter.label", "Filter conversations", "Lọc hội thoại"],
  ["conversationList.filter.all", "All", "Tất cả"],
  ["conversationList.filter.unread", "Unread", "Chưa đọc"],
  ["conversationList.filter.mentions", "Mentions", "Lượt nhắc"],
  ["conversationList.browse", "Browse channels", "Duyệt kênh"],
  ["conversationList.direct.add", "New message", "Tin nhắn mới"],
  [
    "conversationList.empty.title",
    "No conversations match",
    "Không có hội thoại phù hợp",
  ],
  [
    "conversationList.empty.description",
    "Try another filter.",
    "Thử bộ lọc khác.",
  ],
  ["conversationList.empty.clear", "Clear filter", "Xóa bộ lọc"],
  ["conversationList.row.mention", "Mention", "Được nhắc"],
  ["conversationList.row.muted", "Muted", "Đã tắt thông báo"],
  ["conversationList.row.starred", "Starred", "Đã gắn sao"],
  ["conversationList.row.private", "Private channel", "Kênh riêng tư"],
  ["conversationList.row.deactivated", "Deactivated", "Đã vô hiệu hóa"],
];

// Keys that take a count: key, count, English, Vietnamese.
const COUNTED: [string, number, string, string][] = [
  ["conversationList.group.unread", 5, "5 unread", "5 chưa đọc"],
  ["conversationList.row.unread", 1, "1 unread", "1 chưa đọc"],
  ["conversationList.row.unread", 12, "12 unread", "12 chưa đọc"],
  ["conversationList.workspace.people", 1, "1 person", "1 người"],
  ["conversationList.workspace.people", 8, "8 people", "8 người"],
];

describe("conversation list texts (TOKI-033, R27)", () => {
  it.each(PLAIN)("%s", (key, en, vi) => {
    expect(translate("en", key as MessageKey)).toBe(en);
    expect(translate("vi", key as MessageKey)).toBe(vi);
  });

  it.each(COUNTED)("%s with %i", (key, count, en, vi) => {
    expect(translate("en", key as MessageKey, { count })).toBe(en);
    expect(translate("vi", key as MessageKey, { count })).toBe(vi);
  });
});
