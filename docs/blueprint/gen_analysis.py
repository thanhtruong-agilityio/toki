#!/usr/bin/env python3
"""Writes the "Gap analysis" tab (the `analysis` key) into blueprint.en.json and blueprint.vi.json.

Edit the findings here, then run:   python3 gen_analysis.py
Every string is "English||Tiếng Việt". The 39 earlier gaps are read from each language file and only classified here.
"""
import json, pathlib

HERE = pathlib.Path(__file__).parent
LANGS = ["en", "vi"]

CAT = {"UX": "UI/UX||UI/UX", "UF": "User flow||User flow", "BL": "Business logic||Logic nghiệp vụ", "SB": "System behaviour||Hành vi hệ thống", "EC": "Edge case||Trường hợp biên"}
TYP = {"M": "Missing||Thiếu", "A": "Ambiguous||Mơ hồ", "I": "Inconsistent||Không nhất quán", "S": "Assumption||Giả định"}
SEV = {"C": "Critical||Nghiêm trọng", "H": "High||Cao", "M": "Medium||Trung bình", "L": "Low||Thấp"}
IMP = {"ux": "UX||UX", "fn": "Functionality||Chức năng", "sec": "Security||Bảo mật", "data": "Data integrity||Toàn vẹn dữ liệu", "impl": "Implementation||Triển khai"}
OWN = {"PO": "PO", "UX": "UX", "BE": "Backend", "FE": "Frontend", "QA": "QA", "BA": "BA"}


def pick(s, lang):
    if isinstance(s, str) and "||" in s:
        a, b = s.split("||", 1)
        return a if lang == "en" else b
    return s


def deep(x, lang):
    if isinstance(x, str):
        return pick(x, lang)
    if isinstance(x, list):
        return [deep(i, lang) for i in x]
    if isinstance(x, dict):
        return {k: deep(v, lang) for k, v in x.items()}
    return x


def imp(codes):
    en = ", ".join(IMP[c].split("||")[0] for c in codes.split())
    vi = ", ".join(IMP[c].split("||")[1] for c in codes.split())
    return f"{en}||{vi}"


# ───────────────────────── 1 · Prototype overview ─────────────────────────
SCREENS = [
    ["Home: conversation list and chat||Home: danh sách và khung chat", "Read and write in channels, DMs and groups||Đọc và viết trong kênh, DM và nhóm", "Send, react, edit, delete, pin, save, remind, attach, mention, search in conversation||Gửi, reaction, sửa, xoá, ghim, lưu, nhắc, đính kèm, mention, tìm trong cuộc trò chuyện", "1"],
    ["Thread panel||Panel thread", "Reply under one message||Trả lời dưới một tin", "Reply, also send to channel, summarise||Trả lời, gửi kèm vào kênh, tóm tắt", "1 (summary: 6)||1 (tóm tắt: 6)"],
    ["Details panel||Panel Details", "A conversation's facts and personal settings||Thông tin và cài đặt cá nhân của cuộc trò chuyện", "Notification level, mute, star, leave, see members, tabs||Mức thông báo, tắt tiếng, đánh sao, rời, xem thành viên, tab", "1"],
    ["Profile panel||Panel hồ sơ", "Who a person is||Một người là ai", "Message, start a Meet; read-only otherwise||Nhắn tin, mở Meet; còn lại chỉ đọc", "1"],
    ["Browse channels||Browse channels", "Find and join channels||Tìm và tham gia kênh", "Search, join, open||Tìm, tham gia, mở", "1"],
    ["Activity||Activity", "What needs attention||Những gì cần chú ý", "Filter, open, mark done, snooze, mark all read||Lọc, mở, đánh dấu xong, hoãn, đánh dấu đã đọc hết", "1"],
    ["Later||Later", "Saved messages and reminders||Tin đã lưu và nhắc việc", "Set reminder, complete, remove||Đặt nhắc, hoàn thành, gỡ", "1"],
    ["Files||Files", "Every file and link the person can see||Mọi file và link người dùng xem được", "Search, filter, list or grid, open||Tìm, lọc, dạng danh sách hoặc lưới, mở", "1"],
    ["People||People", "The directory||Danh bạ", "Search, open a profile||Tìm, mở hồ sơ", "1"],
    ["Preferences||Preferences", "Personal settings||Cài đặt cá nhân", "Look, accent, density, notifications, pause, status, language||Giao diện, màu nhấn, mật độ, thông báo, pause, trạng thái, ngôn ngữ", "1"],
    ["Ctrl+K palette||Bảng lệnh Ctrl+K", "Jump anywhere||Nhảy tới bất kỳ đâu", "Search conversations, people, commands||Tìm cuộc trò chuyện, người, lệnh", "1"],
    ["Account menu||Menu tài khoản", "Status and quiet time||Trạng thái và giờ yên tĩnh", "Set status, pause, Focus time, open Preferences||Đặt trạng thái, pause, Focus, mở Preferences", "1"],
    ["Admin||Admin", "Usage analytics and automations||Thống kê sử dụng và automation", "Change period, export CSV, edit automations||Đổi kỳ, xuất CSV, sửa automation", "5 (members: 1, not in the prototype)||5 (thành viên: 1, không có trong prototype)"],
    ["Tasks, Notes, tabs, polls, approvals, send later||Tasks, Notes, tab, poll, approval, gửi sau", "Light work tools inside a channel||Công cụ làm việc nhẹ trong kênh", "Create, move, vote, approve, schedule||Tạo, chuyển, bình chọn, duyệt, hẹn giờ", "2"],
    ["Calendar and Meet||Calendar và Meet", "Schedule and hold calls||Lên lịch và họp", "Schedule, join, mute, share, leave||Lên lịch, tham gia, tắt mic, chia sẻ, rời", "4"],
    ["Guest portal||Cổng guest", "A client sees one shared channel||Khách hàng thấy một kênh được chia sẻ", "Sign in by code, read, write||Đăng nhập bằng mã, đọc, viết", "5"],
    ["Mail||Mail", "Mail inside Toki||Mail trong Toki", "Read, reply, compose, archive, discuss in a channel||Đọc, trả lời, soạn, lưu trữ, bàn trong kênh", "7"],
    ["Phone layout||Bố cục điện thoại", "The same app, one pane at a time||Cùng ứng dụng, mỗi lần một khung", "Bottom navigation, More sheet, Back||Thanh điều hướng dưới, sheet More, Back", "1 (web), 3 (app)"],
]

