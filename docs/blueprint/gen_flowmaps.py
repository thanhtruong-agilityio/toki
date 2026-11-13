#!/usr/bin/env python3
"""Writes flowmaps.json, the spec of every chart and table on the Flows tab.

Edit the charts here, then run:   python3 gen_flowmaps.py
Every string is "English||Tiếng Việt". Rows and lanes are explicit so a chart can be adjusted by hand.
"""
import json, pathlib

U, F, B = 0, 1, 2
LANES = ["User||Người dùng", "Frontend (web app)||Frontend (ứng dụng web)", "Backend (API, jobs, storage)||Backend (API, job, lưu trữ)"]
Y, N = "yes||có", "no||không"
KIND = {"st": "start", "en": "end", "d": "decision", "s": "state", "x": "error", "p": "step"}
warnings = []


class Chart:
    def __init__(self, title, caption, notes, lanes=True, **kw):
        self.m = dict(title=title, caption=caption, notes=notes, nodes=[], edges=[], **kw)
        self.lanes = lanes
        if lanes:
            self.m["lanes"] = LANES
            self.m.setdefault("rowHeight", 100)

    def n(self, id, a, row, label, sub=None, k="p", **kw):
        kind = KIND[k]
        node = dict(id=id, row=row, label=label, kind=kind, **kw)
        node["lane" if self.lanes else "col"] = a
        if sub:
            node["sub"] = sub
        if kind == "decision":
            node.setdefault("w", 270 if self.lanes else 196)
            node.setdefault("h", 80 if self.lanes else 70)
        elif not self.lanes:
            node.setdefault("w", 196)
        lim = (27, 28) if kind == "decision" else ((39, 50) if self.lanes else (29, 37))
        for text, cap in ((label, lim[0]), (sub or "", lim[1])):
            for half in text.split("||"):
                if len(half) > cap:
                    warnings.append(f"{self.m['title'][:24]} / {id}: {len(half)} > {cap}: {half}")
        self.m["nodes"].append(node)

    def e(self, a, b, label=None, **kw):
        edge = {"from": a, "to": b, **kw}
        if label:
            edge["label"] = label
        self.m["edges"].append(edge)


# ───────────────────────── 1 · High-level ─────────────────────────
h1 = Chart("1.1 The whole app on one page: ways in, the gate, and what a signed-in person can reach||1.1 Toàn bộ ứng dụng trên một trang: lối vào, cửa kiểm tra, và những gì người đã đăng nhập tới được",
           "Thick outline: an entry point. Diamond: a check. Red: a refusal. Each box on the right continues in a detailed flow of section 2.||Viền đậm: một lối vào. Hình thoi: một lần kiểm tra. Đỏ: bị từ chối. Mỗi ô bên phải được vẽ tiếp ở một flow chi tiết trong mục 2.",
           ["**Entry points (4):** the Toki address, a link to a conversation or message (from a notification, a mail or a colleague), the installed app icon, and the invitation mail.||**Lối vào (4):** địa chỉ Toki, link tới một cuộc trò chuyện hoặc tin nhắn (từ thông báo, mail hoặc đồng nghiệp), icon ứng dụng đã cài, và mail mời.",
            "**One gate:** every way in passes the session check. Nothing in Toki is readable without a session; there is no public page besides sign-in.||**Một cửa kiểm tra:** mọi lối vào đều qua bước kiểm tra phiên. Không có gì trong Toki đọc được khi chưa có phiên; ngoài trang đăng nhập không có trang công khai nào.",
            "**Role check:** Admin is the only section gated by role. Everything else is gated by membership of the conversation, checked on the server for every request.||**Kiểm tra vai trò:** Admin là mục duy nhất chặn theo vai trò. Mọi thứ khác chặn theo tư cách thành viên của cuộc trò chuyện, kiểm tra ở server cho mọi request."],
           lanes=False, colWidth=236, rowHeight=86)
h1.n("inv", 0, 0, "Invitation mail: Join||Mail mời: nút Join", "first time only||chỉ lần đầu", "st")
h1.n("d_inv", 1, 0, "Invitation valid?||Lời mời hợp lệ?", "unused, under 7 days (G4)||chưa dùng, dưới 7 ngày (G4)", "d")
h1.n("welcome", 2, 0, "Welcome step||Màn hình chào", "not in the prototype · FQ-15||không có trong prototype · FQ-15")
h1.n("x_inv", 1, 1, "Refusal page with reason||Trang từ chối kèm lý do", "expired / revoked · wording: FQ-13||hết hạn / thu hồi · câu chữ: FQ-13", "x", terminal=True)
h1.n("url", 0, 2, "Opens the Toki address||Mở địa chỉ Toki", None, "st")
h1.n("link", 0, 3, "Opens a link||Mở một link", "notification, mail, shared||thông báo, mail, được gửi", "st")
h1.n("pwa", 0, 4, "Installed app icon||Icon ứng dụng đã cài", None, "st")
h1.n("d_sess", 1, 3, "Valid session?||Phiên còn hiệu lực?", "30 days (Q11)||30 ngày (Q11)", "d")
h1.n("email", 1, 5, "Sign-in: email||Đăng nhập: email", "flow 2.1||flow 2.1")
h1.n("code", 2, 5, "Enter the 6-digit code||Nhập mã 6 số", "or press the button in the mail||hoặc bấm nút trong mail")
h1.n("d_code", 3, 5, "Code accepted?||Mã được chấp nhận?", None, "d")
h1.n("x_code", 3, 6, "Error under the field||Lỗi ngay dưới ô nhập", "wrong, expired, locked, too many||sai, hết hạn, bị khoá, quá nhiều", "x")
h1.n("home", 4, 3, "Home||Home", "last conversation, or the link's||cuộc trò chuyện gần nhất / theo link")
for i, (nid, lab, sub) in enumerate([
        ("conv", "Conversation||Cuộc trò chuyện", "read, send, thread, files · 2.4–2.7||đọc, gửi, thread, file · 2.4–2.7"),
        ("chan", "Channels and DMs||Kênh và DM", "create, join, leave · 2.8, 2.9, 2.14||tạo, tham gia, rời · 2.8, 2.9, 2.14"),
        ("act", "Activity||Activity", "mentions, threads, reactions||mention, thread, reaction"),
        ("later", "Later||Later", "saved items, reminders · 2.11||mục đã lưu, nhắc việc · 2.11"),
        ("files", "Files · People · Ctrl+K||Files · People · Ctrl+K", "find and open||tìm và mở"),
        ("prefs", "Preferences and status||Preferences và trạng thái", "Pause, Focus, look, language||Pause, Focus, giao diện, ngôn ngữ")]):
    h1.n(nid, 5, i, lab, sub, terminal=True)
    h1.e("home", nid)
h1.n("d_role", 5, 6, "Admin or Owner?||Admin hoặc Owner?", None, "d")
h1.n("admin", 6, 6, "Admin||Admin", "invite, roles, deactivate · 2.12–13||mời, vai trò, vô hiệu · 2.12–13", terminal=True)
h1.n("x_admin", 6, 7, "No Admin entry||Không có mục Admin", "its address shows 'No access'||địa chỉ đó báo 'No access'", "x", terminal=True)
h1.e("inv", "d_inv"); h1.e("d_inv", "welcome", Y); h1.e("d_inv", "x_inv", N); h1.e("welcome", "home", t=.3)
h1.e("url", "d_sess"); h1.e("link", "d_sess"); h1.e("pwa", "d_sess")
h1.e("d_sess", "home", Y); h1.e("d_sess", "email", N)
h1.e("email", "code"); h1.e("code", "d_code"); h1.e("d_code", "home", Y); h1.e("d_code", "x_code", N); h1.e("x_code", "code", "retry / resend||thử lại / gửi lại")
h1.e("home", "d_role"); h1.e("d_role", "admin", Y); h1.e("d_role", "x_admin", N)

h2 = Chart("1.2 Exit points: every way a person stops being in the app||1.2 Lối ra: mọi cách một người rời khỏi ứng dụng",
           "Filled pill: where the person ends up.||Ô bo tròn tô màu: nơi người dùng dừng lại.",
           ["Only **Sign out** and **deactivation** end the session on purpose. Closing the tab never does.||Chỉ **Sign out** và **vô hiệu hoá** là chủ động kết thúc phiên. Đóng tab thì không bao giờ.",
            "Losing the connection is not an exit: the person stays on the same screen, read-only, until it returns (flow 3.1).||Mất kết nối không phải là lối ra: người dùng ở nguyên màn hình, chỉ đọc, cho tới khi có lại mạng (flow 3.1)."],
           lanes=False, colWidth=250, rowHeight=78)
h2.n("any", 0, 2, "Signed in, on any screen||Đã đăng nhập, ở bất kỳ đâu", None, "st")
rows = [("so", "Account menu → Sign out||Menu tài khoản → Sign out", "not in the prototype (N-04)||không có trong prototype (N-04)", "Session deleted on the server||Xoá phiên trên server", None, "Sign-in page||Trang đăng nhập", None),
        ("cl", "Closes the tab or the app||Đóng tab hoặc ứng dụng", None, "Session kept for 30 days||Phiên giữ 30 ngày", None, "Next open goes straight in||Lần mở sau vào thẳng", None),
        ("ex", "Session expires or is revoked||Phiên hết hạn hoặc bị thu hồi", "signed out from another device||bị đăng xuất từ thiết bị khác", "Next request is refused||Request kế tiếp bị từ chối", "flow 3.2||flow 3.2", "'Session ended' → sign in||'Session ended' → đăng nhập", "then back to the same place||rồi quay lại đúng chỗ cũ"),
        ("de", "An admin deactivates them||Bị admin vô hiệu hoá", None, "All sessions end at once||Mọi phiên kết thúc ngay", None, "'Account deactivated' page||Trang 'Account deactivated'", "no sign-in button||không có nút đăng nhập"),
        ("of", "Connection drops||Mất kết nối", None, "Banner; content read-only||Banner; nội dung chỉ đọc", "flow 3.1||flow 3.1", "Reconnects and catches up||Kết nối lại và bắt kịp", "not an exit||không phải lối ra")]
for i, (k, a, asub, b, bsub, c, csub) in enumerate(rows):
    h2.n(k + "1", 1, i, a, asub); h2.n(k + "2", 2, i, b, bsub); h2.n(k + "3", 3, i, c, csub, "en", w=206)
    h2.e("any", k + "1"); h2.e(k + "1", k + "2"); h2.e(k + "2", k + "3")

# ───────────────────────── 2 · Detailed flows ─────────────────────────
D = []

c = Chart("2.1 Sign in with an emailed code||2.1 Đăng nhập bằng mã gửi qua email",
          "Happy path runs down the middle; every refusal returns to a screen where the person can act.||Luồng chính chạy dọc ở giữa; mọi lần bị từ chối đều quay về một màn hình mà người dùng làm tiếp được.",
          ["**Before:** the address belongs to an active member; this device has no valid session.||**Trước:** địa chỉ thuộc về một thành viên đang hoạt động; thiết bị này chưa có phiên hợp lệ.",
           "**After:** a 30-day session on this device only; the code can never be used again; the app opens where the person was heading.||**Sau:** một phiên 30 ngày chỉ trên thiết bị này; mã không dùng lại được; ứng dụng mở đúng nơi người dùng định tới.",
           "**Validation:** email must look like an address before the button enables. Code: exactly 6 digits, one use. Valid 10 minutes and cancelled after 5 wrong tries are assumptions (FA-13, FA-14). At most 5 code requests per address in 15 minutes (G5).||**Kiểm tra:** email phải đúng dạng thì nút mới bật. Mã: đúng 6 số, dùng một lần. Hiệu lực 10 phút và huỷ sau 5 lần sai là giả định (FA-13, FA-14). Tối đa 5 lần xin mã cho một địa chỉ trong 15 phút (G5).",
           "**Back / cancel / retry:** 'Use a different email' returns to the email field. 'Resend code' enables after 60 seconds. A network failure re-enables the button with 'Could not connect'.||**Quay lại / huỷ / thử lại:** 'Use a different email' quay về ô email. 'Resend code' bật sau 60 giây. Lỗi mạng thì nút bấm lại được, kèm 'Could not connect'.",
           "**Alternative:** the mail also has a sign-in button. Pressing it signs in the device where it is pressed and skips typing the code.||**Nhánh khác:** mail còn có nút đăng nhập. Bấm nút thì thiết bị bấm được đăng nhập, không cần gõ mã.",
           "**Security rule:** the answer to a code request is identical for members and strangers, so the page never reveals who is a member.||**Quy tắc bảo mật:** câu trả lời cho yêu cầu xin mã giống hệt nhau với thành viên và người lạ, nên trang không bao giờ lộ ai là thành viên."])
c.n("s", U, 0, "Opens Toki without a session||Mở Toki khi chưa có phiên", None, "st")
c.n("f_email", F, 0, "Sign-in card: email field||Thẻ đăng nhập: ô email", "'Send code' disabled until email is valid||'Send code' tắt cho tới khi email hợp lệ")
c.n("u_email", U, 1, "Types email, presses Send code||Gõ email, bấm Send code")
c.n("f_load", F, 1, "Button loading, field locked||Nút đang tải, ô bị khoá", None, "s")
c.n("b_req", B, 1, "POST /auth/code-requests||POST /auth/code-requests", "same answer whoever asks||trả lời như nhau với mọi người")
c.n("d_rate", B, 2, "Over 5 requests in 15 min?||Quá 5 lần trong 15 phút?", None, "d")
c.n("x_rate", F, 2, "'Too many codes. Try again in N min'||'Too many codes. Try again in N min'", "429 · stays on the email field||429 · ở lại ô email", "x")
c.n("d_member", B, 3, "Active member?||Thành viên đang hoạt động?", None, "d")
c.n("b_mail", B, 4, "Store hashed code, queue the mail||Lưu mã đã băm, xếp hàng gửi mail", "code + sign-in button, 10 minutes||mã + nút đăng nhập, 10 phút")
c.n("f_code", F, 4, "'Check your email': 6-digit field||'Check your email': ô 6 số", "Resend disabled for 60 s||Resend tắt trong 60 giây")
c.n("d_got", U, 5, "Mail arrived?||Mail đã tới?", None, "d")
c.n("f_resend", F, 5, "Waits 60 s, presses Resend code||Đợi 60 giây, bấm Resend code", "not in the prototype · FQ-14||không có trong prototype · FQ-14", "s")
c.n("u_code", U, 6, "Types or pastes the 6 digits||Gõ hoặc dán 6 số", "submits itself on the 6th digit||tự gửi khi đủ số thứ 6")
c.n("f_lock", F, 6, "Field locked, spinner||Ô bị khoá, đang quay", None, "s")
c.n("b_sess", B, 6, "POST /auth/sessions {email, code}||POST /auth/sessions {email, code}")
c.n("d_code", B, 7, "Right code, under 10 min?||Mã đúng, dưới 10 phút?", "10 min: FA-13||10 phút: FA-13", "d")
c.n("x_code", F, 7, "'Not right. N tries left' / 'Expired'||'Not right. N tries left' / 'Expired'", "5th wrong try locks the code||sai lần 5 thì mã bị khoá", "x")
c.n("d_active", B, 8, "Account still active?||Tài khoản còn hoạt động?", None, "d")
c.n("x_deact", F, 8, "'This account has been deactivated'||'This account has been deactivated'", "contact an admin · no further step||liên hệ admin · không có bước tiếp", "x", terminal=True)
c.n("b_ok", B, 9, "Create session (30 days), set cookie||Tạo phiên (30 ngày), đặt cookie", "the code is deleted||mã bị xoá")
c.n("f_boot", F, 9, "Load the app (flow 2.3)||Tải ứng dụng (flow 2.3)")
c.n("end", U, 10, "In Toki, where they were heading||Vào Toki, đúng nơi định tới", None, "en")
c.e("s", "f_email"); c.e("f_email", "u_email"); c.e("u_email", "f_load"); c.e("f_load", "b_req"); c.e("b_req", "d_rate")
c.e("d_rate", "x_rate", Y); c.e("x_rate", "f_email", "wait||đợi", loop="right", g=18, t=.22)
c.e("d_rate", "d_member", N); c.e("d_member", "b_mail", Y); c.e("d_member", "f_code", "no: nothing is sent||không: không gửi gì", t=.62)
c.e("b_mail", "f_code"); c.e("f_code", "d_got"); c.e("d_got", "f_resend", N); c.e("f_resend", "f_load", "new code||mã mới", loop="right", g=40, t=.3)
c.e("d_got", "u_code", Y); c.e("u_code", "f_lock"); c.e("f_lock", "b_sess"); c.e("b_sess", "d_code")
c.e("d_code", "x_code", N); c.e("x_code", "f_code", "retry||thử lại", loop="left", g=18)
c.e("f_code", "f_email", "different email||email khác", loop="left", g=40)
c.e("d_code", "d_active", Y); c.e("d_active", "x_deact", N); c.e("d_active", "b_ok", Y); c.e("b_ok", "f_boot"); c.e("f_boot", "end")
D.append(c)

c = Chart("2.2 Accept an invitation (first time in)||2.2 Nhận lời mời (lần đầu vào)",
          "The link proves control of the mailbox, so no code is asked.||Link đã chứng minh người dùng có quyền với hộp thư, nên không hỏi mã.",
          ["**Before:** an Admin or Owner sent an invitation to this address (flow 2.12).||**Trước:** một Admin hoặc Owner đã gửi lời mời tới địa chỉ này (flow 2.12).",
           "**After:** the member is Active, in #general with its full history, signed in on this device; the link no longer works; #general shows 'X joined'.||**Sau:** thành viên ở trạng thái Active, đã ở trong #general với đầy đủ lịch sử, đã đăng nhập trên thiết bị này; link hết tác dụng; #general hiện 'X joined'.",
           "**Validation:** display name 1 to 80 characters (your answer, Q31). Time zone and language come from the device and can be changed.||**Kiểm tra:** tên hiển thị từ 1 đến 80 ký tự (bạn trả lời, Q31). Múi giờ và ngôn ngữ lấy từ thiết bị và đổi được.",
           "**Skip:** the welcome step can be skipped; the name becomes the part of the address before @.||**Bỏ qua:** bước chào có thể bỏ qua; tên sẽ là phần trước @ của địa chỉ.",
           "**Next:** a small card asks whether to turn on notifications.||**Tiếp theo:** một thẻ nhỏ hỏi có bật thông báo không."])
