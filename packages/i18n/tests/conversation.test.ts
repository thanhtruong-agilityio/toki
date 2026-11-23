import { describe, expect, it } from "vitest";
import { translate, type MessageKey } from "../src/translate";

// A copy of Table B of the TOKI-035 spec: key, English, Vietnamese (R28). The three `level` keys are
// listed one by one. Two keys of `common` come with them.
const TABLE_B: [string, string, string][] = [
  ["conversation.header.back", "Back to conversations", "Quay lại danh sách"],
  [
    "conversation.header.details",
    "Members and details",
    "Thành viên và chi tiết",
  ],
  ["conversation.header.starred", "Starred", "Đã gắn sao"],
  [
    "conversation.panel.label",
    "Conversation details",
    "Chi tiết cuộc trò chuyện",
  ],
  ["conversation.panel.titleDetails", "Details", "Chi tiết"],
  ["conversation.panel.titleProfile", "Profile", "Hồ sơ"],
  ["conversation.panel.about", "About", "Giới thiệu"],
  [
    "conversation.panel.directConversation",
    "Direct conversation",
    "Tin nhắn trực tiếp",
  ],
  ["conversation.panel.createdByOnly", "Created by {name}", "Tạo bởi {name}"],
  ["conversation.panel.createdOn", "Created {date}", "Tạo ngày {date}"],
  ["conversation.panel.noTopic", "No topic yet", "Chưa có chủ đề"],
  ["conversation.panel.noDescription", "No description yet", "Chưa có mô tả"],
  ["conversation.panel.edit", "Edit", "Sửa"],
  ["conversation.panel.save", "Save", "Lưu"],
  ["conversation.panel.topicLabel", "Topic", "Chủ đề"],
  ["conversation.panel.descriptionLabel", "Description", "Mô tả"],
  ["conversation.panel.person", "Person", "Người"],
  ["conversation.panel.membersSearch", "Search members", "Tìm thành viên"],
  [
    "conversation.panel.membersNone",
    "No members match",
    "Không có thành viên nào khớp",
  ],
  [
    "conversation.panel.membersLoading",
    "Loading members…",
    "Đang tải thành viên…",
  ],
  ["conversation.panel.deactivated", "Deactivated", "Đã vô hiệu hóa"],
  ["conversation.panel.readFailed", "Could not load this.", "Không tải được."],
  ["conversation.panel.retry", "Retry", "Thử lại"],
  ["conversation.panel.notifications", "Notifications", "Thông báo"],
  ["conversation.panel.level.all", "All messages", "Tất cả tin nhắn"],
  [
    "conversation.panel.level.mentions",
    "Mentions only",
    "Chỉ khi được nhắc đến",
  ],
  ["conversation.panel.level.none", "Nothing", "Không có gì"],
  ["conversation.panel.settings", "Settings", "Cài đặt"],
  [
    "conversation.panel.mute",
    "Mute conversation",
    "Tắt thông báo cuộc trò chuyện",
  ],
  [
    "conversation.panel.star",
    "Star (move to Starred)",
    "Gắn sao (chuyển lên mục Đã gắn sao)",
  ],
  ["conversation.panel.leave", "Leave channel", "Rời kênh"],
  ["conversation.leave.toast", "You left #{name}", "Bạn đã rời #{name}"],
  ["conversation.leave.title", "Leave this channel?", "Rời kênh này?"],
  [
    "conversation.leave.privateNotice",
    "A member will have to invite you back.",
    "Một thành viên sẽ phải mời bạn quay lại.",
  ],
  [
    "conversation.leave.lastMember",
    "You are the last member. The channel will be archived.",
    "Bạn là thành viên cuối cùng. Kênh sẽ được lưu trữ.",
  ],
  ["conversation.leave.confirm", "Leave", "Rời"],
  ["common.back", "Back", "Quay lại"],
  ["common.closePanel", "Close panel", "Đóng bảng"],
];

// Keys with a value to fill in: key, values, English, Vietnamese.
const FILLED: [string, Record<string, string | number>, string, string][] = [
  [
    "conversation.panel.createdBy",
    { name: "Lan", date: "8 Jan" },
    "Created by Lan · 8 Jan",
    "Tạo bởi Lan · 8 Jan",
  ],
  [
    "conversation.panel.topicTooLong",
    { max: 250 },
    "The topic can have at most 250 characters.",
    "Chủ đề dài tối đa 250 ký tự.",
  ],
  ["conversation.panel.members", { count: 3 }, "Members · 3", "Thành viên · 3"],
];

describe("conversation texts (TOKI-035, R28)", () => {
  it.each(TABLE_B)("%s", (key, en, vi) => {
    expect(translate("en", key as MessageKey)).toBe(en);
    expect(translate("vi", key as MessageKey)).toBe(vi);
  });

  it.each(FILLED)("%s with values", (key, values, en, vi) => {
    expect(translate("en", key as MessageKey, values)).toBe(en);
    expect(translate("vi", key as MessageKey, values)).toBe(vi);
  });

  it("the namespace holds the 39 keys of Table B", () => {
    const own = TABLE_B.filter(([key]) => key.startsWith("conversation."));
    expect(own.length + FILLED.length).toBe(39);
  });
});