# ───────────────────────── 2 · New findings ─────────────────────────
# id, finding, evidence, category, type, severity, impact, status
F = [
    ["N-01", "No sign-in for members. The only sign-in screens belong to the guest portal. 'Session ended' and 'Account deactivated' screens do not exist either.||Không có đăng nhập cho thành viên. Các màn hình đăng nhập duy nhất thuộc cổng guest. Màn hình 'Session ended' và 'Account deactivated' cũng không có.",
     "The app opens straight into Home as Lan. Sign-in markup exists only in the guest portal.||Ứng dụng mở thẳng vào Home với tư cách Lan. Chỉ cổng guest có giao diện đăng nhập.", "UF", "M", "C", "fn sec", "Behaviour decided (F04–F07, flows 2.1, 3.2). Screens not designed.||Hành vi đã quyết định (F04–F07, flow 2.1, 3.2). Chưa có thiết kế màn hình."],
    ["N-02", "Admin has no member management: no members table, invite, resend, revoke, change role, deactivate.||Admin không có quản lý thành viên: không có bảng thành viên, mời, gửi lại, thu hồi, đổi vai trò, vô hiệu hoá.",
     "Admin has two tabs: analytics and automations.||Admin có hai tab: thống kê và automation.", "UX", "M", "C", "fn impl", "Behaviour decided (F02, F39–F41, flows 2.12, 2.13). Screens not designed.||Hành vi đã quyết định (F02, F39–F41, flow 2.12, 2.13). Chưa có thiết kế màn hình."],
    ["N-03", "No way to create a channel or add people to one.||Không có cách tạo kênh hay thêm người vào kênh.",
     "No such action among the prototype's 151; '+' leads to Browse channels only.||Không có thao tác này trong 151 thao tác của prototype; '+' chỉ dẫn tới Browse channels.", "UF", "M", "H", "fn impl", "Decided (F20, F22, flow 2.8). Screens not designed; adding people has no chart.||Đã quyết định (F20, F22, flow 2.8). Chưa có thiết kế; thêm người chưa có sơ đồ."],
    ["N-04", "No sign out anywhere.||Không có Sign out ở đâu cả.",
     "The account menu holds status, pause, Focus and Preferences.||Menu tài khoản chỉ có trạng thái, pause, Focus và Preferences.", "UF", "M", "H", "fn sec", "Decided (F06).||Đã quyết định (F06)."],
    ["N-05", "No loading state for anything the product will fetch: lists, messages, search, files.||Không có trạng thái đang tải cho bất cứ thứ gì sản phẩm sẽ phải tải: danh sách, tin nhắn, tìm kiếm, file.",
     "Everything is in memory; the only 'loading' state is the AI summary card.||Mọi thứ nằm sẵn trong bộ nhớ; trạng thái 'loading' duy nhất là thẻ tóm tắt AI.", "UX", "M", "H", "ux impl", "Described in flows 2.3, 2.4 (placeholders). No visual design.||Có mô tả ở flow 2.3, 2.4 (ô giữ chỗ). Chưa có thiết kế hình ảnh."],
    ["N-06", "No error state and no Retry anywhere: failed load, failed send, failed upload, refused action.||Không có trạng thái lỗi và không có Retry ở đâu: tải lỗi, gửi lỗi, tải lên lỗi, hành động bị từ chối.",
     "The words 'error' and 'Retry' do not occur in the prototype.||Chữ 'error' và 'Retry' không xuất hiện trong prototype.", "UX", "M", "H", "ux fn data", "One shared behaviour proposed in flow 3.3; needs confirmation (FA-08).||Đã đề xuất một cách xử lý chung ở flow 3.3; cần xác nhận (FA-08)."],
    ["N-07", "Attaching a file is faked: one press adds a finished sample file. No picker, progress, size refusal, drag and drop, paste, or cancel.||Đính kèm file là giả lập: bấm một lần là có sẵn một file mẫu đã xong. Không có chọn file, tiến độ, từ chối theo dung lượng, kéo thả, dán, hay huỷ.",
     "The attach action takes the next entry from a fixed list of sample files.||Thao tác attach lấy mục kế tiếp từ một danh sách file mẫu cố định.", "UF", "M", "H", "fn impl", "Decided (F18, flow 2.6). Screens not designed.||Đã quyết định (F18, flow 2.6). Chưa có thiết kế màn hình."],
    ["N-08", "Forms report problems by a toast after pressing the button ('Add a title', 'Enter a valid email'), not beside the field, and buttons are never disabled while a form is invalid.||Form báo lỗi bằng toast sau khi bấm nút ('Add a title', 'Enter a valid email'), không báo cạnh ô nhập, và nút không bao giờ bị tắt khi form chưa hợp lệ.",
     "Ten validation toasts; exactly one disabled button in the whole prototype (Join, before a Meet starts).||Mười toast kiểm tra; cả prototype chỉ có đúng một nút bị tắt (Join, trước giờ Meet).", "UX", "I", "M", "ux", "Open: GQ-03. The flows assume a message under the field.||Còn mở: GQ-03. Các flow đang giả định báo lỗi dưới ô nhập."],
    ["N-09", "Leaving a channel asks for confirmation and then also offers Undo, for public and private alike.||Rời kênh vừa hỏi xác nhận rồi lại đưa thêm Undo, với cả kênh công khai lẫn riêng tư.",
     "'Leave #name? You can rejoin from Browse channels.' followed by the toast 'You left #name · Undo'.||'Leave #name? You can rejoin from Browse channels.' rồi tới toast 'You left #name · Undo'.", "UX", "I", "M", "ux", "Decided: rule NR3 (never both); flow 2.9.||Đã quyết định: quy tắc NR3 (không bao giờ cả hai); flow 2.9."],
    ["N-10", "Preferences has 'Notify me for @mentions even in muted channels', but no decision says what Mute does to a mention. Flow 2.7 stated a rule that was not decided; it now points here.||Preferences có 'Notify me for @mentions even in muted channels', nhưng chưa có quyết định nào nói Mute làm gì với mention. Flow 2.7 từng ghi một quy tắc chưa được quyết định; giờ đã trỏ về đây.",
     "A switch in the notification section of Preferences.||Một công tắc trong phần thông báo của Preferences.", "BL", "A", "H", "fn ux", "Open: GQ-01.||Còn mở: GQ-01."],
    ["N-11", "A conversation has both a notification level 'Nothing' and a separate Mute switch. Their difference is not stated.||Một cuộc trò chuyện vừa có mức thông báo 'Nothing' vừa có công tắc Mute riêng. Khác nhau thế nào thì không nói.",
     "Details panel: All messages · Mentions only · Nothing, then Mute and Star.||Panel Details: All messages · Mentions only · Nothing, rồi tới Mute và Star.", "BL", "A", "M", "ux fn", "Open: GQ-02.||Còn mở: GQ-02."],
    ["N-12", "Every screen was seen as an Owner. What a Member or an Admin sees is nowhere in the prototype.||Mọi màn hình đều được xem với vai trò Owner. Member hay Admin thấy gì thì prototype không có.",
     "The signed-in person is always Lan, 'Founder & owner'; the only other view is the guest.||Người đăng nhập luôn là Lan, 'Founder & owner'; góc nhìn khác duy nhất là guest.", "BL", "S", "H", "sec", "The capability matrix (Roles & States) is the authority; needs sign-off: GQ-20.||Bảng quyền (Roles & States) là căn cứ; cần xác nhận: GQ-20."],
    ["N-13", "The address never changes with the screen, so browser Back, reload and shared links have no defined behaviour.||Địa chỉ không đổi theo màn hình, nên Back của trình duyệt, tải lại và link chia sẻ chưa có hành vi nào được định nghĩa.",
     "Navigation is kept in memory; only the guest portal sets an address.||Điều hướng giữ trong bộ nhớ; chỉ cổng guest có đặt địa chỉ.", "UF", "M", "H", "fn ux", "Flow 2.3 assumes addresses exist. Open: GQ-06.||Flow 2.3 giả định có địa chỉ. Còn mở: GQ-06."],
    ["N-14", "The profile is read-only: no way to change name, job title or picture. Pictures are coloured initials.||Hồ sơ chỉ đọc: không có cách đổi tên, chức danh hay ảnh. Ảnh là chữ cái đầu trên nền màu.",
     "Profile panel and Preferences have no such fields.||Panel hồ sơ và Preferences không có các ô này.", "UX", "M", "M", "fn", "Name, title, time zone decided (F35). Picture open: GQ-04.||Tên, chức danh, múi giờ đã quyết định (F35). Ảnh còn mở: GQ-04."],
    ["N-15", "No way to edit a channel's topic or description, rename it, or archive it.||Không có cách sửa chủ đề hay mô tả của kênh, đổi tên, hay lưu trữ kênh.",
     "Details shows topic and description as text.||Details hiện chủ đề và mô tả dưới dạng chữ.", "UF", "M", "M", "fn", "Topic and archive decided (G8, F26). Rename and description open: GQ-05.||Chủ đề và lưu trữ đã quyết định (G8, F26). Đổi tên và mô tả còn mở: GQ-05."],
    ["N-16", "A thread cannot be unfollowed, and a conversation cannot be marked unread.||Không bỏ theo dõi được một thread, và không đánh dấu chưa đọc được một cuộc trò chuyện.",
     "Neither action exists.||Cả hai thao tác đều không có.", "UF", "M", "L", "ux", "Open: GQ-07, GQ-08.||Còn mở: GQ-07, GQ-08."],
    ["N-17", "Admin shows storage used against a quota, but nothing says what happens when the quota is reached.||Admin hiện dung lượng đã dùng so với hạn mức, nhưng không nói điều gì xảy ra khi chạm hạn mức.",
     "Analytics card: files, GB added, GB used of a quota.||Thẻ thống kê: số file, GB thêm, GB đã dùng trên hạn mức.", "BL", "M", "M", "fn data", "Open: GQ-09.||Còn mở: GQ-09."],
    ["N-18", "Nothing shows how a button behaves while its request is running, so a double press is undefined for everything except sending a message.||Không có gì cho thấy nút hành xử thế nào khi request đang chạy, nên bấm hai lần chưa được định nghĩa cho mọi thứ trừ gửi tin nhắn.",
     "Every action completes instantly in the prototype.||Mọi thao tác trong prototype hoàn tất tức thì.", "EC", "M", "M", "data", "Messages: decided (same ID). Others open: GQ-18.||Tin nhắn: đã quyết định (cùng ID). Còn lại mở: GQ-18."],
    ["N-19", "Only one person is simulated. Typing indicators, live updates, read state across two devices and a second tab cannot be observed.||Chỉ mô phỏng một người. Chỉ báo đang gõ, cập nhật trực tiếp, trạng thái đã đọc giữa hai thiết bị và tab thứ hai đều không quan sát được.",
     "Other people's replies are scripted.||Trả lời của người khác được dựng sẵn theo kịch bản.", "SB", "S", "H", "data fn", "Written as decisions and assumptions in the flows; second tab open: FQ-02.||Đã viết thành quyết định và giả định trong các flow; tab thứ hai còn mở: FQ-02."],
    ["N-20", "No behaviour for a new version being deployed while the app is open.||Không có hành vi nào cho việc bản mới được triển khai khi ứng dụng đang mở.",
     "Not applicable to a prototype.||Không áp dụng cho prototype.", "SB", "M", "M", "fn impl", "Open: GQ-10.||Còn mở: GQ-10."],
    ["N-21", "No statement of supported browsers. Web Push and installing the app differ between them.||Không có tuyên bố về trình duyệt được hỗ trợ. Web Push và cài ứng dụng khác nhau giữa các trình duyệt.",
     "Not applicable to a prototype.||Không áp dụng cho prototype.", "SB", "M", "M", "impl", "Open: GQ-11.||Còn mở: GQ-11."],
    ["N-22", "Lists have no upper bound in the design: members in Details, people pickers, Browse channels.||Các danh sách không có giới hạn trên trong thiết kế: thành viên trong Details, bộ chọn người, Browse channels.",
     "Sample data has about ten people; Details lists every member.||Dữ liệu mẫu có khoảng mười người; Details liệt kê mọi thành viên.", "EC", "M", "M", "ux impl", "Target is 200 people (Q-decision). Open: GQ-12.||Mục tiêu là 200 người (đã quyết định). Còn mở: GQ-12."],
    ["N-23", "Two people changing the same thing at once (a topic, a task, a status) has no stated outcome.||Hai người cùng đổi một thứ (chủ đề, task, trạng thái) chưa có kết quả nào được nêu.",
     "Cannot occur with one simulated person.||Không thể xảy ra khi chỉ mô phỏng một người.", "EC", "M", "L", "data", "Open: GQ-13.||Còn mở: GQ-13."],
    ["N-24", "The browser tab gives no sign of unread messages.||Tab trình duyệt không cho thấy dấu hiệu nào của tin chưa đọc.",
     "The title is fixed.||Tiêu đề cố định.", "UX", "M", "L", "ux", "Open: GQ-14.||Còn mở: GQ-14."],
    ["N-25", "Times are always shown as 24-hour, with no setting.||Giờ luôn hiện dạng 24 giờ, không có cài đặt.",
     "'16:34', 'Tomorrow 09:00' throughout.||'16:34', 'Tomorrow 09:00' ở khắp nơi.", "UX", "A", "L", "ux", "Open: GQ-15.||Còn mở: GQ-15."],
    ["N-26", "No record of administrative actions (who invited, changed a role, deactivated, deleted a message).||Không có ghi nhận các hành động quản trị (ai mời, đổi vai trò, vô hiệu hoá, xoá tin).",
     "Admin has no such view.||Admin không có màn hình này.", "BL", "M", "M", "sec", "Open: GQ-16.||Còn mở: GQ-16."],
    ["N-27", "Search has no loading, no error and no stated limits; search inside a conversation shows no 'nothing found' state.||Tìm kiếm không có trạng thái đang tải, không có lỗi và không nêu giới hạn; tìm trong cuộc trò chuyện không có trạng thái 'không tìm thấy'.",
     "Ctrl+K, People and Files have empty states; in-conversation search does not.||Ctrl+K, People và Files có trạng thái trống; tìm trong cuộc trò chuyện thì không.", "UX", "M", "M", "ux", "Partly decided (NR8, GAP-27). Scope open: GQ-19.||Đã quyết định một phần (NR8, GAP-27). Phạm vi còn mở: GQ-19."],
    ["N-28", "The composer shows no character limit or counter.||Ô soạn tin không hiện giới hạn ký tự hay bộ đếm.",
     "No length limit on the message field.||Ô tin nhắn không có giới hạn độ dài.", "EC", "M", "L", "ux", "Decided: 10,000 with a counter near the limit (G9, F11).||Đã quyết định: 10.000 kèm bộ đếm khi gần giới hạn (G9, F11)."],
]