c.n("s", U, 0, "Presses Join in the invitation mail||Bấm Join trong mail mời", None, "st")
c.n("f_wait", F, 0, "Blank page with spinner||Trang trống, đang quay", None, "s")
c.n("b_acc", B, 0, "POST /auth/invitations/accept||POST /auth/invitations/accept", "{token}||{token}")
c.n("d_used", B, 1, "Link already used?||Link đã dùng rồi?", None, "d")
c.n("f_used", F, 1, "Sign-in page, email filled in||Trang đăng nhập, điền sẵn email", "continues in flow 2.1||tiếp ở flow 2.1", "s", terminal=True)
c.n("d_valid", B, 2, "Expired or revoked?||Hết hạn hoặc bị thu hồi?", "7 days||7 ngày", "d")
c.n("x_exp", F, 2, "Page says why; 'contact the inviter'||Trang nêu lý do; 'liên hệ người mời'", "wording: FQ-13 · no further step||câu chữ: FQ-13 · không có bước tiếp", "x", terminal=True)
c.n("b_act", B, 3, "Member Active; session created||Thành viên Active; tạo phiên", "added to #general; link used up||thêm vào #general; link hết hiệu lực")
c.n("f_wel", F, 3, "Welcome: name, job title, time zone||Chào: tên, chức danh, múi giờ", "not in the prototype · FQ-15||không có trong prototype · FQ-15")
c.n("u_name", U, 4, "Fills in, presses Enter Toki||Điền, bấm Enter Toki", "or Skip||hoặc Skip")
c.n("d_name", F, 4, "Name 1–80 characters?||Tên 1–80 ký tự?", "Q31 · Skip always passes||Q31 · Skip luôn qua", "d")
c.n("x_name", F, 5, "Message under the name field||Thông báo dưới ô tên", None, "x")
c.n("b_me", B, 4, "PATCH /me {name, title, timeZone}||PATCH /me {name, title, timeZone}")
c.n("f_boot", F, 6, "Load the app (flow 2.3)||Tải ứng dụng (flow 2.3)")
c.n("end", U, 7, "In #general, asked about notifications||Ở #general, được hỏi về thông báo", None, "en")
c.e("s", "f_wait"); c.e("f_wait", "b_acc"); c.e("b_acc", "d_used"); c.e("d_used", "f_used", Y); c.e("d_used", "d_valid", N)
c.e("d_valid", "x_exp", Y); c.e("d_valid", "b_act", N); c.e("b_act", "f_wel"); c.e("f_wel", "u_name"); c.e("u_name", "d_name")
c.e("d_name", "x_name", N); c.e("x_name", "f_wel", "correct it||sửa lại", loop="right"); c.e("d_name", "b_me", Y); c.e("b_me", "f_boot", t=.35); c.e("f_boot", "end")
D.append(c)

c = Chart("2.3 Open the app: session check and first load||2.3 Mở ứng dụng: kiểm tra phiên và lần tải đầu",
          "Runs every time the page loads, whichever entry point was used.||Chạy mỗi lần trang được tải, dù vào bằng lối nào.",
          ["**Before:** none. This is where every entry point lands.||**Trước:** không có. Mọi lối vào đều tới đây.",
           "**After:** the sidebar, unread counts and one conversation are on screen, and the realtime connection is open.||**Sau:** sidebar, số chưa đọc và một cuộc trò chuyện đã hiện, kết nối realtime đã mở.",
           "**Loading:** the app frame appears at once with grey placeholders for the lists; real content replaces them.||**Đang tải:** khung ứng dụng hiện ngay với ô xám giữ chỗ cho các danh sách; nội dung thật thay vào sau.",
           "**Rule:** a link to something the person may not see answers exactly like a link to something that does not exist.||**Quy tắc:** link tới thứ người dùng không được xem trả lời y hệt link tới thứ không tồn tại.",
           "**Rule:** with no link, the app opens the conversation last viewed on this device; the very first time, #general.||**Quy tắc:** không có link thì mở cuộc trò chuyện xem gần nhất trên thiết bị này; lần đầu tiên là #general."])
c.n("s", U, 0, "Opens the address, a link or the app||Mở địa chỉ, link hoặc ứng dụng", None, "st")
c.n("f_skel", F, 0, "App frame with placeholders||Khung ứng dụng với ô giữ chỗ", None, "s")
c.n("b_boot", B, 0, "GET /bootstrap||GET /bootstrap", "me, conversations, unread, event number||tôi, cuộc trò chuyện, chưa đọc, số event")
c.n("x_net", F, 1, "'Can't reach Toki' + Retry||'Can't reach Toki' + Retry", "nothing else is shown||không hiện gì khác", "x")
c.n("d_sess", B, 1, "Session valid?||Phiên hợp lệ?", None, "d")
c.n("f_signin", F, 2, "Remember the address → sign-in page||Nhớ địa chỉ → trang đăng nhập", "continues in flow 2.1||tiếp ở flow 2.1", "s", terminal=True)
c.n("d_act", B, 2, "Account active?||Tài khoản hoạt động?", None, "d")
c.n("x_deact", F, 3, "'Account deactivated' page||Trang 'Account deactivated'", "no sign-in button||không có nút đăng nhập", "x", terminal=True)
c.n("b_ok", B, 3, "200 with the bootstrap data||200 kèm dữ liệu khởi động")
c.n("f_render", F, 4, "Show sidebar; open WS /events?after=N||Hiện sidebar; mở WS /events?after=N")
c.n("d_link", F, 5, "Address names a place?||Địa chỉ trỏ tới một nơi?", "conversation or message||hội thoại hoặc tin nhắn", "d")
c.n("b_conv", B, 5, "GET /conversations/:id||GET /conversations/:id")
c.n("f_last", F, 6, "Open last conversation on this device||Mở cuộc trò chuyện gần nhất ở máy này", "first time: #general||lần đầu: #general")
c.n("d_can", B, 6, "Member, or public channel?||Thành viên / kênh công khai?", None, "d")
c.n("end", U, 7, "Reads the conversation (flow 2.4)||Đọc cuộc trò chuyện (flow 2.4)", None, "en")
c.n("x_no", F, 7, "'Not found or no access' + Home||'Not found or no access' + Home", "same page for both cases||cùng một trang cho cả hai trường hợp", "x")
c.n("f_open", F, 8, "Open it; scroll to the linked message||Mở; cuộn tới tin nhắn được link", "highlighted for 2 seconds||tô sáng 2 giây")
c.e("s", "f_skel"); c.e("f_skel", "b_boot"); c.e("f_skel", "x_net", "no answer in 10 s||10 giây không trả lời"); c.e("x_net", "f_skel", "Retry||Retry", loop="left")
c.e("b_boot", "d_sess"); c.e("d_sess", "f_signin", N, t=.4); c.e("d_sess", "d_act", Y); c.e("d_act", "x_deact", N, t=.4); c.e("d_act", "b_ok", Y)
c.e("b_ok", "f_render"); c.e("f_render", "d_link"); c.e("d_link", "b_conv", Y); c.e("d_link", "f_last", N); c.e("b_conv", "d_can")
c.e("d_can", "x_no", N, t=.4); c.e("x_no", "f_last", "Home||Home"); c.e("d_can", "f_open", Y, t=.3); c.e("f_last", "end"); c.e("f_open", "end", t=.6)
D.append(c)

c = Chart("2.4 Open and read a conversation||2.4 Mở và đọc một cuộc trò chuyện",
          "What clears an unread badge, and what does not.||Điều gì xoá huy hiệu chưa đọc, và điều gì thì không.",
          ["**Before:** signed in; a member of the conversation, or it is a public channel being previewed.||**Trước:** đã đăng nhập; là thành viên của cuộc trò chuyện, hoặc đang xem trước một kênh công khai.",
           "**After:** the read pointer sits on the newest message seen; the badge is cleared on every device of this person. Nobody else is told (no 'seen' receipts).||**Sau:** con trỏ đã đọc nằm ở tin mới nhất đã xem; huy hiệu được xoá trên mọi thiết bị của người này. Không ai khác được báo (không có 'đã xem').",
           "**Rule:** a conversation is marked read only when its newest message is on screen and the tab has focus. Opening it in a background tab changes nothing.||**Quy tắc:** chỉ đánh dấu đã đọc khi tin mới nhất nằm trên màn hình và tab đang được focus. Mở ở tab nền thì không đổi gì.",
           "**Older messages:** scrolling up loads 50 more with a spinner at the top and keeps the scroll position; at the start a 'Beginning of #name' marker shows.||**Tin cũ hơn:** cuộn lên thì tải thêm 50 tin, có vòng quay ở trên và giữ nguyên vị trí cuộn; tới đầu thì hiện mốc 'Beginning of #name'.",
           "**Load failure:** the message area shows 'Couldn't load messages' with Retry; the sidebar keeps working (flow 3.3).||**Tải lỗi:** vùng tin nhắn hiện 'Couldn't load messages' kèm Retry; sidebar vẫn dùng được (flow 3.3).",
           "**Preview:** a public channel the person has not joined is readable; the composer is replaced by a Join button.||**Xem trước:** kênh công khai chưa tham gia vẫn đọc được; ô soạn tin được thay bằng nút Join."])
c.n("s", U, 0, "Clicks a conversation in the sidebar||Bấm một cuộc trò chuyện ở sidebar", None, "st")
c.n("f_skel", F, 0, "Header at once; grey message rows||Header hiện ngay; hàng tin màu xám", None, "s")
c.n("b_get", B, 0, "GET /conversations/:id/messages||GET /conversations/:id/messages", "50 around the unread line||50 tin quanh vạch chưa đọc")
c.n("d_can", B, 1, "Allowed to read?||Được phép đọc?", None, "d")
c.n("x_no", F, 1, "'No access'; row leaves the sidebar||'No access'; hàng rời khỏi sidebar", "button: Back to Home||nút: Back to Home", "x", terminal=True)
c.n("d_any", B, 2, "Any messages?||Có tin nhắn nào không?", None, "d")
c.n("f_empty", F, 2, "Empty state: 'Start the conversation'||Trống: 'Start the conversation'", None, "s")
c.n("end0", U, 2, "Writes the first message (flow 2.5)||Viết tin đầu tiên (flow 2.5)", None, "en")
c.n("f_show", F, 3, "Show messages, scrolled to 'New' line||Hiện tin, cuộn tới vạch 'New'", "nothing unread: scrolled to the bottom||không có tin mới: cuộn xuống cuối")
c.n("d_seen", F, 4, "Newest seen, tab focused?||Thấy tin mới, tab focus?", None, "d")
c.n("b_read", B, 4, "PUT /conversations/:id/read||PUT /conversations/:id/read", "{messageId} · event to own devices||{messageId} · event tới máy của mình")
c.n("u_down", U, 5, "Scrolls down or clicks the pill||Cuộn xuống hoặc bấm vào nhãn")
c.n("f_pill", F, 5, "'N new messages' pill; badge stays||Nhãn 'N new messages'; huy hiệu vẫn còn", None, "s")
c.n("f_clear", F, 6, "Badge and bold cleared everywhere||Xoá huy hiệu và chữ đậm ở mọi nơi")
c.n("end", U, 7, "Reads, replies or moves on||Đọc, trả lời hoặc đi tiếp", None, "en")
c.e("s", "f_skel"); c.e("f_skel", "b_get"); c.e("b_get", "d_can"); c.e("d_can", "x_no", N); c.e("d_can", "d_any", Y)
c.e("d_any", "f_empty", N); c.e("f_empty", "end0"); c.e("d_any", "f_show", Y, t=.4); c.e("f_show", "d_seen")
c.e("d_seen", "b_read", Y); c.e("d_seen", "f_pill", N); c.e("f_pill", "u_down"); c.e("u_down", "d_seen", t=.4)
c.e("b_read", "f_clear", t=.4); c.e("f_clear", "end")
D.append(c)

c = Chart("2.5 Send a message||2.5 Gửi một tin nhắn",
          "The message shows before the server answers; the same message ID makes a retry safe.||Tin hiện trước khi server trả lời; dùng lại cùng ID khiến việc gửi lại an toàn.",
          ["**Before:** a member of the conversation; it is not archived; the composer holds 1 to 10,000 characters or at least one uploaded file.||**Trước:** là thành viên của cuộc trò chuyện; nó chưa bị lưu trữ; ô soạn có từ 1 đến 10.000 ký tự hoặc ít nhất một file đã tải lên.",
           "**After:** one message stored exactly once; every member's unread count rises except the sender's; mentions become Activity items (flow 2.7); the draft is cleared on all devices.||**Sau:** đúng một tin được lưu; số chưa đọc của mọi thành viên tăng, trừ người gửi; mention thành mục Activity (flow 2.7); bản nháp bị xoá trên mọi thiết bị.",
           "**Disabled:** Send does nothing while the text is empty or only spaces, is locked past 10,000 characters (a counter appears near the limit), and while a file is still uploading.||**Bị tắt:** Send không làm gì khi nội dung trống hoặc chỉ có khoảng trắng, bị khoá khi quá 10.000 ký tự (bộ đếm hiện khi gần giới hạn), và khi còn file đang tải lên.",
           "**Keys:** Enter sends, Shift+Enter makes a new line; while composing a Vietnamese word, Enter finishes the word and does not send.||**Phím:** Enter gửi, Shift+Enter xuống dòng; khi đang gõ dở một từ tiếng Việt, Enter kết thúc từ chứ không gửi.",
           "**Retry:** 'Not sent' offers Retry and Delete. Retry resends the same ID, so a message that did arrive is never doubled.||**Thử lại:** 'Not sent' có Retry và Delete. Retry gửi lại cùng ID, nên tin đã tới nơi không bao giờ bị nhân đôi.",
           "**Leaving mid-way:** switching conversation before sending keeps the text as a draft, synced to other devices.||**Rời giữa chừng:** chuyển cuộc trò chuyện trước khi gửi thì nội dung thành bản nháp, đồng bộ sang thiết bị khác."])
c.n("s", U, 0, "Types in the composer||Gõ vào ô soạn tin", None, "st")
c.n("f_comp", F, 0, "Draft saved; Send enabled when valid||Lưu nháp; Send bật khi hợp lệ", "others see 'X is typing…'||người khác thấy 'X is typing…'", "s")
c.n("u_send", U, 1, "Presses Enter or Send||Bấm Enter hoặc Send")
c.n("f_opt", F, 1, "Message shown at once, faded||Tin hiện ngay, mờ", "app creates the message ID||ứng dụng tự tạo ID tin nhắn")
c.n("d_on", F, 2, "Online?||Đang có mạng?", None, "d")
c.n("b_post", B, 2, "POST /conversations/:id/messages||POST /conversations/:id/messages", "{id, text, fileIds}||{id, text, fileIds}")
c.n("f_wait", F, 3, "'Waiting to send'||'Waiting to send'", "sends itself on reconnect (flow 3.1)||tự gửi khi có lại mạng (flow 3.1)", "s")
c.n("d_mem", B, 3, "Member, not archived?||Thành viên, chưa lưu trữ?", None, "d")
c.n("x_fail", F, 4, "'Not sent' · Retry · Delete||'Not sent' · Retry · Delete", "not in the prototype · FQ-21||không có trong prototype · FQ-21", "x")
c.n("d_dup", B, 4, "This ID already stored?||ID này đã lưu rồi?", None, "d")
c.n("x_mem", F, 5, "'Not sent' with the reason; no Retry||'Not sent' kèm lý do; không có Retry", "composer becomes Join / archived note||ô soạn thành Join / ghi chú đã lưu trữ", "x", terminal=True)
c.n("b_save", B, 5, "Save; read mentions; write events||Lưu; đọc mention; ghi event", "unread, Activity items, push jobs||chưa đọc, mục Activity, job push")
c.n("f_solid", F, 6, "Faded message becomes solid||Tin mờ thành rõ", "composer empty, keeps focus||ô soạn trống, vẫn focus")
c.n("b_ws", B, 6, "Event to every member's devices||Event tới thiết bị của mọi thành viên")
c.n("end", U, 7, "Sees the message as sent||Thấy tin đã gửi", None, "en")
c.n("end2", F, 7, "Others: message appears, unread +1||Người khác: tin hiện, chưa đọc +1", "closed app: push (flow 2.7)||ứng dụng đóng: push (flow 2.7)", "en", w=268)
c.e("s", "f_comp"); c.e("f_comp", "u_send"); c.e("u_send", "f_opt"); c.e("f_opt", "d_on"); c.e("d_on", "b_post", Y); c.e("d_on", "f_wait", N)
c.e("f_wait", "b_post", "back online||có lại mạng", t=.55); c.e("b_post", "d_mem"); c.e("b_post", "x_fail", "fails or 10 s silence||lỗi hoặc im 10 giây", t=.8)
c.e("x_fail", "d_on", "Retry, same ID||Retry, cùng ID", loop="left"); c.e("d_mem", "x_mem", N, t=.3); c.e("d_mem", "d_dup", Y)
c.e("d_dup", "b_save", N); c.e("d_dup", "f_solid", "yes: return stored one||có: trả về tin đã lưu", t=.62); c.e("b_save", "b_ws"); c.e("b_ws", "f_solid"); c.e("b_ws", "end2"); c.e("f_solid", "end")
D.append(c)

c = Chart("2.6 Attach files to a message||2.6 Đính kèm file vào tin nhắn",
          "Bytes go straight to storage; the API only hands out the permission to upload.||Dữ liệu đi thẳng tới kho lưu trữ; API chỉ cấp quyền tải lên.",
          ["**Before:** a conversation the person can write to; online (uploading is blocked offline).||**Trước:** một cuộc trò chuyện người dùng được viết vào; đang có mạng (tải lên bị chặn khi mất mạng).",
           "**After:** each file is stored once and attached to the message; it appears in the conversation's 'Files & links' tab and in Files; only people who can see the conversation can open it.||**Sau:** mỗi file được lưu một lần và gắn vào tin nhắn; nó hiện ở tab 'Files & links' của cuộc trò chuyện và ở Files; chỉ người xem được cuộc trò chuyện mới mở được.",
           "**Validation:** at most 10 files per message, 100 MB each. A refused file is named in the message; the others continue.||**Kiểm tra:** tối đa 10 file mỗi tin, mỗi file 100 MB. File bị từ chối được nêu tên trong thông báo; các file khác vẫn tiếp tục.",
           "**Cancel:** × on a card stops that upload and removes the card. Deleting the whole draft removes every card.||**Huỷ:** × trên thẻ dừng việc tải file đó và bỏ thẻ. Xoá cả bản nháp thì bỏ mọi thẻ.",
           "**Loading:** a thumbnail that is not ready shows a placeholder of the right proportions, so the list does not jump.||**Đang tải:** thumbnail chưa sẵn sàng thì hiện ô giữ chỗ đúng tỉ lệ, để danh sách không bị giật."])
