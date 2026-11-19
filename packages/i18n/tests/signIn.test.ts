import { describe, expect, it } from "vitest";
import { translate, type MessageKey } from "../src/translate";

// A copy of the "Texts" table of the TOKI-023 spec: key, English, Vietnamese (R28, R47).
const PLAIN: [string, string, string][] = [
  ["signIn.email.label", "Email", "Email"],
  ["signIn.email.submit", "Send code", "Gửi mã"],
  [
    "signIn.email.invalid",
    "Enter a valid email address",
    "Nhập một địa chỉ email hợp lệ",
  ],
  ["signIn.code.title", "Check your email", "Kiểm tra email của bạn"],
  [
    "signIn.code.validity",
    "The code works for 10 minutes",
    "Mã có hiệu lực trong 10 phút",
  ],
  ["signIn.code.label", "Code", "Mã"],
  ["signIn.code.submit", "Sign in", "Đăng nhập"],
  ["signIn.code.changeEmail", "Use a different email", "Dùng email khác"],
  ["signIn.code.resend", "Resend code", "Gửi lại mã"],
  ["signIn.code.sendNew", "Send a new code", "Gửi mã mới"],
  ["signIn.code.resent", "We sent a new code.", "Chúng tôi đã gửi mã mới."],
  [
    "signIn.error.locked",
    "This code is locked. Ask for a new one.",
    "Mã này đã bị khóa. Hãy yêu cầu mã mới.",
  ],
  ["signIn.error.expired", "This code has expired", "Mã này đã hết hạn"],
  [
    "signIn.error.deactivated",
    "This account has been deactivated. Contact an admin.",
    "Tài khoản này đã bị vô hiệu hóa. Hãy liên hệ quản trị viên.",
  ],
  [
    "signIn.error.network",
    "Could not connect. Check your network and try again.",
    "Không thể kết nối. Hãy kiểm tra mạng rồi thử lại.",
  ],
  [
    "signIn.error.general",
    "Something went wrong. Try again.",
    "Đã xảy ra lỗi. Hãy thử lại.",
  ],
  ["signIn.pageTitle", "Sign in · Toki", "Đăng nhập · Toki"],
  [
    "sessionEnded.title",
    "Your session has ended",
    "Phiên đăng nhập của bạn đã kết thúc",
  ],
  ["sessionEnded.signInAgain", "Sign in again", "Đăng nhập lại"],
  [
    "sessionEnded.deactivated",
    "This account has been deactivated",
    "Tài khoản này đã bị vô hiệu hóa",
  ],
];

// Plural keys: key, count, English, Vietnamese.
const COUNTED: [string, number, string, string][] = [
  [
    "signIn.error.wrongCode",
    1,
    "That code is not right. 1 try left.",
    "Mã không đúng. Còn 1 lần thử.",
  ],
  [
    "signIn.error.wrongCode",
    4,
    "That code is not right. 4 tries left.",
    "Mã không đúng. Còn 4 lần thử.",
  ],
  [
    "signIn.error.tooMany",
    1,
    "You have asked for too many codes. Try again in 1 minute.",
    "Bạn đã yêu cầu quá nhiều mã. Hãy thử lại sau 1 phút.",
  ],
  [
    "signIn.error.tooMany",
    12,
    "You have asked for too many codes. Try again in 12 minutes.",
    "Bạn đã yêu cầu quá nhiều mã. Hãy thử lại sau 12 phút.",
  ],
  [
    "signIn.error.resendTooSoon",
    1,
    "A code was just sent. Try again in 1 second.",
    "Vừa có mã được gửi. Hãy thử lại sau 1 giây.",
  ],
  [
    "signIn.error.resendTooSoon",
    45,
    "A code was just sent. Try again in 45 seconds.",
    "Vừa có mã được gửi. Hãy thử lại sau 45 giây.",
  ],
  [
    "signIn.code.resendWait",
    30,
    "Resend code in 30 s",
    "Gửi lại mã sau 30 giây",
  ],
];

describe("sign-in texts (TOKI-023, R28, R47)", () => {
  it.each(PLAIN)("%s", (key, en, vi) => {
    expect(translate("en", key as MessageKey)).toBe(en);
    expect(translate("vi", key as MessageKey)).toBe(vi);
  });

  it.each(COUNTED)("%s with %i", (key, count, en, vi) => {
    expect(translate("en", key as MessageKey, { count })).toBe(en);
    expect(translate("vi", key as MessageKey, { count })).toBe(vi);
  });
});