# ───────────────────────── classification of the 39 earlier gaps ─────────────────────────
OLD = dict(zip([f"GAP-{i:02d}" for i in range(1, 40)], """
BL M sec|BL I fn|UX I ux|UF M ux|SB I ux|UF M ux|UX M fn|UF M fn|UX I ux|UX I ux|UX I ux|EC M data|EC M data|BL A fn|UF M fn|EC M data|BL M sec|SB I data|BL I fn|BL I ux|
SB I data|UX M data|UF M fn|UX M data|EC I fn|UX I ux|BL A ux|UX I ux|UX I ux|UF M ux|SB I data|UX I ux|UX M ux|UX I ux|UX I ux|UX M ux|UX M ux|UX I ux|UF I ux""".replace("\n", "").split("|")))
P2S = {"P0": "C", "P1": "H", "P2": "M", "P3": "L"}

# ───────────────────────── 3 · Missing user flows ─────────────────────────
MF = [
    ["Member sign-in and its errors||Đăng nhập của thành viên và các lỗi", "Absent||Không có", "Written F04, F05 · drawn 2.1||Đã viết F04, F05 · đã vẽ 2.1"],
    ["First set-up by the first Owner||Thiết lập lần đầu bởi Owner đầu tiên", "Absent||Không có", "Written F01 · no chart||Đã viết F01 · chưa có sơ đồ"],
    ["Invite a member, accept an invitation||Mời thành viên, nhận lời mời", "Absent (guest invitation only)||Không có (chỉ có mời guest)", "Written F02, F03 · drawn 2.2, 2.12||Đã viết F02, F03 · đã vẽ 2.2, 2.12"],
    ["Sign out; session ends; account deactivated||Sign out; phiên kết thúc; tài khoản bị vô hiệu hoá", "Absent||Không có", "Written F06, F07 · drawn 1.2, 3.2||Đã viết F06, F07 · đã vẽ 1.2, 3.2"],
    ["Create a channel||Tạo kênh", "Absent||Không có", "Written F20 · drawn 2.8||Đã viết F20 · đã vẽ 2.8"],
    ["Add people to a channel||Thêm người vào kênh", "Absent||Không có", "Written F22 · no chart||Đã viết F22 · chưa có sơ đồ"],
    ["Archive a channel||Lưu trữ kênh", "Absent||Không có", "Written F26 · no chart||Đã viết F26 · chưa có sơ đồ"],
    ["Upload with progress, refusal, failure, cancel||Tải lên có tiến độ, bị từ chối, lỗi, huỷ", "Faked||Giả lập", "Written F18 · drawn 2.6||Đã viết F18 · đã vẽ 2.6"],
    ["A send that fails, and Retry||Gửi lỗi, và Retry", "Offline wait only||Chỉ có chờ khi mất mạng", "Written F11 · drawn 2.5, 3.1||Đã viết F11 · đã vẽ 2.5, 3.1"],
    ["Change a role; deactivate; reactivate||Đổi vai trò; vô hiệu hoá; kích hoạt lại", "Absent||Không có", "Written F40, F41 · drawn 2.13||Đã viết F40, F41 · đã vẽ 2.13"],
    ["Any refused or failed request||Mọi request bị từ chối hoặc lỗi", "Absent||Không có", "Drawn 3.3 (proposal)||Đã vẽ 3.3 (đề xuất)"],
    ["Browser Back, reload, opening a shared link||Back của trình duyệt, tải lại, mở link chia sẻ", "Absent||Không có", "Partly drawn 2.3 · open GQ-06||Vẽ một phần ở 2.3 · còn mở GQ-06"],
    ["The same person on two devices or two tabs||Cùng một người trên hai thiết bị hoặc hai tab", "Cannot be observed||Không quan sát được", "Not covered · FQ-02||Chưa có · FQ-02"],
    ["Edit own profile and picture||Sửa hồ sơ và ảnh của mình", "Absent||Không có", "Partly written F35 · open GQ-04||Viết một phần ở F35 · còn mở GQ-04"],
    ["Rename a channel, edit its description||Đổi tên kênh, sửa mô tả", "Absent||Không có", "Not covered · GQ-05||Chưa có · GQ-05"],
    ["Unfollow a thread; mark a conversation unread||Bỏ theo dõi thread; đánh dấu chưa đọc", "Absent||Không có", "Not covered · GQ-07, GQ-08||Chưa có · GQ-07, GQ-08"],
    ["Storage quota reached||Chạm hạn mức lưu trữ", "Absent||Không có", "Not covered · GQ-09||Chưa có · GQ-09"],
    ["A new version arrives while the app is open||Bản mới tới khi ứng dụng đang mở", "Not applicable||Không áp dụng", "Not covered · GQ-10||Chưa có · GQ-10"],
]