c.n("s", U, 0, "Picks, drops or pastes files||Chọn, thả hoặc dán file", None, "st")
c.n("d_lim", F, 0, "≤ 10 files, each ≤ 100 MB?||≤ 10 file, mỗi ≤ 100 MB?", "10: G9 · 100 MB: Q14||10: G9 · 100 MB: Q14", "d")
c.n("x_lim", F, 1, "Card turns red: 'Over 100 MB'||Thẻ chuyển đỏ: 'Over 100 MB'", "11th file: 'Up to 10 files'; rest go on||file thứ 11: 'Up to 10 files'; còn lại đi tiếp", "x")
c.n("f_card", F, 2, "A card per file with a progress bar||Mỗi file một thẻ có thanh tiến độ", "Send disabled until all finish||Send tắt cho tới khi tải xong hết", "s")
c.n("b_url", B, 2, "POST /files → signed upload address||POST /files → địa chỉ tải lên có chữ ký", "short-lived, for this file only||tồn tại ngắn, chỉ cho file này")
c.n("f_put", F, 3, "Upload the bytes straight to storage||Tải dữ liệu thẳng lên kho lưu trữ")
c.n("b_store", B, 3, "Storage receives the file||Kho lưu trữ nhận file")
c.n("d_done", F, 4, "Upload completed?||Tải lên xong?", None, "d")
c.n("b_fin", B, 4, "POST /files/:id/complete||POST /files/:id/complete", "size checked; thumbnail job queued||kiểm tra dung lượng; xếp job thumbnail")
c.n("x_up", F, 5, "Card red: Retry · Remove||Thẻ đỏ: Retry · Remove", None, "x")
c.n("f_ready", F, 6, "All cards ready; Send enabled||Mọi thẻ sẵn sàng; Send bật")
c.n("u_send", U, 6, "Presses Send||Bấm Send")
c.n("end", U, 7, "Message sent with its files (flow 2.5)||Tin được gửi kèm file (flow 2.5)", None, "en")
c.e("s", "d_lim"); c.e("d_lim", "x_lim", N); c.e("x_lim", "f_card", "the valid ones||các file hợp lệ"); c.e("d_lim", "f_card", Y, loop="right")
c.e("f_card", "b_url"); c.e("b_url", "f_put", t=.4); c.e("f_put", "b_store"); c.e("b_store", "d_done", "answers||trả lời", t=.4); c.e("d_done", "b_fin", Y); c.e("d_done", "x_up", N)
c.e("x_up", "f_put", "Retry||Retry", loop="left"); c.e("b_fin", "f_ready", t=.35); c.e("f_ready", "u_send"); c.e("u_send", "end")
D.append(c)

c = Chart("2.7 Being mentioned: from the sender's @ to the recipient reading it||2.7 Được mention: từ dấu @ của người gửi tới lúc người nhận đọc",
          "One mention, three possible ways of being told, depending on the recipient's state.||Một mention, ba cách được báo, tuỳ trạng thái của người nhận.",
          ["**Before:** the message was sent (flow 2.5) and contains @person, @channel or @here.||**Trước:** tin đã được gửi (flow 2.5) và có @người, @channel hoặc @here.",
           "**After:** the recipient has one Activity item; it becomes done by itself once the message has been opened.||**Sau:** người nhận có một mục Activity; mục tự thành xong khi tin đã được mở.",
           "**Rule:** your own action never notifies you.||**Quy tắc:** hành động của chính mình không bao giờ tạo thông báo cho mình.",
           "**Rule:** during Pause or Focus there is no toast, push or sound; badges still update, and one summary lists what arrived when it ends.||**Quy tắc:** trong Pause hoặc Focus không có toast, push hay âm thanh; huy hiệu vẫn cập nhật, và khi kết thúc có một bản tóm tắt những gì đã tới.",
           "**Open:** a mention always gets through the 'Mentions only' level. Whether it gets through Mute is not decided (question GQ-01 on the Gap analysis tab); the chart shows the muted case as badge only until it is.||**Còn mở:** mention luôn vượt qua mức 'Mentions only'. Nó có vượt qua Mute hay không thì chưa quyết định (câu hỏi GQ-01 ở tab Phân tích gap); cho tới lúc đó sơ đồ thể hiện trường hợp tắt tiếng là chỉ có huy hiệu.",
           "**Rule:** @channel in a channel of 20 or more people asks the sender to confirm first.||**Quy tắc:** @channel trong kênh từ 20 người trở lên hỏi người gửi xác nhận trước.",
           "**Edit:** adding a mention by editing notifies the new person; removing one removes the earlier notification.||**Sửa:** thêm mention khi sửa tin thì báo cho người mới; bỏ mention thì gỡ thông báo trước đó."])
c.n("s", U, 0, "Sender types @ and picks a person||Người gửi gõ @ và chọn một người", None, "st")
c.n("f_chip", F, 0, "Picker lists members; chip in the text||Danh sách thành viên; chip trong tin")
c.n("b_saved", B, 0, "Message saved; mentions read||Tin được lưu; đọc các mention")
c.n("d_self", B, 1, "Mentioned the sender?||Mention chính người gửi?", None, "d")
c.n("f_none", F, 1, "Nothing is shown to anyone||Không hiện gì cho ai", None, "s", terminal=True)
c.n("d_mem", B, 2, "Person is in the channel?||Người đó ở trong kênh?", None, "d")
c.n("f_add", F, 2, "Sender sees 'Not in channel · Add'||Người gửi thấy 'Not in channel · Add'", "no notification is created||không tạo thông báo", "s", terminal=True)
c.n("b_item", B, 3, "Create Activity item; mention count +1||Tạo mục Activity; số mention +1")
c.n("d_quiet", B, 4, "Paused, Focus or muted?||Pause, Focus hoặc tắt tiếng?", None, "d")
c.n("f_badge", F, 4, "Badge only; no toast, push, sound||Chỉ huy hiệu; không toast, push, âm", "summary when Pause or Focus ends||tóm tắt khi Pause hoặc Focus kết thúc", "s")
c.n("d_open", B, 5, "Recipient has Toki open?||Người nhận đang mở Toki?", None, "d")
c.n("f_toast", F, 5, "Toast + red @ badge on the row||Toast + huy hiệu @ đỏ trên hàng")
c.n("b_push", B, 6, "Push job: sender, place, first words||Job push: người gửi, nơi, vài chữ đầu")
c.n("f_push", F, 6, "System notification||Thông báo hệ thống")
c.n("u_click", U, 6, "Recipient opens toast, push or item||Người nhận mở toast, push hoặc mục")
c.n("f_jump", F, 7, "Opens the message, highlighted 2 s||Mở tin nhắn, tô sáng 2 giây")
c.n("b_done", B, 7, "Item done; read pointer moves||Mục thành xong; con trỏ đã đọc dời")
c.n("f_drop", F, 8, "Badge and Activity count go down||Huy hiệu và số Activity giảm")
c.n("end", U, 8, "Reads it in context||Đọc trong ngữ cảnh", None, "en")
c.e("s", "f_chip"); c.e("f_chip", "b_saved"); c.e("b_saved", "d_self"); c.e("d_self", "f_none", Y); c.e("d_self", "d_mem", N)
c.e("d_mem", "f_add", N); c.e("d_mem", "b_item", Y); c.e("b_item", "d_quiet"); c.e("d_quiet", "f_badge", Y); c.e("d_quiet", "d_open", N)
c.e("d_open", "f_toast", Y); c.e("d_open", "b_push", N); c.e("b_push", "f_push"); c.e("f_badge", "u_click", "later||sau đó", t=.5); c.e("f_toast", "u_click"); c.e("f_push", "u_click")
c.e("u_click", "f_jump"); c.e("f_jump", "b_done"); c.e("b_done", "f_drop", t=.4); c.e("f_drop", "end")
D.append(c)

c = Chart("2.8 Create a channel||2.8 Tạo một kênh",
          "The prototype has no way to create a channel; this chart follows written flow F20.||Prototype không có cách nào tạo kênh; sơ đồ này vẽ theo flow viết F20.",
          ["**Before:** signed in as Member, Admin or Owner.||**Trước:** đã đăng nhập với vai trò Member, Admin hoặc Owner.",
           "**After:** the channel exists, the creator is its only member, it is open on screen and listed in the sidebar.||**Sau:** kênh tồn tại, người tạo là thành viên duy nhất, kênh đang mở và có trong sidebar.",
           "**Validation:** lowercase letters, digits and hyphens, up to 80 characters, unique among all channels including archived ones. Public or private is chosen here and cannot be changed later.||**Kiểm tra:** chữ thường, số và gạch nối, tối đa 80 ký tự, không trùng với mọi kênh kể cả kênh đã lưu trữ. Công khai hay riêng tư chọn tại đây và sau này không đổi được.",
           "**Cancel:** Cancel, Esc or the × asks 'Discard this channel?' if anything was typed; an outside click does nothing.||**Huỷ:** Cancel, Esc hoặc × sẽ hỏi 'Discard this channel?' nếu đã gõ gì đó; bấm ra ngoài thì không có gì xảy ra.",
           "**Rule:** after creating, the screen shows the new thing.||**Quy tắc:** sau khi tạo, màn hình phải hiện thứ vừa tạo."])
c.n("s", U, 0, "Browse channels → Create channel||Browse channels → Create channel", "button not in the prototype · FQ-17||nút không có trong prototype · FQ-17", "st")
c.n("f_dlg", F, 0, "Dialog: name, private switch, topic||Hộp thoại: tên, riêng tư, chủ đề", "fields: FQ-18 · Create off until valid||các ô: FQ-18 · Create tắt tới khi hợp lệ")
c.n("u_name", U, 1, "Types a name||Gõ tên")
c.n("d_fmt", F, 1, "a–z, 0–9, hyphens, ≤ 80?||a–z, 0–9, gạch nối, ≤ 80?", "G7||G7", "d")
c.n("x_fmt", F, 2, "Message under the field as they type||Thông báo dưới ô ngay khi gõ", "spaces become hyphens on their own||khoảng trắng tự thành gạch nối", "x")
c.n("u_go", U, 3, "Presses Create||Bấm Create")
c.n("f_load", F, 3, "Button loading; dialog locked||Nút đang tải; hộp thoại bị khoá", None, "s")
c.n("b_post", B, 3, "POST /conversations||POST /conversations", "{kind: channel, name, private}||{kind: channel, name, private}")
c.n("d_dup", B, 4, "Name already taken?||Tên đã có rồi?", None, "d")
c.n("x_dup", F, 4, "'#name already exists' + Open it||'#name already exists' + Open it", "dialog stays, name selected||hộp thoại giữ nguyên, tên được chọn", "x")
c.n("b_make", B, 5, "Create channel; creator is a member||Tạo kênh; người tạo là thành viên")
c.n("f_open", F, 5, "Dialog closes; channel opens||Hộp thoại đóng; kênh mở ra", "listed in the sidebar||có trong sidebar")
c.n("end", U, 6, "Empty channel: add people or write||Kênh trống: thêm người hoặc viết", None, "en")
c.e("s", "f_dlg"); c.e("f_dlg", "u_name"); c.e("u_name", "d_fmt"); c.e("d_fmt", "x_fmt", N); c.e("x_fmt", "f_dlg", "keeps typing||gõ tiếp", loop="right")
c.e("d_fmt", "u_go", Y, t=.35); c.e("u_go", "f_load"); c.e("f_load", "b_post"); c.e("b_post", "d_dup"); c.e("d_dup", "x_dup", Y)
c.e("x_dup", "f_dlg", "another name||tên khác", loop="left"); c.e("d_dup", "b_make", N); c.e("b_make", "f_open"); c.e("f_open", "end")
D.append(c)

c = Chart("2.9 Join a public channel, and leave a channel||2.9 Tham gia kênh công khai, và rời một kênh",
          "Leaving a public channel can be undone; leaving a private one cannot, so it asks first.||Rời kênh công khai hoàn tác được; rời kênh riêng tư thì không, nên phải hỏi trước.",
          ["**Before (join):** the channel is public and not archived. Private channels are joined only by being added.||**Trước (tham gia):** kênh công khai và chưa lưu trữ. Kênh riêng tư chỉ vào được khi được thêm.",
           "**After (join):** member with full history; 'X joined' line in the channel; toast 'Joined #name'.||**Sau (tham gia):** là thành viên với đầy đủ lịch sử; dòng 'X joined' trong kênh; toast 'Joined #name'.",
           "**After (leave):** the channel leaves the sidebar; its unread and Activity items are cleared; 'X left' line in the channel.||**Sau (rời):** kênh rời sidebar; số chưa đọc và mục Activity của nó được xoá; dòng 'X left' trong kênh.",
           "**Rule:** #general cannot be left. A reversible action shows Undo for 5 seconds; an irreversible one asks for confirmation; never both.||**Quy tắc:** không rời được #general. Hành động hoàn tác được thì hiện Undo 5 giây; không hoàn tác được thì hỏi xác nhận; không bao giờ cả hai.",
           "**Empty and archived:** no match shows 'No channels match' and a Create button carrying the search text; archived channels are listed with a View button only.||**Trống và lưu trữ:** không có kết quả thì hiện 'No channels match' và nút Create mang sẵn từ đã tìm; kênh đã lưu trữ chỉ có nút View."])
c.n("s", U, 0, "Opens Browse channels||Mở Browse channels", None, "st")
c.n("f_list", F, 0, "List with search; grey rows first||Danh sách có ô tìm; hàng xám trước", None, "s")
c.n("b_list", B, 0, "GET /conversations?browse=1||GET /conversations?browse=1", "public ones + private ones you are in||kênh công khai + kênh riêng tư của bạn")
c.n("d_match", F, 1, "Any match for the search?||Có kênh khớp từ tìm?", None, "d")
c.n("f_empty", F, 2, "'No channels match' + Create '…'||'No channels match' + Create '…'", "continues in flow 2.8||tiếp ở flow 2.8", "s", terminal=True)
c.n("u_join", U, 3, "Presses Join on a row||Bấm Join trên một hàng", "joined rows show Open instead||hàng đã tham gia hiện Open")
c.n("f_spin", F, 3, "Join button loading||Nút Join đang tải", None, "s")
c.n("b_join", B, 3, "POST /conversations/:id/members||POST /conversations/:id/members")
c.n("d_pub", B, 4, "Public and not archived?||Công khai và chưa lưu trữ?", None, "d")
c.n("x_arch", F, 4, "'This channel was archived'||'This channel was archived'", "the list refreshes||danh sách được làm mới", "x")
c.n("b_add", B, 5, "Add the member; 'X joined' line||Thêm thành viên; dòng 'X joined'")
c.n("f_in", F, 5, "Channel opens; toast 'Joined #name'||Kênh mở; toast 'Joined #name'")
c.n("u_leave", U, 6, "Later: channel menu → Leave||Về sau: menu kênh → Leave")
c.n("d_kind", F, 6, "Which kind of channel?||Loại kênh nào?", None, "d")
c.n("f_gen", F, 7, "#general: Leave disabled, with reason||#general: Leave bị tắt, kèm lý do", None, "s", terminal=True)
c.n("u_conf", U, 7, "Private: confirms the warning||Riêng tư: xác nhận cảnh báo", "'You can only return if re-added'||'Chỉ quay lại được nếu được thêm lại'")
c.n("b_del", B, 7, "DELETE …/:id/members/me||DELETE …/:id/members/me", "'X left' line||dòng 'X left'")
c.n("f_out", F, 8, "Row leaves the sidebar; Home opens||Hàng rời sidebar; mở Home", "public: toast with Undo for 5 s||công khai: toast có Undo 5 giây")
c.n("end", U, 8, "No longer a member||Không còn là thành viên", None, "en")
c.e("s", "f_list"); c.e("f_list", "b_list"); c.e("b_list", "d_match", t=.4); c.e("d_match", "f_empty", N); c.e("d_match", "u_join", Y, t=.35)
c.e("u_join", "f_spin"); c.e("f_spin", "b_join"); c.e("b_join", "d_pub"); c.e("d_pub", "x_arch", N); c.e("x_arch", "f_list", "pick another||chọn kênh khác", loop="left", t=.25)
c.e("d_pub", "b_add", Y); c.e("b_add", "f_in"); c.e("f_in", "u_leave"); c.e("u_leave", "d_kind"); c.e("d_kind", "f_gen", "#general||#general")
c.e("d_kind", "u_conf", "private||riêng tư"); c.e("d_kind", "b_del", "public||công khai"); c.e("u_conf", "b_del", t=.2); c.e("b_del", "f_out", t=.4); c.e("f_out", "end")
D.append(c)

c = Chart("2.10 Edit or delete your own message||2.10 Sửa hoặc xoá tin nhắn của mình",
          "Edit is free and quiet; delete is permanent, so it asks.||Sửa thì tự do và lặng lẽ; xoá là vĩnh viễn nên phải hỏi.",
          ["**Before:** the person is the author and the message is not deleted. There is no time limit.||**Trước:** người dùng là tác giả và tin chưa bị xoá. Không giới hạn thời gian.",
           "**After (edit):** new text with '(edited)' beside the time; no history of earlier versions is kept.||**Sau (sửa):** nội dung mới kèm '(edited)' cạnh giờ; không lưu lịch sử các bản trước.",
           "**After (delete):** gone for everyone; attached files are removed from storage and from Files. A message with replies leaves a 'Message deleted' line and keeps its thread.||**Sau (xoá):** biến mất với mọi người; file đính kèm bị gỡ khỏi kho và khỏi Files. Tin có trả lời để lại dòng 'Message deleted' và giữ thread.",
           "**Cancel:** Esc or Cancel leaves the message untouched. Save is disabled while the text is unchanged; saving an empty text offers Delete instead.||**Huỷ:** Esc hoặc Cancel giữ nguyên tin. Save tắt khi nội dung chưa đổi; lưu nội dung trống thì chuyển sang đề nghị Delete.",
           "**Others:** Admins and Owners can delete other people's messages only in conversations they belong to; the author is told.||**Người khác:** Admin và Owner chỉ xoá được tin của người khác trong cuộc trò chuyện mà họ là thành viên; tác giả được báo."])
c.n("s", U, 0, "Opens More (⋯) on a message||Mở More (⋯) trên một tin", None, "st")
c.n("d_own", F, 0, "Their own, not deleted?||Tin của mình, chưa xoá?", None, "d")
c.n("f_no", F, 1, "No Edit or Delete in the menu||Menu không có Edit hay Delete", None, "s", terminal=True)
c.n("d_what", U, 2, "Edit or Delete?||Sửa hay Xoá?", None, "d")
c.n("f_edit", F, 2, "Text becomes a field: Save · Cancel||Nội dung thành ô nhập: Save · Cancel", "Save disabled while unchanged||Save tắt khi chưa đổi")
c.n("u_save", U, 3, "Changes the text, presses Save||Đổi nội dung, bấm Save")
c.n("b_patch", B, 3, "PATCH /messages/:id {text}||PATCH /messages/:id {text}", "mentions compared, notices adjusted||so sánh mention, chỉnh thông báo")
c.n("d_still", B, 4, "Still exists, still author?||Còn tồn tại, vẫn tác giả?", None, "d")
c.n("x_gone", F, 4, "'This message no longer exists'||'This message no longer exists'", "the field closes||ô nhập đóng lại", "x", terminal=True)
c.n("f_edited", F, 5, "New text with '(edited)', for everyone||Nội dung mới kèm '(edited)', mọi người")
c.n("end1", U, 5, "Message corrected||Tin đã được sửa", None, "en")
c.n("u_del", U, 6, "Chooses Delete||Chọn Delete")
c.n("f_conf", F, 6, "'Delete this message?' under it||'Delete this message?' ngay bên dưới", "Delete · Cancel (Cancel: no change)||Delete · Cancel (Cancel: không đổi gì)")
c.n("u_yes", U, 7, "Presses Delete||Bấm Delete")
c.n("b_del", B, 7, "DELETE /messages/:id||DELETE /messages/:id", "files removed from storage||file bị gỡ khỏi kho")
c.n("d_rep", B, 8, "Does it have replies?||Có trả lời không?", None, "d")
c.n("f_line", F, 8, "'Message deleted' line; thread stays||Dòng 'Message deleted'; thread vẫn còn")
c.n("f_gone", F, 9, "Message disappears for everyone||Tin biến mất với mọi người")
c.n("end2", U, 9, "Deleted; cannot be undone||Đã xoá; không hoàn tác được", None, "en")
c.e("s", "d_own"); c.e("d_own", "f_no", N); c.e("d_own", "d_what", Y, t=.3); c.e("d_what", "f_edit", "Edit||Sửa"); c.e("f_edit", "u_save"); c.e("u_save", "b_patch", t=.75)
c.e("b_patch", "d_still"); c.e("d_still", "x_gone", N); c.e("d_still", "f_edited", Y, t=.35); c.e("f_edited", "end1")
c.e("d_what", "u_del", "Delete||Xoá", loop="left", g=24); c.e("u_del", "f_conf"); c.e("f_conf", "u_yes"); c.e("u_yes", "b_del", t=.75); c.e("b_del", "d_rep")
c.e("d_rep", "f_line", Y); c.e("d_rep", "f_gone", N, t=.4); c.e("f_line", "end2", t=.6); c.e("f_gone", "end2")
D.append(c)

