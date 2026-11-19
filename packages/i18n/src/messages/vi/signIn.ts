// Các văn bản của trang đăng nhập (TOKI-023). Xưng hô "bạn" (D-188), cần được review cùng bản tiếng Anh.
export const signIn = {
  pageTitle: "Đăng nhập · Toki",
  email: {
    label: "Email",
    submit: "Gửi mã",
    invalid: "Nhập một địa chỉ email hợp lệ",
  },
  code: {
    title: "Kiểm tra email của bạn",
    validity: "Mã có hiệu lực trong 10 phút",
    label: "Mã",
    submit: "Đăng nhập",
    changeEmail: "Dùng email khác",
    resend: "Gửi lại mã",
    resendWait: "Gửi lại mã sau {count} giây",
    resent: "Chúng tôi đã gửi mã mới.",
    sendNew: "Gửi mã mới",
  },
  error: {
    wrongCode: {
      other: "Mã không đúng. Còn {count} lần thử.",
    },
    locked: "Mã này đã bị khóa. Hãy yêu cầu mã mới.",
    expired: "Mã này đã hết hạn",
    tooMany: {
      other: "Bạn đã yêu cầu quá nhiều mã. Hãy thử lại sau {count} phút.",
    },
    resendTooSoon: {
      other: "Vừa có mã được gửi. Hãy thử lại sau {count} giây.",
    },
    deactivated: "Tài khoản này đã bị vô hiệu hóa. Hãy liên hệ quản trị viên.",
    network: "Không thể kết nối. Hãy kiểm tra mạng rồi thử lại.",
    general: "Đã xảy ra lỗi. Hãy thử lại.",
  },
};