# ───────────────────────── 4 · Open questions ─────────────────────────
# id, question, why, options, suggested, owner, severity, from
Q = [
    ["GQ-01", "Does a mention notify the person when the conversation is muted?||Mention có báo cho người đó khi cuộc trò chuyện đã bị tắt tiếng không?", "The prototype has a preference for it; no decision exists; notification tickets cannot be specified without it.||Prototype có một tuỳ chọn cho việc này; chưa có quyết định; không viết được spec cho các ticket thông báo nếu thiếu nó.",
     "(a) A personal switch, on by default · (b) Never · (c) Always||(a) Công tắc cá nhân, mặc định bật · (b) Không bao giờ · (c) Luôn luôn", "(a), as in the prototype||(a), như prototype", "PO", "H", "N-10"],
    ["GQ-02", "What is the difference between the level 'Nothing' and Mute?||Mức 'Nothing' và Mute khác nhau thế nào?", "Two controls that look alike will be built twice or confused.||Hai điều khiển giống nhau sẽ bị làm hai lần hoặc gây nhầm.",
     "(a) Level decides toast, push and sound; Mute also hides the unread badge and bold · (b) Remove 'Nothing', keep Mute · (c) Remove Mute||(a) Mức quyết định toast, push, âm thanh; Mute còn ẩn cả huy hiệu chưa đọc và chữ đậm · (b) Bỏ 'Nothing', giữ Mute · (c) Bỏ Mute", "(a)||(a)", "PO, UX", "M", "N-11"],
    ["GQ-03", "Where do form errors appear: under the field with the button disabled, or in a toast after pressing?||Lỗi của form hiện ở đâu: dưới ô nhập kèm nút bị tắt, hay trong toast sau khi bấm?", "The prototype does one, the flows assume the other; every form depends on it.||Prototype làm một kiểu, các flow giả định kiểu kia; mọi form đều phụ thuộc vào đây.",
     "(a) Under the field; button disabled until valid · (b) Toast after pressing, as the prototype||(a) Dưới ô nhập; nút tắt cho tới khi hợp lệ · (b) Toast sau khi bấm, như prototype", "(a)||(a)", "UX", "M", "N-08"],
    ["GQ-04", "Can a person upload a profile picture in phase 1?||Phase 1 có cho tải ảnh hồ sơ lên không?", "It adds an image upload, cropping and storage path to phase 1.||Nó thêm việc tải ảnh, cắt ảnh và đường lưu trữ vào phase 1.",
     "(a) Initials only in phase 1 · (b) Upload in phase 1||(a) Phase 1 chỉ dùng chữ cái đầu · (b) Cho tải lên ở phase 1", "(a)||(a)", "PO", "L", "N-14"],
    ["GQ-05", "Can a channel be renamed, and who edits its description?||Kênh có đổi tên được không, và ai sửa mô tả?", "Renaming touches links, search and the uniqueness rule.||Đổi tên ảnh hưởng tới link, tìm kiếm và quy tắc không trùng tên.",
     "(a) No rename in phase 1; any member edits topic and description · (b) Admins and the creator rename||(a) Phase 1 không đổi tên; thành viên nào cũng sửa được chủ đề và mô tả · (b) Admin và người tạo được đổi tên", "(a)||(a)", "PO", "M", "N-15"],
    ["GQ-06", "Does every conversation, thread and section have its own address, and what does browser Back do?||Mỗi cuộc trò chuyện, thread và mục có địa chỉ riêng không, và Back của trình duyệt làm gì?", "Notifications, shared links and reload all need it; it shapes the app shell ticket.||Thông báo, link chia sẻ và tải lại đều cần; nó quyết định ticket khung ứng dụng.",
     "(a) Each has an address; Back closes the side panel first, then returns to the previous place · (b) One address for the whole app||(a) Mỗi thứ có địa chỉ; Back đóng panel bên trước, rồi về nơi trước đó · (b) Một địa chỉ cho cả ứng dụng", "(a)||(a)", "FE, UX", "H", "N-13"],
    ["GQ-07", "Can a person stop following a thread?||Có cho ngừng theo dõi một thread không?", "Followers are added automatically; without a way out, busy threads keep notifying.||Người theo dõi được thêm tự động; không có lối ra thì thread đông người sẽ báo mãi.",
     "(a) 'Unfollow thread' in the thread menu · (b) Not in phase 1||(a) 'Unfollow thread' trong menu của thread · (b) Chưa có ở phase 1", "(a)||(a)", "PO", "L", "N-16"],
    ["GQ-08", "Is 'Mark as unread' in phase 1?||'Mark as unread' có ở phase 1 không?", "It changes the read-pointer rule (the pointer would move backwards).||Nó đổi quy tắc con trỏ đã đọc (con trỏ sẽ phải lùi lại).",
     "(a) Later phase · (b) Phase 1||(a) Phase sau · (b) Phase 1", "(a); Later covers the need||(a); Later đã đáp ứng nhu cầu", "PO", "L", "N-16"],
    ["GQ-09", "What happens when storage runs out or reaches a quota?||Điều gì xảy ra khi hết dung lượng hoặc chạm hạn mức?", "Self-hosted on one server: a full disk stops the database too.||Tự host trên một server: đầy đĩa thì database cũng dừng.",
     "(a) No quota; Owners are warned at 80% of the disk; uploads refused at 95% · (b) A fixed quota per workspace||(a) Không hạn mức; Owner được cảnh báo ở 80% đĩa; từ chối tải lên ở 95% · (b) Hạn mức cố định cho workspace", "(a)||(a)", "PO, BE", "M", "N-17"],
    ["GQ-10", "What does an open app do when a new version is deployed?||Ứng dụng đang mở làm gì khi có bản mới được triển khai?", "An old page talking to a new server can fail in confusing ways.||Trang cũ nói chuyện với server mới có thể lỗi rất khó hiểu.",
     "(a) Strip 'Update available · Reload'; forced only when the server says the page is too old · (b) Silent reload when idle||(a) Dải 'Update available · Reload'; chỉ bắt buộc khi server báo trang quá cũ · (b) Tự tải lại khi rảnh", "(a)||(a)", "FE, BE", "M", "N-20"],
    ["GQ-11", "Which browsers are supported?||Hỗ trợ những trình duyệt nào?", "It sets the test matrix and whether Web Push works on iPhone.||Nó quyết định ma trận kiểm thử và Web Push có chạy trên iPhone không.",
     "(a) The last two versions of Chrome, Edge, Safari, Firefox; iPhone push only when installed to the home screen · (b) Chrome and Edge only||(a) Hai bản mới nhất của Chrome, Edge, Safari, Firefox; push trên iPhone chỉ khi đã cài ra màn hình chính · (b) Chỉ Chrome và Edge", "(a)||(a)", "PO, FE", "M", "N-21"],
    ["GQ-12", "How do member lists and people pickers behave at 200 people?||Danh sách thành viên và bộ chọn người hành xử thế nào khi có 200 người?", "The design shows ten; the target is 200.||Thiết kế hiện mười người; mục tiêu là 200.",
     "(a) Search field on top, first 50 shown, more on scroll · (b) Show all||(a) Ô tìm ở trên, hiện 50 người đầu, cuộn để tải thêm · (b) Hiện hết", "(a)||(a)", "UX, FE", "M", "N-22"],
    ["GQ-13", "Two people change the same topic, status or task at the same moment. Who wins?||Hai người cùng đổi một chủ đề, trạng thái hay task cùng lúc. Ai thắng?", "Without a rule, each screen shows a different truth.||Không có quy tắc thì mỗi màn hình hiện một sự thật khác nhau.",
     "(a) The last save wins and everyone sees it live · (b) The second save is refused with 'This changed'||(a) Lần lưu sau cùng thắng và mọi người thấy ngay · (b) Lần lưu thứ hai bị từ chối với 'This changed'", "(a) for short fields; (b) for long text later||(a) cho ô ngắn; (b) cho văn bản dài về sau", "BE", "L", "N-23"],
    ["GQ-14", "Does the browser tab show unread messages?||Tab trình duyệt có hiện tin chưa đọc không?", "Cheap, and often the only signal when notifications are off.||Rẻ, và thường là tín hiệu duy nhất khi tắt thông báo.",
     "(a) '(3) Toki' counting mentions and DMs, a dot for anything else · (b) Nothing||(a) '(3) Toki' đếm mention và DM, một chấm cho thứ khác · (b) Không hiện gì", "(a)||(a)", "UX", "L", "N-24"],
    ["GQ-15", "24-hour time for everyone, or by language?||Giờ 24 cho mọi người, hay theo ngôn ngữ?", "Rule NR7 asks for one format; it does not say which.||Quy tắc NR7 yêu cầu một định dạng; chưa nói là định dạng nào.",
     "(a) 24-hour everywhere · (b) Follows the language · (c) A setting||(a) 24 giờ ở mọi nơi · (b) Theo ngôn ngữ · (c) Có cài đặt", "(a)||(a)", "UX", "L", "N-25"],
    ["GQ-16", "Are administrative actions recorded, and can anyone see the record?||Các hành động quản trị có được ghi lại không, và có ai xem được bản ghi không?", "Deactivation and message deletion by an admin have no trace otherwise.||Nếu không thì việc vô hiệu hoá và admin xoá tin không để lại dấu vết.",
     "(a) Recorded on the server, no screen in phase 1 · (b) A screen for Owners · (c) Not recorded||(a) Ghi ở server, phase 1 chưa có màn hình · (b) Có màn hình cho Owner · (c) Không ghi", "(a)||(a)", "PO, BE", "M", "N-26"],
    ["GQ-17", "Can a workspace export its data (messages, files)?||Workspace có xuất được dữ liệu (tin nhắn, file) không?", "History is kept forever by decision; nothing says how it leaves.||Lịch sử được quyết định giữ mãi; chưa nói nó ra khỏi hệ thống bằng cách nào.",
     "(a) Server backup only in phase 1 · (b) An export for Owners||(a) Phase 1 chỉ có backup ở server · (b) Có xuất dữ liệu cho Owner", "(a)||(a)", "PO", "L", "N-26"],
    ["GQ-18", "How is a double press prevented for creating a channel, sending invitations and setting a reminder?||Chống bấm hai lần thế nào khi tạo kênh, gửi lời mời và đặt nhắc việc?", "Only messages have a duplicate-proof ID today.||Hiện chỉ tin nhắn có ID chống trùng.",
     "(a) Button disabled while the request runs, and the server ignores a repeat of the same request · (b) Button disabled only||(a) Nút tắt khi request đang chạy, và server bỏ qua request lặp lại · (b) Chỉ tắt nút", "(a)||(a)", "BE, FE", "M", "N-18"],
    ["GQ-19", "What does search cover, and how much does it return?||Tìm kiếm phủ những gì, và trả về bao nhiêu?", "Ctrl+K, in-conversation search, Files and People each search differently in the prototype.||Ctrl+K, tìm trong cuộc trò chuyện, Files và People mỗi nơi tìm một kiểu trong prototype.",
     "(a) Ctrl+K: conversations, people, commands, then messages; 20 results per kind, more on request · (b) Messages only in a separate search page||(a) Ctrl+K: cuộc trò chuyện, người, lệnh, rồi tin nhắn; 20 kết quả mỗi loại, xem thêm khi cần · (b) Tin nhắn chỉ ở một trang tìm riêng", "(a)||(a)", "PO, FE", "M", "N-27"],
    ["GQ-20", "Is the capability matrix on the Roles & States tab the agreed authority for what Members and Admins see?||Bảng quyền ở tab Roles & States có phải là căn cứ đã thống nhất cho những gì Member và Admin thấy không?", "No screen was ever seen as a Member or Admin; every permission test will be written from that table.||Chưa màn hình nào được xem với vai trò Member hay Admin; mọi test phân quyền sẽ viết theo bảng đó.",
     "(a) Yes, sign it off as is · (b) Review it row by row first||(a) Đúng, duyệt nguyên trạng · (b) Rà từng dòng trước", "(b)||(b)", "PO, QA", "H", "N-12"],
]