c = Chart("2.11 Save for Later and set a reminder||2.11 Lưu vào Later và đặt nhắc việc",
          "A personal list; nobody else sees it.||Danh sách cá nhân; không ai khác thấy.",
          ["**Before:** the person can read the message.||**Trước:** người dùng đọc được tin nhắn đó.",
           "**After:** the item is in Later under 'In progress'; with a reminder, a job is scheduled for that time; ticking the box moves it to Completed.||**Sau:** mục nằm trong Later ở 'In progress'; nếu có nhắc việc thì một job được hẹn đúng giờ đó; tick ô thì mục chuyển sang Completed.",
           "**Validation:** a reminder time must be in the future; a choice that is already past is not offered.||**Kiểm tra:** giờ nhắc phải ở tương lai; lựa chọn đã qua thì không được đưa ra.",
           "**Undo:** saving and un-saving are instant and reversible from the same bookmark; the toast 'Saved for Later' has a View button.||**Hoàn tác:** lưu và bỏ lưu đều tức thì và đảo lại được bằng chính nút bookmark; toast 'Saved for Later' có nút View.",
           "**Rule:** a count on a chip always equals the rows shown, including rows whose message was deleted.||**Quy tắc:** số trên chip luôn bằng số hàng đang hiện, kể cả hàng có tin đã bị xoá.",
           "**Empty:** with nothing saved, Later shows a centred note on how to save a message.||**Trống:** khi chưa lưu gì, Later hiện ghi chú ở giữa về cách lưu một tin."])
c.n("s", U, 0, "Presses the bookmark on a message||Bấm bookmark trên một tin", None, "st")
c.n("f_save", F, 0, "Bookmark coloured; toast with View||Bookmark đổi màu; toast có View")
c.n("b_post", B, 0, "POST /later-items {messageId}||POST /later-items {messageId}")
c.n("u_rem", U, 1, "Opens Later → Remind me on a row||Mở Later → Remind me trên một hàng")
c.n("f_menu", F, 1, "Menu: In 1 hour · Today 15:00 · …||Menu: In 1 hour · Today 15:00 · …", "Tomorrow 09:00||Tomorrow 09:00")
c.n("u_pick", U, 2, "Picks a time||Chọn một giờ")
c.n("d_fut", F, 2, "Time is in the future?||Giờ ở tương lai?", None, "d")
c.n("b_patch", B, 2, "PATCH /later-items/:id {remindAt}||PATCH /later-items/:id {remindAt}", "reminder job scheduled||hẹn job nhắc việc")
c.n("x_past", F, 3, "Past choice is hidden or refused||Lựa chọn đã qua bị ẩn hoặc từ chối", None, "x")
c.n("d_due", B, 4, "When due: Paused or Focus?||Tới giờ: Pause hoặc Focus?", None, "d")
c.n("f_hold", F, 4, "No toast or push; badge rises||Không toast hay push; huy hiệu tăng", "counted in the summary afterwards||được tính trong bản tóm tắt sau đó", "s")
c.n("f_toast", F, 5, "Toast 'Reminder: …'; row to the top||Toast 'Reminder: …'; hàng lên đầu", "push if the app is closed||push nếu ứng dụng đang đóng")
c.n("u_open", U, 6, "Opens it, then ticks the box||Mở ra, rồi tick ô")
c.n("f_done", F, 6, "Row to Completed, struck through||Hàng sang Completed, gạch ngang", "deleted source: 'Message deleted'||tin gốc đã xoá: 'Message deleted'")
c.n("b_state", B, 6, "PATCH /later-items/:id {done}||PATCH /later-items/:id {done}")
c.n("f_count", F, 7, "Chip counts and badge update||Số trên chip và huy hiệu cập nhật")
c.n("end", U, 7, "Later list is up to date||Danh sách Later đã cập nhật", None, "en")
c.e("s", "f_save"); c.e("f_save", "b_post"); c.e("f_save", "u_rem"); c.e("u_rem", "f_menu"); c.e("f_menu", "u_pick"); c.e("u_pick", "d_fut")
c.e("d_fut", "b_patch", Y); c.e("d_fut", "x_past", N); c.e("x_past", "f_menu", "pick again||chọn lại", loop="left", t=.2); c.e("b_post", "b_patch", "stored||đã lưu", loop="right", g=20)
c.e("b_patch", "d_due", "at that time||tới giờ đó"); c.e("d_due", "f_hold", Y); c.e("d_due", "f_toast", N, t=.4); c.e("f_hold", "u_open", t=.3); c.e("f_toast", "u_open")
c.e("u_open", "f_done"); c.e("f_done", "b_state"); c.e("b_state", "f_count", t=.4); c.e("f_count", "end")
D.append(c)

c = Chart("2.12 Admin: invite members||2.12 Admin: mời thành viên",
          "One result per address, so a batch never fails silently.||Mỗi địa chỉ một kết quả, nên một lô không bao giờ lỗi âm thầm.",
          ["**Before:** signed in as Admin or Owner.||**Trước:** đã đăng nhập với vai trò Admin hoặc Owner.",
           "**After:** each new address has an 'Invited' row with its expiry date and an invitation mail on its way; nothing is created twice.||**Sau:** mỗi địa chỉ mới có một hàng 'Invited' kèm ngày hết hạn và một mail mời đang được gửi; không có gì bị tạo hai lần.",
           "**Validation:** every entry must look like an address; duplicates inside the batch are merged.||**Kiểm tra:** mọi mục phải đúng dạng địa chỉ; mục trùng trong cùng một lô được gộp.",
           "**Authorization:** checked on the server for every admin request; hiding the menu item is not the check.||**Phân quyền:** kiểm tra ở server cho mọi request admin; việc ẩn mục menu không phải là kiểm tra.",
           "**Row actions:** Resend sends a fresh link and restarts the 7 days; Revoke asks for confirmation and kills the old link at once.||**Thao tác trên hàng:** Resend gửi link mới và tính lại 7 ngày; Revoke hỏi xác nhận và vô hiệu link cũ ngay.",
           "**Mail down:** the row says 'Mail not sent' and the server command for emergency access still works.||**Mail hỏng:** hàng ghi 'Mail not sent' và lệnh server cho truy cập khẩn cấp vẫn dùng được."])
c.n("s", U, 0, "Opens Admin → Members||Mở Admin → Members", None, "st")
c.n("f_skel", F, 0, "Table with grey rows||Bảng với hàng xám", None, "s")
c.n("b_list", B, 0, "GET /admin/users||GET /admin/users")
c.n("d_role", B, 1, "Admin or Owner?||Admin hoặc Owner?", None, "d")
c.n("x_role", F, 1, "'No access' page||Trang 'No access'", "403 · button: Back to Home||403 · nút: Back to Home", "x", terminal=True)
c.n("f_table", F, 2, "Members and pending invitations||Thành viên và lời mời đang chờ", "Invite button||nút Invite")
c.n("u_inv", U, 3, "Invite → types emails, picks a role||Invite → gõ email, chọn vai trò")
c.n("d_fmt", F, 3, "Every entry an address?||Mục nào cũng là địa chỉ?", None, "d")
c.n("x_fmt", F, 4, "Bad entries marked; Send disabled||Mục sai được đánh dấu; Send bị tắt", None, "x")
c.n("b_post", B, 4, "POST /admin/invitations||POST /admin/invitations", "{emails, role}||{emails, role}")
c.n("d_dup", B, 5, "Member or invited already?||Đã là thành viên / đã mời?", "per address||theo từng địa chỉ", "d")
c.n("f_dup", F, 5, "'Already in the workspace / invited'||'Already in the workspace / invited'", "nothing created||không tạo gì", "s")
c.n("b_make", B, 6, "Create invitation (7 days); queue mail||Tạo lời mời (7 ngày); xếp hàng mail")
c.n("d_mail", B, 7, "Mail server accepted it?||Máy chủ mail đã nhận?", None, "d")
c.n("x_mail", F, 7, "Row: 'Mail not sent' · Resend||Hàng: 'Mail not sent' · Resend", None, "x")
c.n("f_row", F, 8, "Row: 'Invited · expires on …'||Hàng: 'Invited · expires on …'", "Resend · Revoke||Resend · Revoke")
c.n("end", U, 9, "Sees one result per address||Thấy một kết quả cho mỗi địa chỉ", None, "en")
c.e("s", "f_skel"); c.e("f_skel", "b_list"); c.e("b_list", "d_role"); c.e("d_role", "x_role", N); c.e("d_role", "f_table", Y, t=.35)
c.e("f_table", "u_inv"); c.e("u_inv", "d_fmt"); c.e("d_fmt", "x_fmt", N); c.e("x_fmt", "d_fmt", "fix||sửa", loop="right"); c.e("d_fmt", "b_post", Y, t=.4)
c.e("b_post", "d_dup"); c.e("d_dup", "f_dup", Y); c.e("d_dup", "b_make", N); c.e("b_make", "d_mail"); c.e("d_mail", "x_mail", N); c.e("d_mail", "f_row", Y, t=.4)
c.e("f_dup", "end", t=.25); c.e("x_mail", "end", t=.3); c.e("f_row", "end")
D.append(c)

c = Chart("2.13 Admin: change a role, deactivate a member||2.13 Admin: đổi vai trò, vô hiệu hoá thành viên",
          "The effect reaches the other person's screen at once, without a new sign-in.||Hiệu lực tới màn hình của người kia ngay, không cần đăng nhập lại.",
          ["**Before:** signed in as Admin or Owner, on the Admin page.||**Trước:** đã đăng nhập với vai trò Admin hoặc Owner, ở trang Admin.",
           "**Who may do what:** only an Owner changes roles. An Admin deactivates Members; only an Owner deactivates Admins and Owners.||**Ai được làm gì:** chỉ Owner đổi vai trò. Admin vô hiệu hoá Member; chỉ Owner vô hiệu hoá Admin và Owner.",
           "**Constraints:** nobody deactivates themselves; the last Owner cannot be demoted or deactivated.||**Ràng buộc:** không ai tự vô hiệu hoá mình; Owner cuối cùng không thể bị hạ vai trò hay vô hiệu hoá.",
           "**After (role):** the label updates on Admin, People and the profile; the person gets an Activity item and sees the Admin entry appear or disappear.||**Sau (vai trò):** nhãn cập nhật ở Admin, People và hồ sơ; người đó nhận một mục Activity và thấy mục Admin xuất hiện hoặc biến mất.",
           "**After (deactivate):** every session ends; old messages stay with a 'Deactivated' label; the person leaves People, mention lists and add-people lists; DMs with them become read-only. Reactivate restores access to the same channels.||**Sau (vô hiệu hoá):** mọi phiên kết thúc; tin cũ vẫn còn kèm nhãn 'Deactivated'; người đó rời People, danh sách mention và danh sách thêm người; DM với họ thành chỉ đọc. Reactivate trả lại quyền vào đúng các kênh cũ.",
           "**Cancel:** closing the confirmation changes nothing.||**Huỷ:** đóng hộp xác nhận thì không có gì thay đổi."])
c.n("s", U, 0, "Opens a member's row menu||Mở menu trên hàng của một thành viên", None, "st")
c.n("f_menu", F, 0, "Change role · Deactivate||Change role · Deactivate", "not allowed: hidden or locked + reason||không được phép: ẩn hoặc khoá + lý do")
c.n("u_pick", U, 1, "Picks an action||Chọn một thao tác")
c.n("f_conf", F, 1, "Confirmation names person and effect||Hộp xác nhận nêu tên người và hệ quả", "Confirm · Cancel||Confirm · Cancel")
c.n("u_ok", U, 2, "Confirms||Xác nhận")
c.n("f_load", F, 2, "Button loading||Nút đang tải", None, "s")
c.n("b_patch", B, 2, "PATCH /admin/users/:id||PATCH /admin/users/:id", "{role} or {status}||{role} hoặc {status}")
c.n("d_rank", B, 3, "Allowed for this target?||Được phép với người này?", None, "d")
c.n("x_rank", F, 3, "'Only an Owner can do this'||'Only an Owner can do this'", "403 · dialog closes||403 · hộp thoại đóng", "x", terminal=True)
c.n("d_last", B, 4, "Self, or the last Owner?||Chính mình / Owner cuối?", None, "d")
c.n("x_last", F, 4, "'Make someone else an Owner first'||'Make someone else an Owner first'", "409 · nothing changes||409 · không đổi gì", "x", terminal=True)
c.n("d_kind", B, 5, "Deactivating?||Là vô hiệu hoá?", None, "d")
c.n("f_live", F, 5, "Their app: menus update live||Ứng dụng của họ: menu cập nhật ngay", "Activity: 'X changed your role'||Activity: 'X changed your role'")
c.n("b_end", B, 6, "End all sessions; close connections||Kết thúc mọi phiên; đóng kết nối")
c.n("f_out", F, 6, "Their app: 'Account deactivated'||Ứng dụng của họ: 'Account deactivated'")
c.n("f_row", F, 7, "Admin's table: row updated + toast||Bảng của admin: hàng cập nhật + toast")
c.n("end", U, 8, "Sees the new role or status||Thấy vai trò hoặc trạng thái mới", None, "en")
c.e("s", "f_menu"); c.e("f_menu", "u_pick"); c.e("u_pick", "f_conf"); c.e("f_conf", "u_ok"); c.e("u_ok", "f_load"); c.e("f_load", "b_patch"); c.e("b_patch", "d_rank")
c.e("d_rank", "x_rank", N); c.e("d_rank", "d_last", Y); c.e("d_last", "x_last", Y); c.e("d_last", "d_kind", N)
c.e("d_kind", "f_live", N); c.e("d_kind", "b_end", Y); c.e("b_end", "f_out"); c.e("f_live", "f_row", loop="left"); c.e("f_out", "f_row"); c.e("f_row", "end")
D.append(c)

c = Chart("2.14 Start a direct message or a group||2.14 Bắt đầu một tin nhắn trực tiếp hoặc một nhóm",
          "The prototype opens a DM with one person; choosing several people is not drawn.||Prototype mở được DM với một người; chọn nhiều người thì chưa được vẽ.",
          ["**Before:** signed in as Member, Admin or Owner. Guests cannot start DMs.||**Trước:** đã đăng nhập với vai trò Member, Admin hoặc Owner. Guest không mở được DM.",
           "**After:** the conversation is open. The other people see it in their list only once the first message is sent.||**Sau:** cuộc trò chuyện đang mở. Những người kia chỉ thấy nó trong danh sách khi tin đầu tiên được gửi.",
           "**Limit:** a group holds at most 8 people, counting the person who starts it. Nobody can be added or removed later; a different set of people is a new group.||**Giới hạn:** một nhóm tối đa 8 người, tính cả người tạo. Về sau không thêm hay bớt người được; một tập người khác là một nhóm mới.",
           "**Same people, same conversation:** choosing a set of people that already has a conversation reopens it with its history.||**Cùng người, cùng cuộc trò chuyện:** chọn một tập người đã có cuộc trò chuyện thì mở lại nó kèm lịch sử.",
           "**Deactivated person:** not listed in the picker; an existing DM with them stays readable, without a composer.||**Người đã bị vô hiệu hoá:** không có trong danh sách chọn; DM đã có với họ vẫn đọc được, không có ô soạn tin."])
c.n("s", U, 0, "Presses New message||Bấm New message", "pencil icon above the list||icon bút phía trên danh sách", "st")
c.n("f_dlg", F, 0, "Dialog: search people and channels||Hộp thoại: tìm người và kênh", "several people as chips: FQ-20||nhiều người dạng chip: FQ-20")
c.n("u_pick", U, 1, "Picks one or more people||Chọn một hoặc nhiều người")
c.n("d_cnt", F, 1, "1 to 7 other people?||Từ 1 tới 7 người khác?", "8 with you (Q17)||8 tính cả bạn (Q17)", "d")
c.n("x_cnt", F, 2, "'Up to 8 people, counting you'||'Up to 8 people, counting you'", "the 8th pick is refused||lượt chọn thứ 8 bị từ chối", "x")
c.n("u_go", U, 2, "Presses Start||Bấm Start", "one person: opens on the pick||một người: mở ngay khi chọn")
c.n("f_load", F, 3, "Start button loading||Nút Start đang tải", None, "s")
c.n("b_post", B, 3, "POST /conversations||POST /conversations", "{kind: dm, memberIds}||{kind: dm, memberIds}")
c.n("d_same", B, 4, "This set of people exists?||Tập người này đã có?", None, "d")
c.n("b_make", B, 5, "Create the DM or group||Tạo DM hoặc nhóm", "hidden from the others until a message||ẩn với người kia tới khi có tin")
c.n("f_open", F, 5, "Conversation opens; composer focused||Cuộc trò chuyện mở; focus ô soạn tin")
c.n("end", U, 6, "Writes the first message (flow 2.5)||Viết tin đầu tiên (flow 2.5)", None, "en")
c.e("s", "f_dlg"); c.e("f_dlg", "u_pick"); c.e("u_pick", "d_cnt"); c.e("d_cnt", "x_cnt", N); c.e("x_cnt", "f_dlg", "remove someone||bỏ bớt một người", loop="right")
c.e("d_cnt", "u_go", Y, t=.35); c.e("u_go", "f_load"); c.e("f_load", "b_post"); c.e("b_post", "d_same"); c.e("d_same", "f_open", "yes: reopen it||có: mở lại", t=.6); c.e("d_same", "b_make", N)
c.e("b_make", "f_open"); c.e("f_open", "end")
D.append(c)

# ───────────────────────── 3 · Errors and edge cases ─────────────────────────
E = []

