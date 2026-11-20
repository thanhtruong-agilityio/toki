export const createChannel = {
  open: "Tạo kênh",
  title: "Tạo kênh",
  name: {
    label: "Tên",
    error: {
      invalid: "Chỉ dùng chữ thường, chữ số và dấu gạch ngang.",
      taken: "Đã có kênh với tên này.",
    },
  },
  error: {
    tooLong: "Tối đa {count} ký tự.",
    invalidMember:
      "Có người đã chọn không thể thêm được nữa. Hãy kiểm tra danh sách rồi thử lại.",
  },
  private: {
    label: "Riêng tư",
    hint: "Chỉ thành viên mới tìm thấy kênh. Không thể đổi sau khi tạo.",
  },
  topic: { label: "Chủ đề (không bắt buộc)" },
  people: {
    label: "Thêm người (không bắt buộc)",
    limit: "Chỉ thêm được tối đa {count} người.",
  },
  submit: "Tạo",
};