# ───────────────────────── 5 · Assumptions ─────────────────────────
A = [
    ["AS-01", "Everything a Member or Admin sees follows the capability matrix; the prototype shows only an Owner.||Mọi thứ Member hay Admin thấy đều theo bảng quyền; prototype chỉ cho thấy Owner.", "Account card: 'Owner'||Thẻ tài khoản: 'Owner'", "GQ-20"],
    ["AS-02", "Notification preferences belong to the person and apply on every device; only the browser's permission for push is per device.||Tuỳ chọn thông báo thuộc về người dùng và áp dụng trên mọi thiết bị; chỉ quyền push của trình duyệt là theo từng thiết bị.", "Preferences shows one set of switches||Preferences chỉ có một bộ công tắc", "PO"],
    ["AS-03", "Star and Mute are personal: nobody else sees them, and starred conversations sort to the top of that person's list.||Star và Mute là cá nhân: không ai khác thấy, và cuộc trò chuyện được đánh sao lên đầu danh sách của người đó.", "Details panel; starred glyph in the list||Panel Details; biểu tượng sao trong danh sách", "PO"],
    ["AS-04", "The local time shown on a profile comes from the time zone the person set, not from where they are now.||Giờ địa phương trên hồ sơ lấy từ múi giờ người đó đã đặt, không phải từ nơi họ đang ở.", "Profile: local time and a city||Hồ sơ: giờ địa phương và một thành phố", "PO"],
    ["AS-05", "Demo-only controls never ship: the Look / Device / Clock / Guide bar, 'Reset', and every '20 seconds (demo)' choice.||Các điều khiển chỉ để demo không bao giờ lên sản phẩm: thanh Look / Device / Clock / Guide, 'Reset', và mọi lựa chọn '20 seconds (demo)'.", "Marked 'demo' in the prototype||Được đánh dấu 'demo' trong prototype", "Confirmed (Requirements: Dropped)||Đã xác nhận (Requirements: Dropped)"],
    ["AS-06", "The pink 'New' pills mark proposed features, not states of the product.||Các nhãn 'New' màu hồng đánh dấu tính năng đề xuất, không phải trạng thái của sản phẩm.", "Switch 'Highlight proposed features'||Công tắc 'Highlight proposed features'", "PO"],
    ["AS-07", "Sample people, channels and messages are illustration only; no seed content ships except #general.||Người, kênh và tin nhắn mẫu chỉ để minh hoạ; không có nội dung mẫu nào lên sản phẩm ngoài #general.", "Sample workspace 'Hugepig Studio'||Workspace mẫu 'Hugepig Studio'", "PO"],
    ["AS-08", "Analytics never names private channels or DMs and hides any group smaller than three.||Thống kê không bao giờ nêu tên kênh riêng tư hay DM và ẩn mọi nhóm nhỏ hơn ba.", "Admin: 'Private channels and direct messages', 'fewer than 3'||Admin: 'Private channels and direct messages', 'fewer than 3'", "PO (phase 5)"],
]