c = Chart("3.1 The connection drops and returns||3.1 Mất kết nối rồi có lại",
          "Nothing is lost and nothing is faked.||Không mất gì và không giả vờ thành công.",
          ["**Rule:** loaded content stays readable; messages being sent wait and send themselves; every other action is blocked with an explanation, never a false success.||**Quy tắc:** nội dung đã tải vẫn đọc được; tin đang gửi thì chờ và tự gửi; mọi hành động khác bị chặn kèm giải thích, không bao giờ báo thành công giả.",
           "**Catch-up:** the app remembers the number of the last event it saw and asks for everything after it. After more than 7 days away it reloads everything instead.||**Bắt kịp:** ứng dụng nhớ số của event cuối cùng đã thấy và xin mọi thứ sau đó. Vắng hơn 7 ngày thì tải lại toàn bộ.",
           "**No duplicates:** a waiting message is resent with its original ID.||**Không trùng:** tin đang chờ được gửi lại với đúng ID ban đầu.",
           "**Banner:** it never covers the composer or the navigation.||**Banner:** không bao giờ che ô soạn tin hay thanh điều hướng."])
c.n("s", U, 0, "Using Toki; the network drops||Đang dùng Toki; mạng rớt", None, "st")
c.n("f_det", F, 0, "Connection closes or goes silent||Kết nối đóng hoặc im lặng")
c.n("f_ban", F, 1, "'Offline: showing saved messages'||'Offline: showing saved messages'", "the prototype's banner · still readable||banner của prototype · vẫn đọc được", "s")
c.n("u_msg", U, 2, "Sends a message||Gửi một tin nhắn")
c.n("f_q", F, 2, "Shown as 'Waiting to send'||Hiện là 'Waiting to send'", None, "s")
c.n("u_oth", U, 3, "Tries anything else||Thử bất kỳ việc gì khác", "react, upload, join, save, edit||reaction, tải lên, tham gia, lưu, sửa")
c.n("x_blk", F, 3, "'You're offline' · action not done||'You're offline' · không thực hiện", "can be repeated once online||làm lại được khi có mạng", "x", terminal=True)
c.n("f_retry", F, 4, "Retries: 1 s, 2 s, 5 s … up to 30 s||Thử lại: 1 giây, 2, 5 … tối đa 30 giây", "'Reconnecting…' wording: FQ-22||câu chữ 'Reconnecting…': FQ-22")
c.n("b_ws", B, 4, "WS /events?after=N||WS /events?after=N")
c.n("d_sess", B, 5, "Session still valid?||Phiên còn hợp lệ?", None, "d")
c.n("f_signin", F, 5, "'Session ended' (flow 3.2)||'Session ended' (flow 3.2)", "waiting messages are kept||tin đang chờ được giữ lại", "s", terminal=True)
c.n("d_gap", B, 6, "Away for under 7 days?||Vắng dưới 7 ngày?", None, "d")
c.n("f_reload", F, 6, "Reload all app data||Tải lại toàn bộ dữ liệu")
c.n("b_miss", B, 7, "Send every missed event, in order||Gửi mọi event bị lỡ, theo thứ tự")
c.n("f_apply", F, 7, "Apply them; banner disappears||Áp dụng; banner biến mất")
c.n("f_flush", F, 8, "Waiting messages send, oldest first||Tin đang chờ được gửi, cũ nhất trước", "same IDs, so no duplicates||cùng ID nên không trùng")
c.n("end", U, 9, "Back to normal; nothing lost||Trở lại bình thường; không mất gì", None, "en")
c.e("s", "f_det"); c.e("f_det", "f_ban"); c.e("f_ban", "u_msg"); c.e("f_ban", "u_oth", t=.6); c.e("u_msg", "f_q"); c.e("u_oth", "x_blk")
c.e("f_ban", "f_retry", "meanwhile||trong lúc đó", loop="right"); c.e("f_q", "f_flush", "on reconnect||khi có lại mạng", loop="left")
c.e("f_retry", "b_ws"); c.e("b_ws", "d_sess"); c.e("d_sess", "f_signin", N); c.e("d_sess", "d_gap", Y); c.e("d_gap", "f_reload", N); c.e("d_gap", "b_miss", Y)
c.e("b_miss", "f_apply"); c.e("f_reload", "f_apply"); c.e("f_apply", "f_flush"); c.e("f_flush", "end")
E.append(c)

c = Chart("3.2 The session ends while the app is in use||3.2 Phiên kết thúc khi đang dùng ứng dụng",
          "Expired, signed out elsewhere, or deactivated: three causes, two outcomes.||Hết hạn, bị đăng xuất ở nơi khác, hoặc bị vô hiệu hoá: ba nguyên nhân, hai kết cục.",
          ["**Before:** the app is open with a session that has just stopped being valid.||**Trước:** ứng dụng đang mở với một phiên vừa hết hợp lệ.",
           "**After:** nothing of the workspace stays readable on screen; after signing in again the person is back in the same conversation with the draft still in the composer.||**Sau:** không nội dung nào của workspace còn đọc được trên màn hình; đăng nhập lại thì người dùng về đúng cuộc trò chuyện, bản nháp vẫn trong ô soạn.",
           "**Rule:** the server checks the session on every request and closes the realtime connection the moment a session ends.||**Quy tắc:** server kiểm tra phiên ở mọi request và đóng kết nối realtime ngay khi phiên kết thúc.",
           "**Rule:** a deactivated account gets no sign-in button, and its locally kept drafts are cleared.||**Quy tắc:** tài khoản bị vô hiệu hoá không có nút đăng nhập, và bản nháp lưu trên máy bị xoá."])
c.n("s", U, 0, "Does anything, or just has Toki open||Làm gì đó, hoặc chỉ đang mở Toki", None, "st")
c.n("f_req", F, 0, "A request, or the open connection||Một request, hoặc kết nối đang mở")
c.n("b_chk", B, 0, "Session checked on every request||Kiểm tra phiên ở mọi request")
c.n("d_ok", B, 1, "Session valid?||Phiên hợp lệ?", None, "d")
c.n("f_go", F, 1, "The action proceeds as normal||Hành động diễn ra bình thường", None, "en")
c.n("d_deact", B, 2, "Account deactivated?||Tài khoản bị vô hiệu hoá?", None, "d")
c.n("x_deact", F, 2, "'This account has been deactivated'||'This account has been deactivated'", "content covered; no sign-in button||nội dung bị che; không có nút đăng nhập", "x", terminal=True)
c.n("b_401", B, 3, "401; realtime connection closed||401; đóng kết nối realtime", "expired after 30 days, or revoked||hết hạn sau 30 ngày, hoặc bị thu hồi")
c.n("f_cover", F, 3, "'Your session has ended' covers all||'Your session has ended' che toàn bộ", "address and draft kept locally||địa chỉ và bản nháp giữ trên máy", "s")
c.n("u_again", U, 4, "Presses Sign in again (flow 2.1)||Bấm Sign in again (flow 2.1)")
c.n("d_same", F, 4, "Same person as before?||Cùng người như trước?", None, "d")
c.n("f_back", F, 5, "Same conversation; draft restored||Cùng cuộc trò chuyện; khôi phục nháp")
c.n("f_other", F, 6, "Kept draft cleared; their own Home||Xoá nháp đã giữ; mở Home của họ")
c.n("end", U, 6, "Continues working||Làm việc tiếp", None, "en")
c.e("s", "f_req"); c.e("f_req", "b_chk"); c.e("b_chk", "d_ok"); c.e("d_ok", "f_go", Y); c.e("d_ok", "d_deact", N); c.e("d_deact", "x_deact", Y)
c.e("d_deact", "b_401", N); c.e("b_401", "f_cover"); c.e("f_cover", "u_again"); c.e("u_again", "d_same"); c.e("d_same", "f_back", Y); c.e("d_same", "f_other", N, loop="right")
c.e("f_back", "end", t=.4); c.e("f_other", "end")
E.append(c)

c = Chart("3.3 A request is refused or fails: one behaviour for every feature||3.3 Một request bị từ chối hoặc lỗi: một cách xử lý cho mọi tính năng",
          "Each answer from the server maps to exactly one thing the person sees. Every refusal leads back to a state where they can act.||Mỗi câu trả lời của server ứng với đúng một thứ người dùng thấy. Mọi lần bị từ chối đều dẫn về trạng thái mà họ làm tiếp được.",
          ["**Disabled while waiting:** the control that started the request is disabled and shows a spinner, so nothing is submitted twice.||**Tắt trong lúc chờ:** nút vừa gây ra request bị tắt và hiện vòng quay, nên không có gì bị gửi hai lần.",
           "**Form kept:** a refusal never clears what the person typed.||**Giữ form:** bị từ chối không bao giờ làm mất những gì người dùng đã gõ.",
           "**No access and not found look the same**, so the app never confirms that a private thing exists.||**Không có quyền và không tồn tại trông giống nhau**, nên ứng dụng không bao giờ xác nhận một thứ riêng tư có tồn tại.",
           "**Error ID:** a server error shows a short ID the person can pass on; the same ID is in the server log.||**Mã lỗi:** lỗi server hiện một mã ngắn để người dùng chuyển lại; cùng mã đó có trong log server.",
           "**401** is handled by flow 3.2 for every request.||**401** được xử lý ở flow 3.2 cho mọi request."])
c.n("s", U, 0, "Any action that needs the server||Bất kỳ hành động nào cần tới server", None, "st")
c.n("f_wait", F, 0, "Control disabled + spinner||Nút bị tắt + vòng quay", None, "s")
c.n("b_any", B, 0, "Any API request||Bất kỳ request API nào")
ladder = [("net", "Answer within 10 s?||Trả lời trong 10 giây?", "'Couldn't reach Toki' · Retry||'Couldn't reach Toki' · Retry", "no answer||không trả lời", N, Y),
          ("val", "400: input not valid?||400: dữ liệu không hợp lệ?", "Message under the field; form kept||Thông báo dưới ô; giữ nguyên form", "says what to change||nêu cần sửa gì", Y, N),
          ("acc", "403 / 404: not allowed?||403 / 404: không được phép?", "'Not found or no access'||'Not found or no access'", "item leaves lists; Back to Home||mục rời danh sách; Back to Home", Y, N),
          ("con", "409 / 410: changed or gone?||409 / 410: đã đổi hoặc mất?", "'This changed' → fresh copy shown||'This changed' → hiện bản mới", "e.g. name taken, message deleted||vd. trùng tên, tin đã xoá", Y, N),
          ("rate", "429: too many requests?||429: quá nhiều request?", "'Slow down. Try again in N s'||'Slow down. Try again in N s'", "control disabled until then||nút tắt cho tới lúc đó", Y, N),
          ("srv", "5xx: server error?||5xx: lỗi server?", "'Something went wrong' · Retry||'Something went wrong' · Retry", "with a short error ID||kèm một mã lỗi ngắn", Y, N)]
prev = "b_any"
for i, (k, q, msg, sub, bad, good) in enumerate(ladder, start=1):
    c.n("d_" + k, B, i, q, None, "d"); c.n("x_" + k, F, i, msg, sub, "x")
    c.e(prev, "d_" + k, None if prev == "b_any" else good_prev); c.e("d_" + k, "x_" + k, bad)
    c.e("x_" + k, "f_wait", "retry or correct||thử lại hoặc sửa" if i == 3 else None, loop="left", t=.5)
    prev, good_prev = "d_" + k, good
c.n("f_ok", F, 7, "Success: screen updates; control back||Thành công: màn hình cập nhật; nút bật")
c.n("end", U, 7, "Sees the result of the action||Thấy kết quả của hành động", None, "en")
c.e("s", "f_wait"); c.e("f_wait", "b_any"); c.e("d_srv", "f_ok", N, t=.4); c.e("f_ok", "end")
E.append(c)

# ───────────────────────── Evidence under every chart ─────────────────────────
# number: what the prototype has for this flow. The questions and answers behind each chart are in CITE, further down.
SRC = {
    "1.1": "It opens straight into Home as Lan, an Owner. There is no sign-in, invitation, welcome or refusal page for members. The only sign-in screens belong to the guest portal (phase 5; demo guide → 'View as guest'): an email step, then a code step that says 'It works for 10 minutes'. Ctrl K exists: the Search box at the top of the left sidebar carries the label 'Ctrl K', and the keys open the command palette. Admin exists in the left navigation but holds only analytics and automations.||Prototype mở thẳng vào Home với tư cách Lan, một Owner. Không có trang đăng nhập, lời mời, màn hình chào hay trang từ chối cho thành viên. Các màn hình đăng nhập duy nhất thuộc cổng guest (phase 5; demo guide → 'View as guest'): bước email, rồi bước nhập mã có ghi 'It works for 10 minutes'. Ctrl K có thật: ô Search ở đầu sidebar trái mang nhãn 'Ctrl K', và tổ hợp phím mở bảng lệnh. Admin có ở thanh điều hướng trái nhưng chỉ chứa thống kê và automation.",
    "1.2": "Sign out is not in the prototype. The account menu holds Set status, Pause notifications, Focus time and Preferences only (finding N-04). There are no sessions, so 'Session ended' and 'Account deactivated' do not exist either. Offline is a demo switch.||Sign out không có trong prototype. Menu tài khoản chỉ có Set status, Pause notifications, Focus time và Preferences (phát hiện N-04). Prototype không có phiên, nên 'Session ended' và 'Account deactivated' cũng không tồn tại. Offline là một công tắc demo.",
    "2.1": "No member sign-in. The nearest screens are the guest portal's: 'Sign in as a guest' (email, 'Email me a code') and 'Check your email' (6-digit field, 'Sign in', 'Use a different email', 'It works for 10 minutes'). That screen has **no Resend**, no limit on requests and no wrong-code state (any 6 digits work). Its two errors show in a red line under the card.||Không có đăng nhập cho thành viên. Màn hình gần nhất là của cổng guest: 'Sign in as a guest' (email, 'Email me a code') và 'Check your email' (ô 6 số, 'Sign in', 'Use a different email', 'It works for 10 minutes'). Màn hình đó **không có Resend**, không giới hạn số lần xin mã và không có trạng thái sai mã (6 số nào cũng được). Hai lỗi của nó hiện ở một dòng đỏ dưới thẻ.",
    "2.2": "Nothing. The only invitation in the prototype is 'Invite a client' for guests, in a channel's Details panel. There is no welcome step and no refusal page.||Không có gì. Lời mời duy nhất trong prototype là 'Invite a client' dành cho guest, ở panel Details của kênh. Không có màn hình chào và không có trang từ chối.",
    "2.3": "Everything is in memory, so the app appears at once. There are no placeholders, no 'Can't reach Toki', and the address does not change with the screen (findings N-05, N-13).||Mọi thứ nằm sẵn trong bộ nhớ nên ứng dụng hiện ngay. Không có ô giữ chỗ, không có 'Can't reach Toki', và địa chỉ không đổi theo màn hình (phát hiện N-05, N-13).",
    "2.4": "Home: the conversation list, the message list, unread badges and the 'New' divider exist. There is no loading state and no failure state.||Home: danh sách cuộc trò chuyện, danh sách tin nhắn, huy hiệu chưa đọc và vạch 'New' có trong prototype. Không có trạng thái đang tải và trạng thái lỗi.",
    "2.5": "The composer and Send exist. With the demo offline switch on, a sent message appears faded with 'Waiting to send'. **'Not sent', Retry and Delete are not in the prototype** (the words do not occur in it), and there is no character counter.||Ô soạn tin và Send có trong prototype. Khi bật công tắc demo offline, tin gửi đi hiện mờ kèm 'Waiting to send'. **'Not sent', Retry và Delete không có trong prototype** (các chữ này không xuất hiện), và không có bộ đếm ký tự.",
    "2.6": "The paperclip in the composer adds a finished sample file at once. There is no file picker, progress bar, limit or failure (finding N-07). The numbers 10 and 100 MB appear nowhere in the prototype.||Icon kẹp giấy ở ô soạn tin thêm ngay một file mẫu đã xong. Không có chọn file, thanh tiến độ, giới hạn hay lỗi (phát hiện N-07). Con số 10 và 100 MB không xuất hiện ở đâu trong prototype.",
    "2.7": "The @ button and the people picker are in the composer; Activity lists mentions; Pause and Focus time are in the account menu; Preferences has 'Notify me for @mentions even in muted channels'. Push and the recipient's side cannot be observed: only one person is simulated.||Nút @ và danh sách chọn người nằm ở ô soạn tin; Activity liệt kê mention; Pause và Focus time nằm trong menu tài khoản; Preferences có 'Notify me for @mentions even in muted channels'. Push và phía người nhận không quan sát được: prototype chỉ mô phỏng một người.",
    "2.8": "**A channel cannot be created in the prototype.** The sidebar has a '#' icon and a '+ Browse channels' row; both open Browse channels, which has a search field and Join or Open per row, and nothing to create a channel (finding N-03).||**Prototype không tạo được kênh.** Sidebar có icon '#' và hàng '+ Browse channels'; cả hai đều mở Browse channels, nơi chỉ có ô tìm và nút Join hoặc Open trên từng hàng, không có gì để tạo kênh (phát hiện N-03).",
    "2.9": "Browse channels (search, Join, Open) exists. Leaving is in the Details panel: 'Leave channel', then 'Leave #name? You can rejoin from Browse channels.', then a toast with Undo, for public and private alike (finding N-09). Removing someone else from a channel does not exist.||Browse channels (tìm, Join, Open) có trong prototype. Rời kênh nằm ở panel Details: 'Leave channel', rồi 'Leave #name? You can rejoin from Browse channels.', rồi một toast có Undo, giống nhau cho kênh công khai và riêng tư (phát hiện N-09). Gỡ người khác khỏi kênh thì không có.",
    "2.10": "The More menu on your own message has Edit and Delete. Edit turns the text into a field with Save and Cancel and adds '(edited)'. Deleting a message with a thread removes every reply in the prototype.||Menu More trên tin của mình có Edit và Delete. Edit biến nội dung thành ô nhập có Save và Cancel, rồi thêm '(edited)'. Trong prototype, xoá một tin có thread thì xoá luôn mọi trả lời.",
    "2.11": "The bookmark on a message, the Later section, 'Remind me' or 'Change' on each row with a menu of times, and 'Remind me about this' in the message menu all exist.||Bookmark trên tin nhắn, mục Later, 'Remind me' hoặc 'Change' trên từng hàng kèm menu giờ, và 'Remind me about this' trong menu tin nhắn đều có trong prototype.",
    "2.12": "**Not in the prototype.** Admin (the shield in the left navigation) has two tabs, analytics and automations; there is no members table and no invitation for members (finding N-02). The only invitation dialog is 'Invite a client' for guests.||**Không có trong prototype.** Admin (icon khiên ở thanh điều hướng trái) có hai tab, thống kê và automation; không có bảng thành viên và không có lời mời cho thành viên (phát hiện N-02). Hộp thoại mời duy nhất là 'Invite a client' cho guest.",
    "2.13": "**Not in the prototype.** Admin has no members table, so there is no role menu and no Deactivate (finding N-02). People and the profile panel show a role label, read-only.||**Không có trong prototype.** Admin không có bảng thành viên, nên không có menu vai trò và không có Deactivate (phát hiện N-02). People và panel hồ sơ có hiện nhãn vai trò, chỉ đọc.",
    "2.14": "'New message' is the pencil icon above the conversation list. Its dialog has one field, 'Search people and channels'; pressing a row opens that DM or channel at once. **Several people cannot be chosen**, so a group cannot be started. One group exists as sample data only: 'Alex, Thu', three people.||'New message' là icon bút phía trên danh sách cuộc trò chuyện. Hộp thoại có một ô, 'Search people and channels'; bấm một hàng thì mở ngay DM hoặc kênh đó. **Không chọn được nhiều người**, nên không tạo được nhóm. Chỉ có một nhóm trong dữ liệu mẫu: 'Alex, Thu', ba người.",
    "3.1": "A demo switch turns the network off. The prototype then shows a strip above the chat, 'Offline: showing saved messages · messages you send wait until you are back online', the same words above the conversation list, and 'Waiting to send' on messages. **'Reconnecting…' and 'Reconnected' are not in the prototype**, and other actions are not blocked (GAP-21).||Một công tắc demo tắt mạng. Khi đó prototype hiện một dải phía trên khung chat, 'Offline: showing saved messages · messages you send wait until you are back online', cùng câu đó phía trên danh sách cuộc trò chuyện, và 'Waiting to send' trên tin nhắn. **'Reconnecting…' và 'Reconnected' không có trong prototype**, và các thao tác khác không bị chặn (GAP-21).",
    "3.2": "**Not in the prototype.** It has no sign-in and no sessions, so none of these screens exist (finding N-01).||**Không có trong prototype.** Prototype không có đăng nhập và không có phiên, nên không màn hình nào ở đây tồn tại (phát hiện N-01).",
    "3.3": "**Not in the prototype.** There is no server; every action succeeds at once. The words 'error' and 'Retry' do not occur in it (finding N-06). Problems in forms are reported by a toast after pressing the button (finding N-08).||**Không có trong prototype.** Không có server; mọi thao tác thành công tức thì. Chữ 'error' và 'Retry' không xuất hiện (phát hiện N-06). Lỗi trong form được báo bằng toast sau khi bấm nút (phát hiện N-08).",
}
# ───────────────────────── 4 · Business rules and assumptions ─────────────────────────
def rows(text):
    return [[cell.strip() for cell in line.split("|")] for line in text.strip().split("\n")]

