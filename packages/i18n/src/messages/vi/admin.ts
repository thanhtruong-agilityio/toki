export const admin = {
  noAccess: {
    title: "Bạn không có quyền truy cập trang này",
  },
  invite: {
    open: "Mời thành viên",
    title: "Mời thành viên",
    emails: {
      label: "Địa chỉ email",
      hint: "Phân tách các địa chỉ bằng dấu phẩy hoặc xuống dòng.",
    },
    role: {
      label: "Vai trò",
    },
    send: "Gửi lời mời",
    error: {
      invalid: '"{address}" không phải địa chỉ email hợp lệ.',
      tooMany: "Mỗi lần chỉ gửi tối đa {count} địa chỉ.",
    },
    results: {
      label: "Kết quả",
    },
    result: {
      alreadyMember: "Đã là thành viên",
      alreadyInvited: "Đã được mời",
      invalid: "Địa chỉ không hợp lệ",
    },
    done: "Xong",
  },
  members: {
    title: "Thành viên",
    search: {
      label: "Tìm thành viên",
      placeholder: "Tìm theo tên hoặc địa chỉ email",
    },
    filter: {
      label: "Lọc theo trạng thái",
    },
    empty: {
      title: "Không có ai phù hợp",
      hint: "Hãy thử một tên hoặc một địa chỉ.",
    },
    loading: "Đang tải danh sách thành viên",
    error: "Không tải được danh sách thành viên.",
  },
  filter: {
    all: "Tất cả",
  },
  status: {
    active: "Đang hoạt động",
    invited: "Đã mời",
    expired: "Hết hạn",
    deactivated: "Đã vô hiệu hóa",
  },
  col: {
    name: "Tên",
    role: "Vai trò",
    status: "Trạng thái",
    lastActive: "Hoạt động gần nhất",
    actions: "Thao tác",
  },
  row: {
    you: "Bạn",
    mailNotSent: "Chưa gửi được thư",
    invitedBy: "{name} đã mời · {date}",
  },
  action: {
    menu: "Thao tác cho {name}",
    resend: "Gửi lại",
    revoke: "Thu hồi",
    changeRole: "Đổi vai trò",
    deactivate: "Vô hiệu hóa",
    reactivate: "Kích hoạt lại",
  },
  lock: {
    lastAdmin: "Hãy chọn người khác làm Admin trước",
    self: "Bạn không thể tự vô hiệu hóa mình",
    current: "Vai trò hiện tại",
  },
  changeRole: {
    title: "Đổi vai trò?",
    toAdmin:
      "Vai trò mới: Admin. Họ có thể mở trang Quản trị, mời người, đổi vai trò và vô hiệu hóa người khác.",
    toMember:
      "Vai trò mới: Thành viên. Họ không còn mở được trang Quản trị hay quản lý người khác.",
    confirm: "Đổi vai trò",
  },
  deactivate: {
    title: "Vô hiệu hóa người này?",
    description:
      "{name} sẽ bị đăng xuất khỏi mọi nơi và không thể đăng nhập lại. Tin nhắn của họ vẫn được giữ.",
    confirm: "Vô hiệu hóa",
  },
  reactivate: {
    title: "Kích hoạt lại người này?",
    description:
      "{name} có thể đăng nhập lại bằng mã gửi tới địa chỉ của họ, với cùng lịch sử và kênh.",
    confirm: "Kích hoạt lại",
  },
  revoke: {
    title: "Thu hồi lời mời này?",
    description:
      "Lời mời gửi tới {email} sẽ không còn hiệu lực. Nút Join trong thư sẽ không cho ai vào nữa.",
    confirm: "Thu hồi",
  },
  channels: {
    members: {
      other: "{count} thành viên",
    },
    archived: "Đã lưu trữ",
    loading: "Đang tải danh sách kênh",
    error: "Không tải được danh sách kênh.",
  },
  error: {
    retry: "Thử lại",
    id: "Mã lỗi: {id}",
    stale: "Trang đã cũ. Dữ liệu đã được làm mới.",
    inProgress: "Đang gửi. Hãy thử lại sau giây lát.",
    unreadable: "Trang đã cũ. Hãy tải lại để tiếp tục.",
  },
  toast: {
    roleChanged: "Đã đổi vai trò",
    deactivated: "Đã vô hiệu hóa",
    reactivated: "Đã kích hoạt lại",
    revoked: "Đã thu hồi lời mời",
    resent: "Đã gửi lời mời tới {email}",
    resentNoMail: "Chưa gửi được thư tới {email}",
  },
};