# ───────────────────────── 6 · Risks ─────────────────────────
R = [
    ["R-01", "Phase 1 needs screens the prototype never drew: sign-in, session ended, Admin members, create channel, add people, upload, loading and error states.||Phase 1 cần những màn hình prototype chưa từng vẽ: đăng nhập, hết phiên, thành viên trong Admin, tạo kênh, thêm người, tải lên, trạng thái đang tải và lỗi.", "Each developer invents them during the build; the result is inconsistent and reworked.||Mỗi người tự nghĩ ra khi làm; kết quả không nhất quán và phải làm lại.", "H", "impl ux", "Design these screens in the prototype before their tickets start (N-01 to N-07).||Thiết kế các màn hình này trong prototype trước khi bắt đầu ticket của chúng (N-01 tới N-07)."],
    ["R-02", "Permissions were only ever seen as an Owner.||Phân quyền mới chỉ được xem với vai trò Owner.", "A Member reaching something they should not, as GAP-01 showed for guests.||Member chạm được thứ không được phép, như GAP-01 đã cho thấy với guest.", "H", "sec", "Sign off the capability matrix (GQ-20); one automated test per row and role.||Duyệt bảng quyền (GQ-20); mỗi dòng và mỗi vai trò một test tự động."],
    ["R-03", "Realtime behaviour between people and devices cannot be observed in the prototype.||Hành vi realtime giữa nhiều người và thiết bị không quan sát được trong prototype.", "Wrong unread counts, duplicated or lost messages.||Sai số chưa đọc, tin nhắn bị trùng hoặc mất.", "H", "data", "Already decided: message IDs made by the app, numbered event log. Add tests with two signed-in clients.||Đã quyết định: ứng dụng tạo ID tin nhắn, event log đánh số. Thêm test với hai client cùng đăng nhập."],
    ["R-04", "Notification rules are ambiguous: level, Mute, mentions in muted conversations.||Quy tắc thông báo còn mơ hồ: mức, Mute, mention trong cuộc trò chuyện đã tắt tiếng.", "People miss mentions or are flooded; hard to change after launch.||Người dùng lỡ mention hoặc bị ngập thông báo; khó đổi sau khi ra mắt.", "H", "fn ux", "Answer GQ-01 and GQ-02 before the notification tickets.||Trả lời GQ-01 và GQ-02 trước các ticket thông báo."],
    ["R-05", "No designed behaviour for failure.||Chưa có thiết kế cho các trường hợp lỗi.", "Actions that seem to succeed but did not; lost input.||Hành động tưởng thành công nhưng không; mất nội dung đã gõ.", "H", "data ux", "Confirm flow 3.3 and FA-08 as the standard; build it once as shared parts.||Xác nhận flow 3.3 và FA-08 làm chuẩn; làm một lần thành thành phần dùng chung."],
    ["R-06", "Addresses and browser Back are undefined.||Địa chỉ và Back của trình duyệt chưa được định nghĩa.", "Notifications and shared links open the wrong place; reload loses position.||Thông báo và link chia sẻ mở sai nơi; tải lại thì mất vị trí.", "M", "fn", "Answer GQ-06 before the app shell ticket.||Trả lời GQ-06 trước ticket khung ứng dụng."],
    ["R-07", "Nothing bounds growth: storage, history kept forever, long lists.||Không có gì giới hạn tăng trưởng: lưu trữ, lịch sử giữ mãi, danh sách dài.", "A full disk stops the whole server; slow screens at 200 people.||Đầy đĩa làm dừng cả server; màn hình chậm khi có 200 người.", "M", "data impl", "Answer GQ-09 and GQ-12; disk alert in the deployment ticket.||Trả lời GQ-09 và GQ-12; cảnh báo đĩa trong ticket triển khai."],
    ["R-08", "Many answers are still owed: the questions on this tab, 12 on the Flows tab (FQ) and 12 unconfirmed assumptions (FA).||Còn nợ nhiều câu trả lời: các câu hỏi ở tab này, 12 câu ở tab Flows (FQ) và 12 giả định chưa xác nhận (FA).", "Specs written on guesses, then rewritten.||Spec viết theo phỏng đoán, rồi phải viết lại.", "M", "impl", "Answer the High ones first; each blocks named tickets.||Trả lời các câu mức Cao trước; mỗi câu chặn những ticket cụ thể."],
]