RULES_EN = rows("""
BR-01 | Nothing in Toki is readable without a session. Sign-in is the only public page. | all | Q11
BR-02 | Sign-in is by a 6-digit code sent to the member's address. There is no password. How long a code lasts and how many wrong tries it allows are not decided: FA-13, FA-14. | 2.1 | Q11
BR-03 | At most 5 code requests per address in 15 minutes; Resend enables after 60 seconds. | 2.1 | G5
BR-04 | A code request gets the same answer whether or not the address is a member. | 2.1 | Technical
BR-05 | A session lasts 30 days on one device. Whether it renews on use is not decided: FA-15. | 1.2, 2.1, 3.2 | Q11
BR-06 | People join only by invitation from an Admin or Owner. An invitation lasts 7 days, works once, and signs the person in without a code. | 2.2, 2.12 | G4, Q26
BR-07 | Every member is in #general; it cannot be left or archived. | 2.2, 2.9 | G1
BR-08 | With no link, the app opens the conversation last viewed on that device; the first time, #general. | 2.3 | G2
BR-09 | Permission is checked on the server for every request. Private conversations and DMs are visible to members only, including through search, file lists and direct links. | all | Technical
BR-10 | 'No access' and 'not found' are answered the same way. | 2.3, 3.3 | Technical
BR-11 | Writing to a conversation requires membership, and the conversation must not be archived. | 2.5, 2.6 | NR11
BR-12 | A message holds up to 10,000 characters and 10 files; a file up to 100 MB. | 2.5, 2.6 | G9, Q14
BR-13 | The app creates the message ID; sending the same ID again returns the stored message instead of a second one. | 2.5, 3.1 | Technical
BR-14 | A conversation is marked read only when its newest message is on screen in a focused tab. There are no 'seen' receipts. | 2.4 | G15
BR-15 | Your own action never notifies you. An Activity item becomes done on its own once the thing it asks for is done. | 2.7 | NR5
BR-16 | During Pause or Focus there is no toast, push or sound, including your own reminders; badges update; one summary follows. | 2.7, 2.11 | NR6
BR-17 | Default notification level: 'Mentions only' for channels, 'All messages' for DMs. | 2.7 | G13
BR-18 | @channel in a channel of 20 or more people asks the sender to confirm. | 2.7 | G8
BR-19 | Channel names: lowercase letters, digits, hyphens, up to 80 characters, unique. Public or private is fixed at creation. | 2.8 | G7
BR-20 | A reversible action happens at once with Undo for 5 seconds; an irreversible one asks for confirmation and names its target; never both. | 2.9, 2.10, 2.13 | NR3
BR-21 | A form with content does not close on an outside click; closing it by button asks whether to discard. | 2.8 | NR4
BR-22 | After something is created the screen shows it; a filter that would hide it changes. | 2.8 | NR10
BR-23 | A private channel cannot be rejoined alone after leaving; the person must be added again. | 2.9 | OQ2, GAP-02
BR-24 | Only the author edits a message; there is no time limit and no edit history. Deleting is permanent and removes the attached files. | 2.10 | F16, G10
BR-25 | A deleted message with replies leaves a 'Message deleted' line and keeps its thread. | 2.10 | Technical
BR-26 | Admins and Owners see and moderate only conversations they are members of. | 2.10, 2.13 | G14
BR-27 | Only an Owner changes roles. An Admin deactivates Members; only an Owner deactivates Admins and Owners. | 2.13 | F40, F41
BR-28 | Nobody deactivates themselves. The last Owner cannot be demoted or deactivated. | 2.13 | G6, F41
BR-29 | Deactivation ends every session at once; messages stay; the account can be reactivated. Nothing is deleted permanently in phase 1. | 2.13, 3.2 | F41
BR-30 | Offline: loaded content stays readable, messages wait and send themselves, every other action is blocked with an explanation. | 3.1 | NR13
BR-31 | After reconnecting the app receives every missed event in order; after more than 7 days away it reloads. | 3.1 | Technical
BR-32 | Every list has an empty state written for its context; a count on a chip equals the rows shown. | 2.4, 2.9, 2.11 | NR8
BR-33 | Toasts and banners never cover the composer or the navigation. | 3.1 | NR12
BR-34 | Every action has an entry point on narrow and touch screens; nothing is hover-only. | all | NR1
""")
RULES_VI = rows("""
BR-01 | Không có gì trong Toki đọc được khi chưa có phiên. Đăng nhập là trang công khai duy nhất. | tất cả | Q11
BR-02 | Đăng nhập bằng mã 6 số gửi tới địa chỉ của thành viên. Không có mật khẩu. Mã sống bao lâu và cho sai mấy lần thì chưa quyết định: FA-13, FA-14. | 2.1 | Q11
BR-03 | Tối đa 5 lần xin mã cho một địa chỉ trong 15 phút; Resend bật sau 60 giây. | 2.1 | G5
BR-04 | Yêu cầu xin mã nhận cùng một câu trả lời dù địa chỉ có là thành viên hay không. | 2.1 | Technical
BR-05 | Một phiên kéo dài 30 ngày trên một thiết bị. Có gia hạn khi dùng hay không thì chưa quyết định: FA-15. | 1.2, 2.1, 3.2 | Q11
BR-06 | Chỉ vào được qua lời mời của Admin hoặc Owner. Lời mời có hạn 7 ngày, dùng một lần, và đăng nhập thẳng không cần mã. | 2.2, 2.12 | G4, Q26
BR-07 | Mọi thành viên đều ở trong #general; không rời và không lưu trữ được kênh này. | 2.2, 2.9 | G1
BR-08 | Không có link thì ứng dụng mở cuộc trò chuyện xem gần nhất trên thiết bị đó; lần đầu là #general. | 2.3 | G2
BR-09 | Quyền được kiểm tra ở server cho mọi request. Cuộc trò chuyện riêng tư và DM chỉ thành viên thấy, kể cả qua tìm kiếm, danh sách file và link trực tiếp. | tất cả | Technical
BR-10 | 'Không có quyền' và 'không tồn tại' được trả lời giống nhau. | 2.3, 3.3 | Technical
BR-11 | Viết vào một cuộc trò chuyện cần là thành viên, và cuộc trò chuyện chưa bị lưu trữ. | 2.5, 2.6 | NR11
BR-12 | Một tin chứa tối đa 10.000 ký tự và 10 file; mỗi file tối đa 100 MB. | 2.5, 2.6 | G9, Q14
BR-13 | Ứng dụng tạo ID tin nhắn; gửi lại cùng ID thì trả về tin đã lưu chứ không tạo tin thứ hai. | 2.5, 3.1 | Technical
BR-14 | Chỉ đánh dấu đã đọc khi tin mới nhất nằm trên màn hình ở tab đang focus. Không có 'đã xem'. | 2.4 | G15
BR-15 | Hành động của chính mình không tạo thông báo cho mình. Mục Activity tự thành xong khi việc nó yêu cầu đã xong. | 2.7 | NR5
BR-16 | Trong Pause hoặc Focus không có toast, push hay âm thanh, kể cả nhắc việc của chính mình; huy hiệu vẫn cập nhật; sau đó có một bản tóm tắt. | 2.7, 2.11 | NR6
BR-17 | Mức thông báo mặc định: 'Mentions only' cho kênh, 'All messages' cho DM. | 2.7 | G13
BR-18 | @channel trong kênh từ 20 người trở lên hỏi người gửi xác nhận. | 2.7 | G8
BR-19 | Tên kênh: chữ thường, số, gạch nối, tối đa 80 ký tự, không trùng. Công khai hay riêng tư cố định từ lúc tạo. | 2.8 | G7
BR-20 | Hành động hoàn tác được thì xảy ra ngay kèm Undo 5 giây; không hoàn tác được thì hỏi xác nhận và nêu rõ đối tượng; không bao giờ cả hai. | 2.9, 2.10, 2.13 | NR3
BR-21 | Form đã có nội dung không đóng khi bấm ra ngoài; đóng bằng nút thì hỏi có bỏ không. | 2.8 | NR4
BR-22 | Sau khi tạo thứ gì, màn hình hiện thứ đó; bộ lọc nào che nó thì phải đổi. | 2.8 | NR10
BR-23 | Rời kênh riêng tư rồi thì không tự vào lại được; phải được thêm lại. | 2.9 | OQ2, GAP-02
BR-24 | Chỉ tác giả sửa được tin; không giới hạn thời gian và không có lịch sử sửa. Xoá là vĩnh viễn và gỡ luôn file đính kèm. | 2.10 | F16, G10
BR-25 | Tin đã xoá mà có trả lời thì để lại dòng 'Message deleted' và giữ thread. | 2.10 | Technical
BR-26 | Admin và Owner chỉ thấy và quản lý các cuộc trò chuyện mà họ là thành viên. | 2.10, 2.13 | G14
BR-27 | Chỉ Owner đổi vai trò. Admin vô hiệu hoá Member; chỉ Owner vô hiệu hoá Admin và Owner. | 2.13 | F40, F41
BR-28 | Không ai tự vô hiệu hoá mình. Owner cuối cùng không thể bị hạ vai trò hay vô hiệu hoá. | 2.13 | G6, F41
BR-29 | Vô hiệu hoá kết thúc mọi phiên ngay; tin nhắn vẫn còn; tài khoản kích hoạt lại được. Phase 1 không xoá vĩnh viễn thứ gì. | 2.13, 3.2 | F41
BR-30 | Mất mạng: nội dung đã tải vẫn đọc được, tin nhắn chờ và tự gửi, mọi hành động khác bị chặn kèm giải thích. | 3.1 | NR13
BR-31 | Kết nối lại thì ứng dụng nhận mọi event bị lỡ theo thứ tự; vắng hơn 7 ngày thì tải lại. | 3.1 | Technical
BR-32 | Mọi danh sách có trạng thái trống viết riêng cho ngữ cảnh; số trên chip bằng số hàng đang hiện. | 2.4, 2.9, 2.11 | NR8
BR-33 | Toast và banner không bao giờ che ô soạn tin hay thanh điều hướng. | 3.1 | NR12
BR-34 | Mọi hành động đều có lối vào trên màn hình hẹp và cảm ứng; không có gì chỉ dùng được bằng hover. | tất cả | NR1
""")

ASSUME_EN = rows("""
FA-01 | Endpoint names and shapes in the charts (`POST /auth/code-requests`, `GET /bootstrap`, `PUT /conversations/:id/read` and the rest) are proposals. All sit under `/api/v1`. | all | Names are fixed in the spec of each ticket
FA-02 | A request with no answer after 10 seconds counts as failed and shows Retry. | 2.3, 2.5, 3.3 | Any value between 8 and 15 s works
FA-04 | Typing a space in a channel name turns it into a hyphen, and capitals into lowercase, instead of showing an error. | 2.8 | Fewer errors for the same rule
FA-05 | The uniqueness of a channel name includes archived channels. | 2.8 | Otherwise un-archiving could collide
FA-06 | Reconnect attempts wait 1, 2, 5, 10 and then 30 seconds, with a little randomness. | 3.1 | Avoids every client retrying at once
FA-07 | A file uploaded but never sent is deleted from storage after 24 hours. | 2.6 | Keeps storage clean
FA-08 | Server status codes map to screens as in flow 3.3: 400 field message, 403 and 404 one shared page, 409 and 410 fresh copy, 429 wait, 5xx Retry with an error ID. | 3.3 | One behaviour for every feature
FA-09 | A 'Waiting to send' message survives a page reload, kept in the browser, and is dropped if someone else signs in on that browser. | 3.1, 3.2 | Needed for the 'nothing lost' promise
FA-10 | Leaving a channel clears its unread count and its open Activity items for that person. | 2.9 | Otherwise items point to a place they cannot open
FA-11 | Batches of invitations are limited to 50 addresses. | 2.12 | Protects the mail account's sending limit
FA-12 | A mention of someone who is not in the channel creates no notification; the sender is offered 'Add them'. | 2.7 | Matches rule BR-09
""")
ASSUME_VI = rows("""
FA-01 | Tên và dạng endpoint trong các sơ đồ (`POST /auth/code-requests`, `GET /bootstrap`, `PUT /conversations/:id/read` và phần còn lại) là đề xuất. Tất cả nằm dưới `/api/v1`. | tất cả | Tên được chốt trong spec của từng ticket
FA-02 | Request không có trả lời sau 10 giây được coi là lỗi và hiện Retry. | 2.3, 2.5, 3.3 | Giá trị nào từ 8 đến 15 giây cũng được
FA-04 | Gõ khoảng trắng trong tên kênh thì tự thành gạch nối, chữ hoa thành chữ thường, thay vì báo lỗi. | 2.8 | Ít lỗi hơn cho cùng một quy tắc
FA-05 | Tính không trùng của tên kênh bao gồm cả kênh đã lưu trữ. | 2.8 | Nếu không, bỏ lưu trữ có thể bị trùng tên
FA-06 | Các lần kết nối lại chờ 1, 2, 5, 10 rồi 30 giây, có thêm chút ngẫu nhiên. | 3.1 | Tránh mọi máy cùng thử lại một lúc
FA-07 | File đã tải lên nhưng không bao giờ được gửi sẽ bị xoá khỏi kho sau 24 giờ. | 2.6 | Giữ kho lưu trữ sạch
FA-08 | Mã trạng thái của server ứng với màn hình như ở flow 3.3: 400 thông báo dưới ô, 403 và 404 chung một trang, 409 và 410 hiện bản mới, 429 chờ, 5xx Retry kèm mã lỗi. | 3.3 | Một cách xử lý cho mọi tính năng
FA-09 | Tin 'Waiting to send' vẫn còn sau khi tải lại trang, được giữ trong trình duyệt, và bị bỏ nếu người khác đăng nhập trên trình duyệt đó. | 3.1, 3.2 | Cần cho lời hứa 'không mất gì'
FA-10 | Rời một kênh thì xoá số chưa đọc và các mục Activity còn mở của kênh đó với người rời. | 2.9 | Nếu không, các mục sẽ trỏ tới nơi họ không mở được
FA-11 | Một lô lời mời giới hạn 50 địa chỉ. | 2.12 | Bảo vệ giới hạn gửi của tài khoản mail
FA-12 | Mention một người không ở trong kênh thì không tạo thông báo; người gửi được đề nghị 'Add them'. | 2.7 | Khớp với quy tắc BR-09
""")

OPEN_EN = rows("""
FQ-01 | Someone is signed in as A and presses an invitation or sign-in link meant for B. Does the link replace A's session, or does the page ask first? | 2.1, 2.2 | Ask first: 'You are signed in as A. Continue as B?' | Sign-in tickets
FQ-02 | Sign out in one tab: do the other tabs of the same browser leave at once? | 1.2, 3.2 | Yes, at once; they share the session | Sign-in tickets
FQ-03 | An Admin invites the address of a deactivated member. Refuse, or offer Reactivate? | 2.12 | Refuse with 'This account is deactivated' and a Reactivate button | Admin tickets
FQ-04 | Are any file types refused (for example programs), or is every type accepted up to 100 MB? | 2.6 | Accept every type; always download, never run in the browser | File tickets
FQ-05 | A message is deleted while someone else is writing a reply in its thread. Is the reply still sent? | 2.10 | Yes; the thread stays under the 'Message deleted' line | Thread tickets
FQ-06 | 'Today 15:00' in the reminder menu after 15:00: hidden, or replaced by another choice? | 2.11 | Hidden; 'In 3 hours' takes its place | Later tickets
FQ-07 | How long does a 'Waiting to send' message keep trying before it becomes 'Not sent'? | 2.5, 3.1 | It waits while offline; once online, one automatic try, then 'Not sent' with Retry | Messaging tickets
FQ-08 | Can a member change their own sign-in address, or only an Admin? | 2.1 | Nobody in phase 1; an Owner does it later | Admin tickets
FQ-09 | Two people create a channel with the same name at the same moment. | 2.8 | The second gets '#name already exists' with a button to open it (already in the chart; confirm) | Channel tickets
FQ-10 | Does previewing a public channel without joining count for its unread or Activity? | 2.4 | No; a preview leaves no trace | Channel tickets
FQ-11 | A batch of invitations fails halfway (the mail server goes down after 3 of 10). Keep the 3, or undo all? | 2.12 | Keep them; each row reports its own result | Admin tickets
FQ-12 | Should the first load have a size limit for very large workspaces (how many conversations come with `GET /bootstrap`)? | 2.3 | All of them in phase 1; revisit past 500 conversations | Technical
""")
OPEN_VI = rows("""
FQ-01 | Đang đăng nhập là A và bấm link mời hoặc link đăng nhập dành cho B. Link thay phiên của A luôn, hay trang hỏi trước? | 2.1, 2.2 | Hỏi trước: 'Bạn đang đăng nhập là A. Tiếp tục với B?' | Ticket đăng nhập
FQ-02 | Sign out ở một tab: các tab khác của cùng trình duyệt có thoát ngay không? | 1.2, 3.2 | Có, ngay lập tức; chúng dùng chung phiên | Ticket đăng nhập
FQ-03 | Admin mời địa chỉ của một thành viên đã bị vô hiệu hoá. Từ chối, hay đề nghị Reactivate? | 2.12 | Từ chối với 'This account is deactivated' kèm nút Reactivate | Ticket admin
FQ-04 | Có loại file nào bị từ chối không (ví dụ chương trình), hay nhận mọi loại tới 100 MB? | 2.6 | Nhận mọi loại; luôn tải về, không bao giờ chạy trong trình duyệt | Ticket file
FQ-05 | Một tin bị xoá trong lúc người khác đang viết trả lời trong thread của nó. Trả lời đó có được gửi không? | 2.10 | Có; thread vẫn nằm dưới dòng 'Message deleted' | Ticket thread
FQ-06 | 'Today 15:00' trong menu nhắc việc khi đã quá 15:00: ẩn đi, hay thay bằng lựa chọn khác? | 2.11 | Ẩn; 'In 3 hours' thế chỗ | Ticket Later
FQ-07 | Tin 'Waiting to send' thử bao lâu rồi mới thành 'Not sent'? | 2.5, 3.1 | Chờ khi mất mạng; có mạng lại thì tự thử một lần, rồi 'Not sent' kèm Retry | Ticket nhắn tin
FQ-08 | Thành viên có tự đổi được địa chỉ đăng nhập không, hay chỉ Admin? | 2.1 | Phase 1 không ai đổi; về sau do Owner làm | Ticket admin
FQ-09 | Hai người tạo kênh trùng tên cùng một lúc. | 2.8 | Người thứ hai nhận '#name already exists' kèm nút mở kênh (đã có trong sơ đồ; cần xác nhận) | Ticket kênh
FQ-10 | Xem trước một kênh công khai mà không tham gia có tính vào chưa đọc hay Activity không? | 2.4 | Không; xem trước không để lại dấu vết | Ticket kênh
FQ-11 | Một lô lời mời lỗi giữa chừng (máy chủ mail hỏng sau 3 trên 10). Giữ 3 cái đã xong, hay huỷ hết? | 2.12 | Giữ; mỗi hàng báo kết quả riêng | Ticket admin
FQ-12 | Lần tải đầu có cần giới hạn cho workspace rất lớn không (`GET /bootstrap` trả bao nhiêu cuộc trò chuyện)? | 2.3 | Phase 1 trả hết; xem lại khi quá 500 cuộc trò chuyện | Technical
""")


