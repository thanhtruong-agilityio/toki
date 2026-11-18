// The texts of the mails the server sends (TOKI-021). Invitations are sent in English (D-180).
export const mail = {
  signIn: {
    subject: "Mã đăng nhập Toki của bạn",
    intro: "Dùng mã này để đăng nhập vào Toki:",
    validity: "Mã có hiệu lực trong {minutes} phút và chỉ dùng được một lần.",
    ignore: "Nếu bạn không yêu cầu mã này, hãy bỏ qua email này.",
  },
  invitation: {
    subject: "{inviter} đã mời bạn vào {workspace} trên Toki",
    intro: "{inviter} đã mời bạn tham gia {workspace} trên Toki.",
    join: "Tham gia",
    codeIntro: "Nhấn Tham gia, rồi nhập mã này:",
    validity:
      "Mã có hiệu lực trong {minutes} phút. Nếu mã đã hết hạn, hãy nhấn Gửi lại mã ở trang tiếp theo.",
    lifetime: "Lời mời có hiệu lực trong {days} ngày.",
    ignore: "Nếu bạn không mong đợi lời mời này, hãy bỏ qua email này.",
  },
  invitationCode: {
    subject: "Mã Toki mới của bạn",
    intro: "Đây là mã mới để tham gia Toki. Hãy nhập mã vào trang bạn đang mở:",
    validity:
      "Mã có hiệu lực trong {minutes} phút. Các mã trước không còn dùng được.",
  },
};