def sev_counts(items):
    out = {k: 0 for k in "CHML"}
    for s in items:
        out[s] += 1
    return out


def build(lang, B):
    gaps = B["gaps"]
    counts = sev_counts([f[5] for f in F] + [P2S[g["severity"]] for g in gaps])
    total = len(F) + len(gaps)
    open_q = len(Q)
    old_rows = []
    for g in gaps:
        c, t, i = OLD[g["id"]].split()
        old_rows.append([g["id"], g["title"], pick(CAT[c], lang), pick(TYP[t], lang), pick(SEV[P2S[g["severity"]]], lang), pick(imp(i), lang), g["handledIn"]])
    S = lambda s: pick(s, lang)
    sections = [
        {"title": "How this analysis was done||Cách thực hiện phân tích này",
         "intro": f"The prototype was read as a product: every screen and every one of its 151 actions, then checked from five angles (UI/UX, user flow, business logic, system behaviour, edge cases). It found **{total} gaps**: {len(gaps)} recorded earlier by walking through the prototype, and {len(F)} new ones from asking what phase 1 needs that the prototype does not contain. **{open_q} questions** are open.||Prototype được đọc như một sản phẩm: mọi màn hình và toàn bộ 151 thao tác của nó, rồi soát theo năm góc nhìn (UI/UX, user flow, logic nghiệp vụ, hành vi hệ thống, trường hợp biên). Kết quả là **{total} gap**: {len(gaps)} gap đã ghi nhận trước đây khi đi qua prototype, và {len(F)} gap mới từ câu hỏi phase 1 cần gì mà prototype không có. Còn **{open_q} câu hỏi** đang mở.",
         "blocks": [
             {"type": "table", "head": ["Severity||Mức độ", "Gaps||Số gap", "Meaning||Ý nghĩa"], "rows": [
                 [SEV["C"], str(counts["C"]), "Blocks phase 1, or exposes private content||Chặn phase 1, hoặc làm lộ nội dung riêng tư"],
                 [SEV["H"], str(counts["H"]), "A main journey cannot be completed or built as designed||Một hành trình chính không hoàn thành được hoặc không làm được theo thiết kế"],
                 [SEV["M"], str(counts["M"]), "Works, but confusing, inconsistent or unbounded||Chạy được, nhưng gây nhầm, không nhất quán hoặc không có giới hạn"],
                 [SEV["L"], str(counts["L"]), "Polish||Hoàn thiện"]]},
             {"type": "note", "text": "**The main finding:** the prototype simulates one person, always an Owner, with sample data and instant actions. It is a faithful picture of chatting, and it contains nothing about getting in (sign-in, invitations, member management), nothing about waiting or failing (no loading, no error, no retry), and nothing about a second person or device. Those are most of what remains to be designed for phase 1.||**Phát hiện chính:** prototype mô phỏng một người, luôn là Owner, với dữ liệu mẫu và thao tác tức thì. Nó thể hiện trung thực việc chat, và không có gì về việc vào hệ thống (đăng nhập, lời mời, quản lý thành viên), không có gì về chờ đợi hay thất bại (không loading, không lỗi, không retry), và không có gì về người hoặc thiết bị thứ hai. Đó là phần lớn những gì còn phải thiết kế cho phase 1."}]},
        {"title": "1 · Prototype overview||1 · Tổng quan prototype",
         "intro": "The screens found, what each is for, and the phase it belongs to. The journeys through them are the 51 written flows on the Flows tab.||Các màn hình tìm thấy, mục đích của từng màn hình, và phase mà nó thuộc về. Các hành trình đi qua chúng là 51 flow viết ở tab Flows.",
         "blocks": [{"type": "table", "head": ["Screen||Màn hình", "Purpose||Mục đích", "Main actions||Thao tác chính", "Phase||Phase"], "rows": SCREENS}]},
        {"title": "2 · UI and functional gaps||2 · Gap về UI và chức năng",
         "intro": "New findings first, each with what in the prototype shows it and where it stands. Then the 39 earlier gaps, classified the same way.||Các phát hiện mới trước, mỗi cái kèm bằng chứng trong prototype và tình trạng hiện tại. Sau đó là 39 gap trước đây, phân loại theo cùng cách.",
         "blocks": [
             {"type": "h", "text": f"New findings ({len(F)})||Phát hiện mới ({len(F)})"},
             {"type": "table", "head": ["ID||ID", "Finding||Phát hiện", "Evidence in the prototype||Bằng chứng trong prototype", "Category||Nhóm", "Type||Loại", "Severity||Mức độ", "Impact||Ảnh hưởng", "Status||Tình trạng"],
              "rows": [[f[0], f[1], f[2], CAT[f[3]], TYP[f[4]], SEV[f[5]], imp(f[6]), f[7]] for f in F]},
             {"type": "h", "text": f"Earlier gaps, classified ({len(gaps)})||Gap trước đây, đã phân loại ({len(gaps)})"},
             {"type": "p", "text": "Their required behaviour is on the Questions & Gaps tab.||Hành vi yêu cầu của chúng nằm ở tab Questions & Gaps."},
             {"type": "table", "head": ["ID||ID", "Gap||Gap", "Category||Nhóm", "Type||Loại", "Severity||Mức độ", "Impact||Ảnh hưởng", "Handled in||Xử lý ở"], "rows": old_rows}]},
        {"title": "3 · Missing user flows||3 · User flow còn thiếu",
         "intro": "Scenarios the prototype does not cover, and whether the Blueprint has since written or drawn them.||Các kịch bản prototype không phủ, và Blueprint đã viết hoặc vẽ chúng chưa.",
         "blocks": [{"type": "table", "head": ["Scenario||Kịch bản", "In the prototype||Trong prototype", "In the Blueprint||Trong Blueprint"], "rows": MF}]},
        {"title": "4 · Open questions||4 · Câu hỏi mở",
         "intro": "One question per unresolved gap. The suggestion is a recommendation, not a decision; nothing here is assumed anywhere else in the Blueprint. The 12 questions raised while drawing the flows (FQ-01 to FQ-12) are on the Flows tab.||Mỗi gap chưa giải quyết một câu hỏi. Đề xuất là khuyến nghị, không phải quyết định; không có gì ở đây được ngầm dùng ở nơi khác trong Blueprint. 12 câu hỏi nảy ra khi vẽ flow (FQ-01 tới FQ-12) nằm ở tab Flows.",
         "blocks": [{"type": "table", "head": ["ID||ID", "Question||Câu hỏi", "Why it needs an answer||Vì sao cần trả lời", "Options||Phương án", "Suggested||Đề xuất", "Who answers||Ai trả lời", "Severity||Mức độ", "From||Từ"],
                     "rows": [[q[0], q[1], q[2], q[3], q[4], q[5], SEV[q[6]], q[7]] for q in Q]}]},
        {"title": "5 · Assumptions||5 · Giả định",
         "intro": "Behaviour inferred from the interface that nobody has stated. Each needs a yes or a correction. The 12 assumptions made while drawing the flows (FA-01 to FA-12) are on the Flows tab; the 16 already confirmed (G1 to G16) are on the Requirements tab.||Hành vi suy ra từ giao diện mà chưa ai nói ra. Mỗi cái cần một lời đồng ý hoặc chỉnh sửa. 12 giả định đặt ra khi vẽ flow (FA-01 tới FA-12) nằm ở tab Flows; 16 giả định đã xác nhận (G1 tới G16) nằm ở tab Requirements.",
         "blocks": [{"type": "table", "head": ["ID||ID", "Assumed behaviour||Hành vi giả định", "Inferred from||Suy ra từ", "To confirm with||Cần xác nhận với"], "rows": A}]},
        {"title": "6 · Risk and impact||6 · Rủi ro và ảnh hưởng",
         "intro": "What goes wrong if the gaps above stay open, and what reduces it.||Điều gì sẽ hỏng nếu các gap trên vẫn để mở, và cách giảm thiểu.",
         "blocks": [{"type": "table", "head": ["ID||ID", "Risk||Rủi ro", "What it causes||Hậu quả", "Severity||Mức độ", "Impact||Ảnh hưởng", "What reduces it||Cách giảm thiểu"],
                     "rows": [[r[0], r[1], r[2], SEV[r[3]], imp(r[4]), r[5]] for r in R]}]},
    ]
    return {"sections": deep(sections, lang), "open": open_q}


for lang in LANGS:
    p = HERE / f"blueprint.{lang}.json"
    B = json.loads(p.read_text(encoding="utf-8"))
    B["analysis"] = build(lang, B)
    labels = B.setdefault("meta", {}).setdefault("labels", {})
    if lang == "vi":
        labels["Gap analysis"] = "Phân tích gap"
    p.write_text(json.dumps(B, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{p.name}: analysis written · {len(F)} new findings · {len(Q)} questions · {len(A)} assumptions · {len(R)} risks")