def both(en, vi):
    assert len(en) == len(vi), (len(en), len(vi))
    return [[f"{a}||{b}" if a != b else a for a, b in zip(r1, r2)] for r1, r2 in zip(en, vi)]


# Added in the review of 13 Nov 2026. Each cell is "English||Tiếng Việt".
NEW_RULES = [
    ["BR-35", "A display name is 1 to 80 characters.||Tên hiển thị dài từ 1 tới 80 ký tự.", "2.2", "Q31 (your answer, 13 Nov 2026)||Q31 (bạn trả lời, 13/11/2026)"],
    ["BR-36", "A group DM holds at most 8 people, counting its creator. Nobody is added or removed afterwards.||Một group DM tối đa 8 người, tính cả người tạo. Về sau không thêm hay bớt người.", "2.14", "Q17, G12"],
    ["BR-37", "Every Member, Admin and Owner may create public and private channels and start DMs and groups. Guests may not.||Mọi Member, Admin và Owner đều tạo được kênh công khai, kênh riêng tư, DM và nhóm. Guest thì không.", "2.8, 2.14", "Q12 (capability table)||Q12 (bảng quyền)"],
    ["BR-38", "Only an Admin or Owner removes someone from a channel, and only in a channel they belong to themselves.||Chỉ Admin hoặc Owner gỡ được người khỏi kênh, và chỉ trong kênh mà chính họ là thành viên.", "2.9", "G14, Q12"],
]
NEW_ASSUME = [
    ["FA-13", "A member's sign-in code is valid for 10 minutes.||Mã đăng nhập của thành viên có hiệu lực 10 phút.", "2.1", "The prototype's guest code screen says 'It works for 10 minutes'; nothing decides it for members||Màn hình nhập mã của guest trong prototype ghi 'It works for 10 minutes'; chưa có gì quyết định cho thành viên"],
    ["FA-14", "A code is cancelled after 5 wrong tries; the person asks for a new one.||Mã bị huỷ sau 5 lần sai; người dùng phải xin mã mới.", "2.1", "A 6-digit code must not be guessable; the prototype accepts any 6 digits||Mã 6 số không được để đoán mò; prototype nhận 6 số bất kỳ"],
    ["FA-15", "A session renews on every use, so 30 days means 30 days without opening Toki.||Phiên được gia hạn mỗi lần dùng, nên 30 ngày nghĩa là 30 ngày không mở Toki.", "1.1, 1.2, 3.2", "Q11 fixes 30 days but not whether it counts from sign-in or from last use||Q11 chốt 30 ngày nhưng chưa nói tính từ lúc đăng nhập hay từ lần dùng cuối"],
    ["FA-16", "Every screen and every wording in quotes that the prototype does not contain is a proposal: 'Session ended', 'Account deactivated', 'Not found or no access', 'Not sent', 'Can't reach Toki', loading placeholders, and the rest.||Mọi màn hình và mọi câu chữ trong dấu nháy mà prototype không có đều là đề xuất: 'Session ended', 'Account deactivated', 'Not found or no access', 'Not sent', 'Can't reach Toki', ô giữ chỗ khi tải, và phần còn lại.", "all||tất cả", "The charts need a name for each state; the design decides the final words||Sơ đồ cần một cái tên cho từng trạng thái; thiết kế sẽ quyết định câu chữ cuối cùng"],
    ["FA-17", "While offline the banner keeps the prototype's words, 'Offline: showing saved messages'. A separate 'Reconnecting…' state is not assumed.||Khi mất mạng, banner giữ câu chữ của prototype, 'Offline: showing saved messages'. Không giả định có trạng thái 'Reconnecting…' riêng.", "3.1", "The prototype shows only this banner; see FQ-22||Prototype chỉ có banner này; xem FQ-22"],
]
NEW_OPEN = [
    ["FQ-13", "What does the invitation refusal page say, and does it tell the causes apart?||Trang từ chối lời mời ghi gì, và có phân biệt từng nguyên nhân không?", "1.1, 2.2",
     "Three messages. **Expired:** 'This invitation expired on 12 Nov. Ask Minh to send a new one.' **Revoked:** 'This invitation is no longer valid. Ask an admin of Hugepig Studio for a new one.' **Unknown or damaged link:** 'This link is not valid.', with no workspace name. An invitation already used goes to the sign-in page with the email filled in. No page has a sign-in button for a stranger.||Ba câu. **Hết hạn:** 'This invitation expired on 12 Nov. Ask Minh to send a new one.' **Bị thu hồi:** 'This invitation is no longer valid. Ask an admin of Hugepig Studio for a new one.' **Link lạ hoặc hỏng:** 'This link is not valid.', không nêu tên workspace. Lời mời đã dùng rồi thì tới trang đăng nhập với email điền sẵn. Không trang nào có nút đăng nhập cho người lạ.", "Sign-in tickets||Ticket đăng nhập"],
    ["FQ-14", "The prototype's code screen has no Resend, only 'Use a different email'. G5 already expects a Resend button after 60 seconds. Is Resend added to the screen, and does a new code cancel the earlier one?||Màn hình nhập mã của prototype không có Resend, chỉ có 'Use a different email'. G5 đã mặc định có nút Resend sau 60 giây. Có thêm Resend vào màn hình không, và mã mới có huỷ mã cũ không?", "1.1, 2.1",
     "Yes: 'Resend code' under the field, greyed with a countdown for 60 seconds. A new code cancels the earlier one, so only the newest mail works.||Có: 'Resend code' dưới ô nhập, xám kèm đếm ngược 60 giây. Mã mới huỷ mã cũ, nên chỉ mail mới nhất dùng được.", "Sign-in tickets||Ticket đăng nhập"],
    ["FQ-15", "The welcome step after accepting an invitation is not in the prototype. Is it wanted, and with which fields?||Màn hình chào sau khi nhận lời mời không có trong prototype. Có cần nó không, và gồm những ô nào?", "1.1, 2.2",
     "One screen: display name (required, 1 to 80, filled from the address), job title (optional), time zone (from the device). 'Enter Toki' and 'Skip'.||Một màn hình: tên hiển thị (bắt buộc, 1 tới 80, điền sẵn từ địa chỉ), chức danh (không bắt buộc), múi giờ (lấy từ thiết bị). 'Enter Toki' và 'Skip'.", "Sign-in tickets||Ticket đăng nhập"],
    ["FQ-16", "#general exists before anyone is invited and every newcomer is in it (G1). Does #general show a line when someone joins, and does that line notify anyone?||#general có sẵn trước khi mời ai và người mới nào cũng ở trong đó (G1). #general có hiện một dòng khi có người vào không, và dòng đó có báo cho ai không?", "2.2, 2.9",
     "Yes: a grey system line 'Minh joined', with the date. It raises no unread count and no notification. The prototype has no system lines; its sample shows a person writing 'Welcome Jordan to the team!'.||Có: một dòng hệ thống màu xám 'Minh joined', kèm ngày. Không làm tăng số chưa đọc và không tạo thông báo. Prototype không có dòng hệ thống; dữ liệu mẫu chỉ có một người viết 'Welcome Jordan to the team!'.", "Channel tickets||Ticket kênh"],
    ["FQ-17", "**Your finding:** the prototype has no '+' for a new channel, only '+ Browse channels', and Browse channels has nothing to create one. Where does 'Create channel' live?||**Bạn phát hiện:** prototype không có '+' để tạo kênh, chỉ có '+ Browse channels', và trong Browse channels không có chỗ nào để tạo. 'Create channel' nằm ở đâu?", "2.8",
     "(a) A 'Create channel' button at the top of Browse channels, a 'Create channel' command in Ctrl+K, and 'Create #text' when a search finds nothing · (b) A separate '+' beside the Conversations heading. Suggested: (a), as written flow F20 says.||(a) Nút 'Create channel' ở đầu Browse channels, lệnh 'Create channel' trong Ctrl+K, và 'Create #text' khi tìm không ra · (b) Một nút '+' riêng cạnh tiêu đề Conversations. Đề xuất: (a), đúng như flow viết F20.", "Channel tickets||Ticket kênh"],
    ["FQ-18", "Which fields does the Create channel dialog have, and what are their limits?||Hộp thoại Create channel có những ô nào, và giới hạn của chúng?", "2.8",
     "Name (rule G7), Private switch (off by default), Topic (optional, up to 250 characters), Add people (optional). Written flow F20 has 'add members'; the chart leaves it out until you confirm.||Tên (quy tắc G7), công tắc Private (mặc định tắt), Topic (không bắt buộc, tối đa 250 ký tự), Add people (không bắt buộc). Flow viết F20 có 'add members'; sơ đồ chưa vẽ cho tới khi bạn xác nhận.", "Channel tickets||Ticket kênh"],
    ["FQ-19", "Can an Owner or Admin remove a member from any channel? Decided so far (G14): no, only from a channel they belong to, and never from #general. Does that stand, and can the creator of a channel remove people too?||Owner hoặc Admin có gỡ được thành viên khỏi một kênh bất kỳ không? Hiện đã quyết định (G14): không, chỉ trong kênh họ là thành viên, và không bao giờ khỏi #general. Giữ như vậy chứ, và người tạo kênh có được gỡ người không?", "2.9",
     "Keep G14. The creator has no extra right. The removed person gets an Activity item 'Lan removed you from #name'; the channel shows 'Lan removed Minh'. This flow has no chart yet.||Giữ G14. Người tạo kênh không có quyền gì thêm. Người bị gỡ nhận một mục Activity 'Lan removed you from #name'; kênh hiện 'Lan removed Minh'. Flow này chưa có sơ đồ.", "Channel tickets||Ticket kênh"],
    ["FQ-20", "How does a person choose several people for a group DM? The prototype's New message dialog opens a conversation on the first press.||Người dùng chọn nhiều người cho một group DM bằng cách nào? Hộp thoại New message của prototype mở cuộc trò chuyện ngay ở lần bấm đầu.", "2.14",
     "Each press adds the person as a chip in the field; a 'Start' button opens the conversation. One chip plus Enter opens the DM. Channels in the list still open at once. Limit stays 8 with you (Q17).||Mỗi lần bấm thêm người đó thành một chip trong ô; nút 'Start' mở cuộc trò chuyện. Một chip rồi Enter thì mở DM. Kênh trong danh sách vẫn mở ngay. Giới hạn vẫn là 8 tính cả bạn (Q17).", "Messaging tickets||Ticket nhắn tin"],
    ["FQ-21", "The prototype shows 'Waiting to send' and nothing for a send that failed. Where do 'Not sent', Retry and Delete appear?||Prototype có 'Waiting to send' và không có gì cho trường hợp gửi lỗi. 'Not sent', Retry và Delete hiện ở đâu?", "2.5",
     "In the same place as 'Waiting to send', beside the time: a red 'Not sent' followed by two text buttons, Retry and Delete. The message stays faded. Delete asks nothing, since nobody else has seen it.||Ở đúng chỗ của 'Waiting to send', cạnh giờ: chữ đỏ 'Not sent' rồi hai nút chữ, Retry và Delete. Tin vẫn mờ. Delete không hỏi lại, vì chưa ai khác thấy tin đó.", "Messaging tickets||Ticket nhắn tin"],
    ["FQ-22", "The prototype's offline banner reads 'Offline: showing saved messages'. Written flow F37 said 'Reconnecting…' and a 'Reconnected' toast, which the prototype does not have. Which wording, and is there a separate reconnecting state?||Banner offline của prototype ghi 'Offline: showing saved messages'. Flow viết F37 ghi 'Reconnecting…' và toast 'Reconnected', những thứ prototype không có. Dùng câu chữ nào, và có trạng thái đang kết nối lại riêng không?", "3.1",
     "(a) Keep the prototype's banner the whole time; it disappears when the connection is back, with no toast · (b) Same banner, plus the words 'Reconnecting…' during each try · (c) Replace it by 'Reconnecting…'. Suggested: (a). Until answered the charts use (a) (FA-17).||(a) Giữ banner của prototype suốt thời gian đó; nó biến mất khi có lại kết nối, không có toast · (b) Cùng banner, thêm chữ 'Reconnecting…' trong mỗi lần thử · (c) Thay bằng 'Reconnecting…'. Đề xuất: (a). Cho tới khi có trả lời, sơ đồ dùng (a) (FA-17).", "Messaging tickets||Ticket nhắn tin"],
]
EVIDENCE = [
    ["Invitation valid 7 days, one use||Lời mời hiệu lực 7 ngày, dùng một lần", "G4", "No member invitation. 'It works for 10 minutes' is on the guest code screen and is about the code||Không có lời mời cho thành viên. 'It works for 10 minutes' ở màn hình nhập mã của guest và nói về mã"],
    ["6-digit code, no password, session of 30 days||Mã 6 số, không mật khẩu, phiên 30 ngày", "Q11", "Guest portal only; no sessions||Chỉ ở cổng guest; không có phiên"],
    ["Code valid 10 minutes; cancelled after 5 wrong tries||Mã hiệu lực 10 phút; huỷ sau 5 lần sai", "FA-13 FA-14", "'It works for 10 minutes' (guest); any 6 digits pass||'It works for 10 minutes' (guest); 6 số nào cũng qua"],
    ["5 code requests in 15 minutes; Resend after 60 s||5 lần xin mã trong 15 phút; Resend sau 60 giây", "G5", "No Resend button (FQ-14)||Không có nút Resend (FQ-14)"],
    ["Display name 1 to 80 characters||Tên hiển thị 1 tới 80 ký tự", "Q31", "No field for a name||Không có ô nhập tên"],
    ["#general exists from set-up; everyone is in it||#general có từ lúc thiết lập; ai cũng ở trong đó", "G1", "#general is in the sample data||#general có trong dữ liệu mẫu"],
    ["10,000 characters and 10 files per message||10.000 ký tự và 10 file mỗi tin", "G9", "No limit, no counter; attach is faked||Không giới hạn, không bộ đếm; đính kèm là giả lập"],
    ["100 MB per file||100 MB mỗi file", "Q14", "The number does not appear||Con số không xuất hiện"],
    ["Channel name: a–z, 0–9, hyphens, up to 80, unique||Tên kênh: a–z, 0–9, gạch nối, tối đa 80, không trùng", "G7", "Channels cannot be created||Không tạo được kênh"],
    ["Group DM up to 8 people; no adding or removing||Group DM tối đa 8 người; không thêm bớt", "Q17 G12", "One sample group; groups cannot be started||Một nhóm mẫu; không tạo được nhóm"],
    ["Admins and Owners act only in conversations they belong to||Admin và Owner chỉ thao tác trong cuộc trò chuyện họ là thành viên", "G14", "Seen only as an Owner who is in every channel||Chỉ được xem với vai trò Owner có mặt ở mọi kênh"],
    ["Who may do what (create, invite, deactivate, change roles)||Ai được làm gì (tạo, mời, vô hiệu hoá, đổi vai trò)", "Q12", "No difference between roles is shown||Không thể hiện khác biệt giữa các vai trò"],
    ["Offline: read, messages wait, the rest blocked||Offline: đọc được, tin nhắn chờ, còn lại bị chặn", "NR13", "Banner and 'Waiting to send' exist; nothing is blocked||Có banner và 'Waiting to send'; không có gì bị chặn"],
    ["Request fails after 10 s; one screen per kind of refusal||Request lỗi sau 10 giây; mỗi loại từ chối một màn hình", "FA-02 FA-08", "No errors at all||Không có lỗi nào"],
]
MISSING = [
    ["Member sign-in: email step and code step||Đăng nhập thành viên: bước email và bước nhập mã", "1.1, 2.1", "Guest version only; no Resend||Chỉ có bản cho guest; không có Resend", "N-01, N-30"],
    ["Invitation refusal page||Trang từ chối lời mời", "1.1, 2.2", "Absent||Không có", "N-29 · FQ-13"],
    ["Welcome step (name, job title, time zone)||Màn hình chào (tên, chức danh, múi giờ)", "1.1, 2.2", "Absent||Không có", "N-29 · FQ-15"],
    ["Sign out in the account menu; signed-in devices||Sign out trong menu tài khoản; danh sách thiết bị", "1.2", "Absent||Không có", "N-04"],
    ["'Session ended' and 'Account deactivated' pages||Trang 'Session ended' và 'Account deactivated'", "1.2, 2.1, 2.3, 3.2", "Absent||Không có", "N-01"],
    ["'Not found or no access' page||Trang 'Not found or no access'", "2.3, 2.4, 3.3", "Absent||Không có", "N-06"],
    ["Loading placeholders for lists and messages||Ô giữ chỗ khi tải danh sách và tin nhắn", "2.3, 2.4, 2.9, 2.12", "Absent||Không có", "N-05"],
    ["'Not sent' with Retry and Delete on a message||'Not sent' kèm Retry và Delete trên tin nhắn", "2.5", "'Waiting to send' only||Chỉ có 'Waiting to send'", "N-06 · FQ-21"],
    ["File picker, upload cards, progress, refusal, Retry||Chọn file, thẻ tải lên, tiến độ, từ chối, Retry", "2.6", "Faked: one press adds a sample file||Giả lập: bấm một lần là có file mẫu", "N-07"],
    ["Create channel: entry point and dialog||Tạo kênh: lối vào và hộp thoại", "2.8", "Absent||Không có", "N-03 · FQ-17, FQ-18"],
    ["Add people to a channel; remove a member||Thêm người vào kênh; gỡ một thành viên", "2.9", "Absent||Không có", "N-03, N-32 · FQ-19"],
    ["Choosing several people for a group DM||Chọn nhiều người cho một group DM", "2.14", "One person only||Chỉ chọn được một người", "N-31 · FQ-20"],
    ["Admin: members table, invite, Resend, Revoke||Admin: bảng thành viên, mời, Resend, Revoke", "2.12", "Absent||Không có", "N-02"],
    ["Admin: change role, deactivate, reactivate||Admin: đổi vai trò, vô hiệu hoá, kích hoạt lại", "2.13", "Absent||Không có", "N-02"],
    ["Reconnecting state; blocked action while offline||Trạng thái đang kết nối lại; chặn thao tác khi offline", "3.1", "Offline banner only; nothing blocked||Chỉ có banner offline; không chặn gì", "GAP-21 · FQ-22"],
    ["Error with Retry; message under a form field||Lỗi kèm Retry; thông báo dưới ô nhập", "3.3", "Absent; forms use toasts||Không có; form dùng toast", "N-06, N-08 · GQ-03"],
]

