export const account = {
  menu: { label: "Menu tài khoản" },
  signingOut: "Đang đăng xuất…",
  entry: { signOut: "Đăng xuất" },
  devices: {
    title: "Thiết bị đã đăng nhập",
    thisDevice: "Thiết bị này",
    lastUsed: "Dùng lần cuối {time}",
    row: {
      name: "{browser} · {device}",
      described: "{name} (dùng lần cuối {time})",
      position: "{description}, thứ {n} trong {count}",
    },
    kind: {
      desktop: "Máy tính",
      phone: "Điện thoại",
      tablet: "Máy tính bảng",
      unknown: "Thiết bị không rõ",
    },
    browser: {
      chrome: "Chrome",
      edge: "Edge",
      safari: "Safari",
      firefox: "Firefox",
      otherBrowser: "Trình duyệt khác",
      unknown: "Trình duyệt không rõ",
    },
    signOut: "Đăng xuất",
    signOutLabel: "Đăng xuất {device}",
    signOutOthers: "Đăng xuất tất cả thiết bị khác",
    noOthers: "Không có thiết bị nào khác đang đăng nhập.",
    loading: "Đang tải thiết bị",
    loadError: "Không tải được danh sách thiết bị.",
    retry: "Thử lại",
    confirmOne: {
      title: "Đăng xuất thiết bị này?",
      description: "Thiết bị này sẽ cần mã mới để đăng nhập lại.",
    },
    confirmAll: {
      title: "Đăng xuất tất cả thiết bị khác?",
      description: {
        other:
          "{count} thiết bị khác sẽ bị đăng xuất. Thiết bị này vẫn đăng nhập.",
      },
      target: { other: "{count} thiết bị khác" },
    },
  },
};