# ───────────────────────── The question and the answer behind every condition ─────────────────────────
# A reader should see why a step exists without looking an id up: each source is written out as the
# question that was asked and the answer that was chosen. Texts come from the blueprint files.
BP = {l: json.loads(pathlib.Path(__file__).with_name(f"blueprint.{l}.json").read_text(encoding="utf-8")) for l in ("en", "vi")}
G_QUESTION = {
    "G1": "Which channel does everyone start in, and can it be left?||Mọi người bắt đầu ở kênh nào, và có rời kênh đó được không?",
    "G2": "Which conversation does the app open on?||Ứng dụng mở vào cuộc trò chuyện nào?",
    "G4": "How long does an invitation last, and does its link need a sign-in code?||Lời mời có hạn bao lâu, và link trong đó có cần mã đăng nhập không?",
    "G5": "How often may a sign-in code be requested, and when can it be sent again?||Được xin mã đăng nhập bao nhiêu lần, và khi nào gửi lại được?",
    "G6": "Can there be several Owners, and what protects the last one?||Có thể có nhiều Owner không, và Owner cuối cùng được bảo vệ thế nào?",
    "G7": "What may a channel name contain, and can a channel switch between public and private?||Tên kênh gồm những gì, và kênh có đổi qua lại giữa công khai và riêng tư được không?",
    "G8": "Who may edit a channel's topic and use @channel?||Ai được sửa chủ đề kênh và dùng @channel?",
    "G9": "How long may a message be, and how many files may it carry?||Một tin nhắn dài tối đa bao nhiêu, và kèm được bao nhiêu file?",
    "G10": "What happens to the files of a deleted message?||File của tin nhắn bị xoá thì ra sao?",
    "G11": "What does a push notification show?||Thông báo push hiện những gì?",
    "G12": "Can people be added to or removed from a group DM?||Có thêm hay bớt người trong group DM được không?",
    "G13": "What is the default notification level?||Mức thông báo mặc định là gì?",
    "G14": "Do Admins and Owners see and manage every conversation?||Admin và Owner có thấy và quản lý mọi cuộc trò chuyện không?",
    "G15": "Does a sender see who has read a message?||Người gửi có biết ai đã đọc tin không?",
    "G16": "What is shown when an admin deletes someone's message?||Khi admin xoá tin của người khác thì hiện gì?",
}
TECH = {
    "T1": "A code request is answered the same way for members and strangers, so the page never reveals who is a member.||Yêu cầu xin mã được trả lời như nhau với thành viên và người lạ, nên trang không bao giờ lộ ai là thành viên.",
    "T2": "'Not found' and 'no access' get the same answer, so the app never confirms that a private thing exists.||'Không tồn tại' và 'không có quyền' nhận cùng một câu trả lời, nên ứng dụng không bao giờ xác nhận một thứ riêng tư có tồn tại.",
    "T3": "The app creates the message ID, so sending the same message again cannot create a second one.||Ứng dụng tự tạo ID tin nhắn, nên gửi lại cùng một tin không thể tạo ra tin thứ hai.",
    "T4": "Every change is a numbered event. After reconnecting, the app asks for everything after the last number it saw; after more than 7 days away it reloads.||Mọi thay đổi là một event có đánh số. Khi kết nối lại, ứng dụng xin mọi thứ sau số cuối cùng nó đã thấy; vắng hơn 7 ngày thì tải lại toàn bộ.",
    "T5": "The server checks the session on every request and closes the live connection the moment a session ends.||Server kiểm tra phiên ở mọi request và đóng kết nối trực tiếp ngay khi phiên kết thúc.",
}
CITE = {
    "1.1": "G4 Q11 Q12 FA-13 FA-15 F03 FQ-13 FQ-15",
    "1.2": "Q11 Q12 NR13 F06 F41 FA-16",
    "2.1": "Q11 G5 T1 FA-13 FA-14 FQ-14",
    "2.2": "Q11 Q26 G4 G1 Q31 F03 FQ-13 FQ-15 FQ-16",
    "2.3": "G2 Q11 T2 FA-02 FA-16 GQ-06",
    "2.4": "OQ3 G15 Q27 NR8 FA-16 FQ-10",
    "2.5": "G9 NR11 NR13 T3 F11 FA-02 FQ-07 FQ-21",
    "2.6": "G9 Q14 NR11 F18 FA-07 FQ-04",
    "2.7": "Q16 NR5 NR6 G13 G8 G11 FA-12 GQ-01",
    "2.8": "Q12 G7 NR4 NR10 F20 FA-04 FA-05 FQ-17 FQ-18 GQ-20",
    "2.9": "G1 NR3 OQ2 Q27 G14 FA-10 FQ-19",
    "2.10": "Q13 G10 G14 G16 NR3 FQ-05",
    "2.11": "Q2 NR7 NR6 NR8 FQ-06",
    "2.12": "Q11 Q26 Q12 G4 F02 FA-11 FQ-03 FQ-11",
    "2.13": "Q12 G6 NR3 F40 F41 GQ-20",
    "2.14": "Q17 G12 Q12 F25 FQ-20",
    "3.1": "NR13 NR12 T4 F37 FA-06 FA-09 FA-17 FQ-22",
    "3.2": "Q11 Q12 T5 F06 F07 F41 FA-09 FA-16 FQ-02",
    "3.3": "NR4 FA-02 FA-08 FA-16 GQ-03 GQ-18",
}


def _by(lang, key):
    return {x["id"]: x for x in BP[lang][key]}


def _gq(lang):
    out = {}
    for sec in BP[lang].get("analysis", {}).get("sections", []):
        for blk in sec.get("blocks", []):
            for r in blk.get("rows", []) if blk.get("type") == "table" else []:
                if str(r[0]).startswith("GQ-"):
                    out[r[0]] = r[1]
    return out


def _half(text, lang):
    return text.split("||")[0 if lang == "en" else 1] if "||" in text else text


def qa(sid, lang):
    """(kind, question, answer) for one source id in one language. kind: decided, rule, proposal, open."""
    local = {r[0]: r for r in both(ASSUME_EN, ASSUME_VI) + NEW_ASSUME + both(OPEN_EN, OPEN_VI) + NEW_OPEN}
    if sid in TECH:
        return "rule", "", _half(TECH[sid], lang)
    if sid.startswith("FA-"):
        return "proposal", "", _half(local[sid][1], lang)
    if sid.startswith("FQ-"):
        return "open", _half(local[sid][1], lang), ""
    if sid.startswith("GQ-"):
        return "open", _gq(lang)[sid], ""
    if sid.startswith("NR"):
        r = _by(lang, "rules")[sid]
        return "rule", r["from"], r["text"]
    if sid.startswith("OQ"):
        q = _by(lang, "questions")[sid]
        return "decided", q["question"], q["answer"]
    if sid.startswith("G"):
        return "decided", _half(G_QUESTION[sid], lang), _by(lang, "assumptions")[sid]["text"]
    if sid.startswith("Q"):
        d = _by(lang, "decisions")[sid]
        return "decided", d["question"], d["decision"]
    return "proposal", "", ("Written flow: " if lang == "en" else "Flow viết: ") + _by(lang, "flows")[sid]["title"]


def cite_note(sid):
    out = []
    for lang in ("en", "vi"):
        en = lang == "en"
        kind, q, a = qa(sid, lang)
        if sid in TECH:
            t = f"**{'Technical design' if en else 'Thiết kế kỹ thuật'}:** {a}"
        elif kind == "decided":
            if sid.startswith("OQ"):
                lab = "Answer" if en else "Trả lời"
            elif sid.startswith("G"):
                lab = "You confirmed" if en else "Bạn đã xác nhận"
            elif _by(lang, "decisions")[sid].get("source") == "user":
                lab = "Your answer" if en else "Bạn trả lời"
            else:
                lab = "You chose the recommended option" if en else "Bạn chọn phương án được đề xuất"
            t = f"**{'Question' if en else 'Câu hỏi'} ({sid}):** {q} **{lab}:** {a}"
        elif kind == "rule":
            t = f"**{'Rule' if en else 'Quy tắc'} {sid}** ({'made from' if en else 'rút ra từ'} {q}): {a}"
        elif kind == "open":
            t = f"**{'Still open' if en else 'Còn mở'} ({sid}):** {q}"
        elif sid.startswith("FA-"):
            t = f"**{'Assumed, not confirmed' if en else 'Giả định, chưa xác nhận'} ({sid}):** {a}"
        else:
            t = f"**{'Proposal, not confirmed' if en else 'Đề xuất, chưa xác nhận'} ({sid}):** {a}"
        out.append(t)
    return "||".join(out)


for ch in [h1, h2] + D + E:
    num = ch.m["title"].split(" ")[0]
    pe, pv = SRC[num].split("||")
    ch.m["notes"] += [f"**In the prototype:** {pe}||**Trong prototype:** {pv}",
                      "**Why the chart is drawn this way.** Each line below is a question that was asked and the answer chosen, then what is still assumed or open.||**Vì sao sơ đồ được vẽ như vậy.** Mỗi dòng dưới đây là một câu hỏi đã được hỏi và câu trả lời đã chọn, sau đó là những gì còn giả định hoặc còn mở."]
    ch.m["notes"] += [cite_note(sid) for sid in CITE[num].split()]


def evidence_rows():
    rows_ = []
    for cond, ids, proto in EVIDENCE:
        qs, ans = [[], []], [[], []]
        for sid in ids.split():
            for i, lang in enumerate(("en", "vi")):
                kind, q, a = qa(sid, lang)
                if kind == "decided":
                    qs[i].append(f"{q} ({sid})"); ans[i].append(a)
                elif kind == "rule":
                    qs[i].append(("Rule " if i == 0 else "Quy tắc ") + f"{sid}, " + ("made from " if i == 0 else "rút ra từ ") + q); ans[i].append(a)
                else:
                    qs[i].append(("Not asked yet" if i == 0 else "Chưa được hỏi") + f" ({sid})")
                    ans[i].append(("**Not confirmed.** Assumed: " if i == 0 else "**Chưa xác nhận.** Đang giả định: ") + a)
        rows_.append([cond, "||".join(" · ".join(x) for x in qs), "||".join(" ".join(x) for x in ans), proto])
    return rows_


all_maps = [h1.m, h2.m] + [c.m for c in D + E]
n_nodes = sum(len(m["nodes"]) for m in all_maps)
n_dec = sum(1 for m in all_maps for n in m["nodes"] if n["kind"] == "decision")

spec = {"groups": [
    {"title": "How to read these flows||Cách đọc các flow này",
     "intro": f"{len(all_maps)} charts cover phase 1: 2 high-level, {len(D)} detailed, {len(E)} for errors and edge cases. Detailed charts have three lanes: what the **user** does, what the **frontend** shows, and what the **backend** does, including the API request. The flows by role further down remain the written, step-by-step reference.||{len(all_maps)} sơ đồ phủ phase 1: 2 sơ đồ tổng quan, {len(D)} sơ đồ chi tiết, {len(E)} sơ đồ cho lỗi và trường hợp biên. Sơ đồ chi tiết có ba làn: **người dùng** làm gì, **frontend** hiện gì, và **backend** làm gì, kể cả request API. Các flow theo vai trò ở phía dưới vẫn là tài liệu viết từng bước.",
     "blocks": [
         {"type": "table", "head": ["Shape||Hình", "Meaning||Ý nghĩa"], "rows": [
             ["Pill, thick outline||Ô bo tròn, viền đậm", "Start: an entry point||Bắt đầu: một lối vào"],
             ["Pill, filled||Ô bo tròn, tô màu", "End: where the flow finishes well||Kết thúc: nơi flow hoàn tất"],
             ["Rectangle||Hình chữ nhật", "A step: something done, shown or stored||Một bước: việc được làm, hiển thị hoặc lưu"],
             ["Diamond||Hình thoi", "A decision; every answer has its own arrow||Một quyết định; mỗi câu trả lời có mũi tên riêng"],
             ["Dashed rectangle||Hình chữ nhật nét đứt", "A screen state: loading, empty, disabled, waiting||Một trạng thái màn hình: đang tải, trống, bị tắt, đang chờ"],
             ["Red outline||Viền đỏ", "An error or a refusal, with what the person can do next||Một lỗi hoặc lần từ chối, kèm việc người dùng làm tiếp được"],
             ["Arrow down the side||Mũi tên chạy dọc bên cạnh", "Going back: retry, correct, pick again||Quay lại: thử lại, sửa, chọn lại"]]},
         {"type": "note", "text": f"**Checked by script on every build:** {n_nodes} steps and {n_dec} decisions; every decision has at least two answers drawn, every step is reachable from a start, and no step stops without being an end or a refusal page that says so.||**Được script kiểm tra ở mỗi lần build:** {n_nodes} bước và {n_dec} quyết định; mọi quyết định đều có ít nhất hai câu trả lời được vẽ, mọi bước đều tới được từ một điểm bắt đầu, và không bước nào dừng lại mà không phải là điểm kết thúc hoặc trang từ chối có ghi rõ."}]},
    {"title": "1 · High-level user flow||1 · User flow tổng quan",
     "intro": "Every way in, the one gate they share, what a signed-in person can reach, and every way out.||Mọi lối vào, cửa kiểm tra chung, những gì người đã đăng nhập tới được, và mọi lối ra.",
     "maps": [h1.m, h2.m]},
    {"title": "2 · Detailed flows by feature||2 · Flow chi tiết theo tính năng",
     "intro": "Read each chart top to bottom. Under each: what must be true before, what is true after, the validation rules, and what Back, Cancel and Retry do.||Đọc mỗi sơ đồ từ trên xuống. Bên dưới mỗi sơ đồ: điều kiện trước, kết quả sau, quy tắc kiểm tra, và Back, Cancel, Retry làm gì.",
     "maps": [c.m for c in D]},
    {"title": "3 · Error and edge-case flows||3 · Flow lỗi và trường hợp biên",
     "intro": "Three behaviours shared by every feature, drawn once so each feature does not reinvent them.||Ba cách xử lý dùng chung cho mọi tính năng, vẽ một lần để từng tính năng không phải tự nghĩ lại.",
     "maps": [c.m for c in E]},
    {"title": "4 · Business rules and assumptions||4 · Quy tắc nghiệp vụ và giả định",
     "intro": "The rules the charts depend on, each with the flows that use it and where it was decided. Then the assumptions made while drawing: these are **not confirmed** and need a yes or a correction.||Các quy tắc mà sơ đồ dựa vào, kèm flow dùng nó và nơi nó được quyết định. Sau đó là các giả định đặt ra khi vẽ: chúng **chưa được xác nhận** và cần một lời đồng ý hoặc chỉnh sửa.",
     "blocks": [
         {"type": "h", "text": "Where the conditions in the charts come from||Điều kiện trong các sơ đồ lấy từ đâu"},
         {"type": "p", "text": "The numbers and limits a reader is most likely to question, each with the question that was asked and the answer you chose. The last column is what the prototype itself shows.||Các con số và giới hạn dễ bị hỏi lại nhất, mỗi cái kèm câu hỏi đã được hỏi và câu trả lời bạn đã chọn. Cột cuối là những gì chính prototype thể hiện."},
         {"type": "table", "head": ["Condition||Điều kiện", "Question asked||Câu hỏi đã hỏi", "Answer you chose||Câu trả lời bạn đã chọn", "In the prototype||Trong prototype"], "rows": evidence_rows()},
         {"type": "h", "text": "Business rules (decided)||Quy tắc nghiệp vụ (đã quyết định)"},
         {"type": "table", "head": ["ID||ID", "Rule||Quy tắc", "Flows||Flow", "Source||Nguồn"], "rows": both(RULES_EN, RULES_VI) + NEW_RULES},
         {"type": "h", "text": "Assumptions made while drawing (awaiting confirmation)||Giả định đặt ra khi vẽ (chờ xác nhận)"},
         {"type": "table", "head": ["ID||ID", "Assumption||Giả định", "Flows||Flow", "Why this value||Vì sao chọn vậy"], "rows": both(ASSUME_EN, ASSUME_VI) + NEW_ASSUME}]},
    {"title": "5 · Open questions and missing requirements||5 · Câu hỏi mở và yêu cầu còn thiếu",
     "intro": "Cases the charts ran into that no decision, rule or written flow covers yet. Each has a suggested answer; none is assumed in the charts unless it says so.||Các trường hợp sơ đồ gặp phải mà chưa có quyết định, quy tắc hay flow viết nào phủ tới. Mỗi câu có đề xuất trả lời; sơ đồ không ngầm dùng câu nào trừ khi có ghi rõ.",
     "blocks": [
         {"type": "table", "head": ["ID||ID", "Question||Câu hỏi", "Flows||Flow", "Suggested answer||Đề xuất trả lời", "Blocks||Chặn"], "rows": both(OPEN_EN, OPEN_VI) + NEW_OPEN},
         {"type": "h", "text": "Screens the charts use that the prototype does not draw||Màn hình các sơ đồ dùng tới mà prototype chưa vẽ"},
         {"type": "p", "text": "Each of these needs a design before its tickets start. The finding and the question behind each are in the last column; findings (N, GAP) are on the Gap analysis tab.||Mỗi màn hình dưới đây cần có thiết kế trước khi bắt đầu ticket của nó. Phát hiện và câu hỏi liên quan nằm ở cột cuối; các phát hiện (N, GAP) ở tab Phân tích gap."},
         {"type": "table", "head": ["Screen or state||Màn hình hoặc trạng thái", "Flows||Flow", "In the prototype||Trong prototype", "Finding · question||Phát hiện · câu hỏi"], "rows": MISSING}]},
]}

out = pathlib.Path(__file__).with_name("flowmaps.json")
out.write_text(json.dumps(spec, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"{out.name}: {len(all_maps)} charts, {n_nodes} nodes, {n_dec} decisions")
if warnings:
    print(f"{len(warnings)} labels may be too long:")
    for w in warnings:
        print("  ", w)
