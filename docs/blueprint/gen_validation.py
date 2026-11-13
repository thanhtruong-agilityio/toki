#!/usr/bin/env python3
"""Writes the "Validation" tab (the `validation` key) into blueprint.en.json and blueprint.vi.json.

Requirement clarification and validation: findings triage, decisions, flow validation, business rules,
requirements, acceptance criteria, test scenarios, traceability and a readiness report.

Run after gen_flowmaps.py, flowmap.py and gen_analysis.py:   python3 gen_validation.py
Every string is "English||Tiếng Việt". A functional requirement is written only from something the user
decided (Q, G, OQ, NR); whatever is still assumed or open is listed against it, never folded into it.
"""
import contextlib, io, json, pathlib

with contextlib.redirect_stdout(io.StringIO()):
    import gen_flowmaps as FM
    import gen_analysis as GA

HERE = pathlib.Path(__file__).parent
LANGS = ["en", "vi"]
deep = GA.deep
SEV = GA.SEV
YES, NO = "yes||có", "no||không"

FA_ROWS = FM.both(FM.ASSUME_EN, FM.ASSUME_VI) + FM.NEW_ASSUME
FQ_ROWS = FM.both(FM.OPEN_EN, FM.OPEN_VI) + FM.NEW_OPEN
BR_ROWS = FM.both(FM.RULES_EN, FM.RULES_VI) + FM.NEW_RULES
CHARTS = [FM.h1, FM.h2] + FM.D + FM.E

# ───────────────────────── questions raised by this validation ─────────────────────────
# id, question, why, proposal, owner, severity
VQ = [
    ["VQ-01", "The 51 written flows were drafted by Claude under decision Q19 ('Claude decides what the prototype does not draw'). Several things in them were never asked one by one: Sign out and the list of signed-in devices (F06), Resend and Revoke of an invitation (F02), what deactivation does to a person's messages and DMs (F41). Are the written flows accepted as the baseline, or reviewed group by group first?||51 flow viết do Claude soạn theo quyết định Q19 ('Claude quyết định những gì prototype không vẽ'). Nhiều điều trong đó chưa từng được hỏi riêng: Sign out và danh sách thiết bị đã đăng nhập (F06), Resend và Revoke lời mời (F02), vô hiệu hoá ảnh hưởng thế nào tới tin nhắn và DM của một người (F41). Chấp nhận các flow viết làm nền, hay rà từng nhóm trước?",
     "Requirements below use only what you answered. Anything that exists only in a written flow is not a requirement yet.||Các yêu cầu bên dưới chỉ dùng những gì bạn đã trả lời. Thứ gì chỉ có trong flow viết thì chưa phải là yêu cầu.",
     "Review the four phase-1 groups that have no prototype screen (account and sign-in, channels, administration, status); accept the rest as written.||Rà bốn nhóm của phase 1 không có màn hình trong prototype (tài khoản và đăng nhập, kênh, quản trị, trạng thái); phần còn lại chấp nhận như đã viết.", "PO", "H"],
    ["VQ-02", "No performance target was ever decided: how fast a conversation opens, how fast a sent message reaches other people, how many people online at once.||Chưa từng quyết định mục tiêu hiệu năng nào: mở một cuộc trò chuyện nhanh cỡ nào, tin gửi đi tới người khác nhanh cỡ nào, bao nhiêu người online cùng lúc.",
     "Q9 fixes the size (about 200 people, one server) but no measurable target, so no performance test can pass or fail.||Q9 chốt quy mô (khoảng 200 người, một server) nhưng không có mục tiêu đo được, nên không test hiệu năng nào có thể đạt hay không đạt.",
     "Conversation open under 1 s and message delivery under 500 ms on a normal connection, with 200 people online. These numbers are a proposal.||Mở cuộc trò chuyện dưới 1 giây và tin tới nơi dưới 500 ms trên kết nối bình thường, với 200 người online. Các con số này là đề xuất.", "PO, BE", "M"],
    ["VQ-03", "No decision on backup and recovery: how often data is backed up, and how much may be lost or how long the service may be down.||Chưa có quyết định về sao lưu và khôi phục: sao lưu bao lâu một lần, được phép mất bao nhiêu dữ liệu hoặc ngừng dịch vụ bao lâu.",
     "History is kept forever on one server (Q20, Q27); a disk failure without a backup rule loses everything.||Lịch sử được giữ mãi trên một server (Q20, Q27); hỏng đĩa mà không có quy định sao lưu thì mất tất cả.",
     "Nightly backup of database and files to another place, kept 14 days; a restore tested before launch.||Sao lưu hàng đêm database và file sang nơi khác, giữ 14 ngày; thử khôi phục trước khi ra mắt.", "PO, BE", "H"],
]
FQ_OWNER = dict(zip([f"FQ-{i:02d}" for i in range(1, 23)],
                    "PO, BE|FE|PO|PO, BE|PO|UX|FE, BE|PO|BE|PO|BE|BE|UX|UX|PO, UX|PO|UX|PO, UX|PO|UX|UX|UX".split("|")))
FQ_SEV = dict(zip([f"FQ-{i:02d}" for i in range(1, 23)], "H M M M M L M M L L M L H H H M H M H H H M".split()))

# ───────────────────────── 1 · findings backlog (consolidated) ─────────────────────────
# id, finding, merged ids, category, severity, business impact, owner, depends on / note
T = [
    ["T-01", "Getting in and out has no design: member sign-in, invitation, welcome step, refusal page, session ended, account deactivated, sign out.||Việc vào và ra chưa có thiết kế: đăng nhập thành viên, lời mời, màn hình chào, trang từ chối, hết phiên, tài khoản bị vô hiệu hoá, sign out.",
     "N-01 N-04 N-29 N-30 FQ-01 FQ-13 FQ-14 FQ-15 FA-13 FA-14 FA-15 VQ-01", "UF", "C", "Nobody can enter the product; first thing every user meets.||Không ai vào được sản phẩm; là thứ đầu tiên mọi người dùng gặp.", "PO, UX", "The account that sends sign-in mail (still open on the Questions & Gaps tab).||Tài khoản gửi mail đăng nhập (còn mở ở tab Questions & Gaps)."],
    ["T-02", "Admin has no member management: invite, resend, revoke, change role, deactivate.||Admin không có quản lý thành viên: mời, gửi lại, thu hồi, đổi vai trò, vô hiệu hoá.",
     "N-02 N-26 FQ-03 FQ-11 FA-11 GQ-16", "UX", "C", "Without invitations the workspace stays at one person.||Không có lời mời thì workspace chỉ có một người.", "PO, UX", "T-01 (invitation link), T-03 (who may do what).||T-01 (link mời), T-03 (ai được làm gì)."],
    ["T-03", "Permissions were only ever seen as an Owner; the capability table is not signed off.||Phân quyền mới chỉ được xem với vai trò Owner; bảng quyền chưa được duyệt.",
     "N-12 N-32 GQ-20 AS-01 FQ-19 GAP-01 GAP-17", "BL", "C", "A Member or guest reaching private content.||Member hoặc guest chạm được nội dung riêng tư.", "PO, QA", "Blocks every permission test.||Chặn mọi test phân quyền."],
    ["T-04", "Creating channels and groups, and managing who is in them, is not drawn.||Tạo kênh và nhóm, và quản lý ai ở trong đó, chưa được vẽ.",
     "N-03 N-15 N-31 FQ-09 FQ-17 FQ-18 FQ-20 GQ-05 FA-04 FA-05 FA-10", "UF", "H", "The team cannot organise its conversations.||Nhóm không tổ chức được các cuộc trò chuyện.", "PO, UX", "FQ-17 before FQ-18.||FQ-17 trước FQ-18."],
    ["T-05", "No loading, error or retry state anywhere; a double press is undefined.||Không có trạng thái đang tải, lỗi hay thử lại ở đâu cả; bấm hai lần chưa được định nghĩa.",
     "N-05 N-06 N-08 N-18 N-33 GQ-03 GQ-18 FA-02 FA-08 FA-16 FQ-07 FQ-21", "UX", "H", "Actions that seem to succeed but did not; lost input.||Hành động tưởng thành công nhưng không; mất nội dung đã gõ.", "UX, FE", "GQ-03 decides every form.||GQ-03 quyết định cho mọi form."],
    ["T-06", "Notification rules are ambiguous: level, Mute, a mention in a muted conversation.||Quy tắc thông báo còn mơ hồ: mức, Mute, mention trong cuộc trò chuyện đã tắt tiếng.",
     "N-10 N-11 GQ-01 GQ-02 FA-12 AS-02", "BL", "H", "People miss mentions or are flooded.||Người dùng lỡ mention hoặc bị ngập thông báo.", "PO", "GQ-01 before GQ-02.||GQ-01 trước GQ-02."],
    ["T-07", "Addresses, browser Back, reload and shared links are undefined.||Địa chỉ, Back của trình duyệt, tải lại và link chia sẻ chưa được định nghĩa.",
     "N-13 GQ-06", "UF", "H", "Notifications and links open the wrong place.||Thông báo và link mở sai nơi.", "FE, UX", "Shapes the app shell; needed before notifications.||Quyết định khung ứng dụng; cần trước phần thông báo."],
    ["T-08", "Offline and reconnecting: wording, states and what is blocked.||Offline và kết nối lại: câu chữ, trạng thái và những gì bị chặn.",
     "GAP-21 FQ-22 FA-06 FA-09 FA-17", "SB", "M", "False success while offline.||Báo thành công giả khi offline.", "UX, FE", "Rule NR13 is decided; only wording and timing are open.||Quy tắc NR13 đã chốt; chỉ còn câu chữ và thời gian."],
    ["T-09", "Uploading is faked: no picker, progress, limit, failure or cancel.||Tải lên là giả lập: không có chọn file, tiến độ, giới hạn, lỗi hay huỷ.",
     "N-07 FQ-04 FA-07", "UF", "H", "Files are a phase-1 feature with no design.||File là tính năng phase 1 mà chưa có thiết kế.", "UX, BE", "Limits are decided (G9, Q14).||Giới hạn đã chốt (G9, Q14)."],
    ["T-10", "Behaviour between several people, devices and tabs cannot be observed in the prototype.||Hành vi giữa nhiều người, thiết bị và tab không quan sát được trong prototype.",
     "N-19 N-23 FQ-02 FQ-05 GQ-13", "SB", "H", "Wrong unread counts, duplicated or lost messages.||Sai số chưa đọc, tin bị trùng hoặc mất.", "BE, QA", "Needs tests with two signed-in clients.||Cần test với hai client cùng đăng nhập."],
    ["T-11", "39 defects found by walking through the prototype (wrong, misleading or inconsistent behaviour).||39 lỗi tìm thấy khi đi qua prototype (hành vi sai, gây hiểu lầm hoặc không nhất quán).",
     "GAP-01…GAP-39", "UX", "H", "Rebuilt as designed, the product would repeat them.||Làm lại đúng như thiết kế thì sản phẩm sẽ lặp lại chúng.", "BA, QA", "**Resolved:** each has a required behaviour on the Questions & Gaps tab; 22 became rules NR1 to NR13.||**Đã giải quyết:** mỗi lỗi có hành vi yêu cầu ở tab Questions & Gaps; 22 lỗi thành quy tắc NR1 tới NR13."],
    ["T-12", "Growth has no bound and operations are unstated: storage, long lists, new versions, browsers, backup, performance.||Tăng trưởng không có giới hạn và vận hành chưa được nêu: lưu trữ, danh sách dài, bản mới, trình duyệt, sao lưu, hiệu năng.",
     "N-17 N-20 N-21 N-22 GQ-09 GQ-10 GQ-11 GQ-12 GQ-17 FQ-12 VQ-02 VQ-03", "SB", "M", "A full disk stops the only server; no test can judge speed.||Đầy đĩa làm dừng server duy nhất; không test nào đánh giá được tốc độ.", "BE, PO", "VQ-03 before launch.||VQ-03 trước khi ra mắt."],
    ["T-13", "Search: no loading or error, no stated coverage or limits.||Tìm kiếm: không có trạng thái tải hay lỗi, không nêu phạm vi hay giới hạn.",
     "N-27 GQ-19", "UX", "M", "Ctrl+K is a phase-1 feature with unclear scope.||Ctrl+K là tính năng phase 1 mà phạm vi chưa rõ.", "PO, FE", ""],
    ["T-14", "Personal details and small conveniences: profile editing, picture, time format, tab title, unfollow a thread, mark unread, preview of a public channel, changing a sign-in address, a past reminder choice.||Thông tin cá nhân và tiện ích nhỏ: sửa hồ sơ, ảnh, định dạng giờ, tiêu đề tab, bỏ theo dõi thread, đánh dấu chưa đọc, xem trước kênh công khai, đổi địa chỉ đăng nhập, lựa chọn nhắc việc đã qua.",
     "N-14 N-16 N-24 N-25 N-28 GQ-04 GQ-07 GQ-08 GQ-14 GQ-15 FQ-06 FQ-08 FQ-10 AS-03 AS-04", "UX", "L", "Polish; none blocks a journey.||Hoàn thiện; không cái nào chặn một hành trình.", "PO, UX", ""],
    ["T-15", "Demo-only content in the prototype: the demo bar, sample people and messages, 'New' pills, analytics privacy note.||Nội dung chỉ để demo trong prototype: thanh demo, người và tin nhắn mẫu, nhãn 'New', ghi chú riêng tư của thống kê.",
     "AS-05 AS-06 AS-07 AS-08", "UX", "L", "None, if left out of the build.||Không có, nếu không đưa vào bản build.", "PO", "AS-05 confirmed; the rest await a yes.||AS-05 đã xác nhận; phần còn lại chờ đồng ý."],
]
DUPES = [
    ["A failed send has no design||Gửi lỗi chưa có thiết kế", "N-06 · N-33 · FQ-07 · FQ-21", "T-05"],
    ["No way to create a channel||Không có cách tạo kênh", "N-03 · FQ-17 · MF 'Create a channel'", "T-04"],
    ["The code screen has no Resend||Màn hình mã không có Resend", "N-30 · FQ-14", "T-01"],
    ["Mention in a muted conversation||Mention trong cuộc trò chuyện đã tắt tiếng", "N-10 · GQ-01 · R-04", "T-06"],
    ["Storage quota||Hạn mức lưu trữ", "N-17 · GQ-09 · R-07", "T-12"],
    ["Offline behaviour||Hành vi khi offline", "GAP-21 · N-33 · FQ-22", "T-08"],
    ["Double press||Bấm hai lần", "N-18 · GQ-18", "T-05"],
    ["Second tab or device||Tab hoặc thiết bị thứ hai", "N-19 · FQ-02", "T-10"],
    ["Permissions seen only as Owner||Phân quyền chỉ xem với vai trò Owner", "N-12 · AS-01 · GQ-20 · R-02", "T-03"],
]
CONFLICTS = [
    ["Leaving a channel||Rời một kênh", "Asks for confirmation and then also offers Undo||Hỏi xác nhận rồi lại đưa thêm Undo", "Undo for a reversible action, confirmation for an irreversible one, never both (NR3)||Undo cho hành động hoàn tác được, xác nhận cho hành động không hoàn tác được, không bao giờ cả hai (NR3)", "**Resolved:** NR3||**Đã giải quyết:** NR3"],
    ["Deleting a message that has a thread||Xoá một tin có thread", "Deletes every reply||Xoá luôn mọi trả lời", "The thread stays under a 'Message deleted' line (Q13)||Thread vẫn còn dưới dòng 'Message deleted' (Q13)", "**Resolved:** Q13||**Đã giải quyết:** Q13"],
    ["Leaving a private channel||Rời một kênh riêng tư", "'You can rejoin from Browse channels'||'You can rejoin from Browse channels'", "A member must invite them back (OQ2)||Phải được một thành viên mời lại (OQ2)", "**Resolved:** OQ2||**Đã giải quyết:** OQ2"],
    ["Default language||Ngôn ngữ mặc định", "Vietnamese in the first answer to Q18||Tiếng Việt ở câu trả lời đầu cho Q18", "English (Q18, changed by you on 13 Nov 2026)||Tiếng Anh (Q18, bạn đổi ngày 13/11/2026)", "**Resolved:** Q18||**Đã giải quyết:** Q18"],
    ["Offline banner||Banner offline", "'Offline: showing saved messages'||'Offline: showing saved messages'", "Written flow F37: 'Reconnecting…' and a 'Reconnected' toast||Flow viết F37: 'Reconnecting…' và toast 'Reconnected'", "**Open:** FQ-22||**Còn mở:** FQ-22"],
    ["Where a form error appears||Lỗi của form hiện ở đâu", "A toast after pressing the button||Một toast sau khi bấm nút", "The charts: a message under the field, button disabled||Các sơ đồ: thông báo dưới ô nhập, nút bị tắt", "**Open:** GQ-03||**Còn mở:** GQ-03"],
    ["How long a sign-in code lasts||Mã đăng nhập sống bao lâu", "Guest screen: 'It works for 10 minutes'||Màn hình guest: 'It works for 10 minutes'", "Nothing decided for members||Chưa quyết định gì cho thành viên", "**Open:** FA-13||**Còn mở:** FA-13"],
    ["Mention in a muted conversation||Mention trong cuộc trò chuyện đã tắt tiếng", "A personal switch in Preferences||Một công tắc cá nhân trong Preferences", "Chart 2.7 shows badge only||Sơ đồ 2.7 thể hiện chỉ có huy hiệu", "**Open:** GQ-01||**Còn mở:** GQ-01"],
    ["'Nothing' level and Mute||Mức 'Nothing' và Mute", "Two separate controls||Hai điều khiển riêng", "No stated difference||Chưa nêu khác biệt", "**Open:** GQ-02||**Còn mở:** GQ-02"],
]
DEPENDS = [
    ["GQ-20 (capability table signed off)||GQ-20 (duyệt bảng quyền)", "FR-13, FR-19, FR-23, FR-25, FR-26 and every permission test||FR-13, FR-19, FR-23, FR-25, FR-26 và mọi test phân quyền"],
    ["GQ-06 (addresses and Back)||GQ-06 (địa chỉ và Back)", "FR-07, opening a notification (FR-14, FR-18), the app shell||FR-07, mở một thông báo (FR-14, FR-18), khung ứng dụng"],
    ["GQ-03 (where form errors show)||GQ-03 (lỗi form hiện ở đâu)", "Every form: sign-in, create channel, invite, welcome step||Mọi form: đăng nhập, tạo kênh, mời, màn hình chào"],
    ["GQ-01, then GQ-02 (Mute)||GQ-01, rồi GQ-02 (Mute)", "FR-14, FR-16||FR-14, FR-16"],
    ["FQ-17, then FQ-18 (create channel)||FQ-17, rồi FQ-18 (tạo kênh)", "FR-19||FR-19"],
    ["FA-13, FA-14 (code life, wrong tries)||FA-13, FA-14 (thời gian sống của mã, số lần sai)", "Negative and boundary tests of FR-01||Test phủ định và test biên của FR-01"],
    ["The account that sends sign-in mail||Tài khoản gửi mail đăng nhập", "FR-01, FR-04 in any real environment||FR-01, FR-04 ở mọi môi trường thật"],
    ["GQ-11 (supported browsers)||GQ-11 (trình duyệt hỗ trợ)", "FR-18, NFR-06 and the test matrix||FR-18, NFR-06 và ma trận kiểm thử"],
]

# ───────────────────────── 5–7 · requirements, acceptance criteria, tests ─────────────────────────
AREA = {"AC": "Access||Truy cập", "RD": "Reading||Đọc", "MS": "Messaging||Nhắn tin", "NT": "Notifications||Thông báo",
        "CH": "Channels and DMs||Kênh và DM", "LT": "Later||Later", "AD": "Administration||Quản trị", "SH": "Shared behaviour||Hành vi chung"}
TT = {"P": "Positive||Tích cực", "N": "Negative||Phủ định", "B": "Boundary||Biên", "X": "Exception||Ngoại lệ"}
NOSCREEN = "not in the prototype||không có trong prototype"
# area, requirement, decided by, still assumed or open, screen, flows, rules, [(criterion, [(type, test)])]
FR = [
    ("AC", "A member signs in with a 6-digit code sent to their email address. There is no password.||Thành viên đăng nhập bằng mã 6 số gửi tới địa chỉ email. Không có mật khẩu.", "Q11", "FA-13 FA-14 FQ-14", f"Sign-in ({NOSCREEN.split('||')[0]})||Đăng nhập ({NOSCREEN.split('||')[1]})", "2.1", "BR-02",
     [("Entering the 6 digits sent to a member's address opens the app as that member.||Nhập đúng 6 số đã gửi tới địa chỉ của thành viên thì mở ứng dụng với tư cách người đó.", [("P", "Request a code, enter it, land in the app.||Xin mã, nhập mã, vào ứng dụng."), ("N", "Enter 6 digits that were not sent: refused, still on the code screen.||Nhập 6 số không phải mã đã gửi: bị từ chối, vẫn ở màn hình mã.")]),
      ("The code field accepts exactly 6 digits; the sign-in page has no password field.||Ô mã nhận đúng 6 chữ số; trang đăng nhập không có ô mật khẩu.", [("B", "5 digits and 7 digits are not submitted.||5 số và 7 số thì không gửi được."), ("N", "Letters in the code field are rejected.||Chữ cái trong ô mã bị từ chối.")])]),
    ("AC", "A code can be requested at most 5 times per address in 15 minutes; the code can be sent again 60 seconds after the last request.||Mỗi địa chỉ xin mã tối đa 5 lần trong 15 phút; gửi lại mã được sau 60 giây kể từ lần xin trước.", "G5", "FQ-14", f"Sign-in ({NOSCREEN.split('||')[0]})||Đăng nhập ({NOSCREEN.split('||')[1]})", "2.1", "BR-03",
     [("The 6th request for one address within 15 minutes is refused and no mail is sent.||Lần xin thứ 6 cho một địa chỉ trong 15 phút bị từ chối và không gửi mail.", [("B", "5th request succeeds, 6th is refused.||Lần 5 thành công, lần 6 bị từ chối."), ("P", "After 15 minutes a request succeeds again.||Sau 15 phút xin lại được.")]),
      ("Sending again is unavailable for 60 seconds after a request.||Trong 60 giây sau một lần xin thì chưa gửi lại được.", [("B", "At 59 s unavailable; at 60 s available.||Giây 59 chưa được; giây 60 được.")])]),
    ("AC", "A session lasts 30 days on one device. Nothing in Toki can be read without a session.||Một phiên kéo dài 30 ngày trên một thiết bị. Không có phiên thì không đọc được gì trong Toki.", "Q11", "FA-15 FQ-02", NOSCREEN, "1.1, 2.3, 3.2", "BR-01, BR-05",
     [("Any address opened without a session shows the sign-in page and no workspace content.||Mở bất kỳ địa chỉ nào khi chưa có phiên thì hiện trang đăng nhập và không có nội dung workspace.", [("N", "Open a conversation link signed out: sign-in page only.||Mở link cuộc trò chuyện khi chưa đăng nhập: chỉ có trang đăng nhập."), ("N", "Call the API without a session: refused.||Gọi API không có phiên: bị từ chối.")]),
      ("A session signed in on one device does not sign in another device.||Phiên đăng nhập ở một thiết bị không làm thiết bị khác đăng nhập theo.", [("P", "Sign in on A; B still asks for a code.||Đăng nhập ở A; B vẫn hỏi mã.")]),
      ("A session unused for more than 30 days is no longer accepted.||Phiên không dùng quá 30 ngày thì không còn được chấp nhận.", [("B", "Day 30 accepted, day 31 refused (clock moved in a test).||Ngày 30 được, ngày 31 bị từ chối (chỉnh đồng hồ khi test).")])]),
    ("AC", "People join only by an invitation from an Admin or Owner. An invitation lasts 7 days, works once, and its link signs the person in without a code.||Chỉ vào được qua lời mời của Admin hoặc Owner. Lời mời có hạn 7 ngày, dùng một lần, và link trong đó đăng nhập không cần mã.", "Q11 Q26 G4", "FQ-13 FQ-15 FQ-01", NOSCREEN, "2.2, 2.12", "BR-06",
     [("Opening an unused invitation link within 7 days signs the person in with no code asked.||Mở link mời chưa dùng trong vòng 7 ngày thì đăng nhập mà không hỏi mã.", [("P", "Accept on day 1: signed in.||Nhận lời mời ngày 1: đã đăng nhập."), ("B", "Accept just before 7 days: works; just after: refused.||Nhận ngay trước 7 ngày: được; ngay sau: bị từ chối.")]),
      ("A link that was already used does not sign anyone in a second time.||Link đã dùng rồi thì không đăng nhập được lần thứ hai.", [("N", "Open the same link again: no session is created.||Mở lại cùng link: không tạo phiên.")]),
      ("An address with no invitation and no account cannot get into the workspace.||Địa chỉ không có lời mời và không có tài khoản thì không vào được workspace.", [("N", "Request a code for a stranger's address: no access results.||Xin mã cho địa chỉ lạ: không vào được.")])]),
    ("AC", "#general exists from set-up; every member is in it automatically and it cannot be left or archived.||#general có từ lúc thiết lập; mọi thành viên tự động ở trong đó và không rời hay lưu trữ được.", "G1", "FQ-16", "Home, Details panel||Home, panel Details", "2.2, 2.9", "BR-07",
     [("A person who accepts an invitation is a member of #general without doing anything.||Người nhận lời mời là thành viên của #general mà không phải làm gì.", [("P", "New member's list contains #general.||Danh sách của thành viên mới có #general.")]),
      ("#general offers no way to leave or archive it, for any role.||#general không có cách nào để rời hay lưu trữ, với mọi vai trò.", [("N", "Leave is unavailable in #general for Member, Admin, Owner.||Leave không dùng được ở #general với Member, Admin, Owner."), ("N", "A leave request sent directly to the server is refused.||Request rời kênh gửi thẳng tới server bị từ chối.")])]),
    ("AC", "A display name is 1 to 80 characters.||Tên hiển thị dài từ 1 tới 80 ký tự.", "Q31", "FQ-15", NOSCREEN, "2.2", "BR-35",
     [("A name of 1 to 80 characters is saved; an empty name or one of 81 characters is refused.||Tên từ 1 tới 80 ký tự thì lưu được; tên trống hoặc 81 ký tự thì bị từ chối.", [("B", "1 and 80 characters saved.||1 và 80 ký tự lưu được."), ("B", "0 and 81 characters refused.||0 và 81 ký tự bị từ chối."), ("P", "A Vietnamese name with diacritics is kept exactly.||Tên tiếng Việt có dấu được giữ nguyên.")])]),
    ("RD", "With no link, the app opens on the conversation last viewed on that device; the first time, on #general.||Không có link thì ứng dụng mở vào cuộc trò chuyện xem gần nhất trên thiết bị đó; lần đầu thì vào #general.", "G2", "GQ-06", "Home||Home", "2.3", "BR-08",
     [("After viewing a conversation and reopening the app on the same device, that conversation is shown.||Xem một cuộc trò chuyện rồi mở lại ứng dụng trên cùng thiết bị thì hiện đúng cuộc trò chuyện đó.", [("P", "View #launch, reopen: #launch.||Xem #launch, mở lại: #launch."), ("X", "The last conversation was left or archived meanwhile: the app still opens somewhere usable.||Cuộc trò chuyện gần nhất đã bị rời hoặc lưu trữ: ứng dụng vẫn mở vào một nơi dùng được.")]),
      ("The first opening on a device shows #general.||Lần mở đầu tiên trên một thiết bị hiện #general.", [("P", "New device: #general.||Thiết bị mới: #general.")])]),
    ("RD", "A conversation counts as read when it is open, the window is in use and the person is at the bottom of the list. The 'New' divider marks the first unread message at opening. Nobody sees who has read a message.||Một cuộc trò chuyện tính là đã đọc khi nó đang mở, cửa sổ đang được dùng và người dùng ở cuối danh sách. Vạch 'New' đánh dấu tin chưa đọc đầu tiên lúc mở. Không ai thấy ai đã đọc tin.", "OQ3 G15", "", "Home: message list||Home: danh sách tin nhắn", "2.4", "BR-14",
     [("Opening a conversation and reaching the bottom clears its unread badge; opening it in a window that is not in use does not.||Mở cuộc trò chuyện và tới cuối danh sách thì xoá huy hiệu chưa đọc; mở trong cửa sổ không được dùng thì không xoá.", [("P", "Read to the bottom: badge gone.||Đọc tới cuối: mất huy hiệu."), ("N", "Background window: badge stays.||Cửa sổ nền: huy hiệu vẫn còn."), ("N", "Scrolled up, new message arrives: badge stays.||Đang cuộn lên, có tin mới: huy hiệu vẫn còn.")]),
      ("The 'New' divider sits above the first unread message, stays while viewing, and is gone the next time the conversation opens.||Vạch 'New' nằm trên tin chưa đọc đầu tiên, giữ nguyên khi đang xem, và biến mất ở lần mở sau.", [("P", "3 unread: divider above the first of them; reopen: no divider.||3 tin chưa đọc: vạch nằm trên tin đầu; mở lại: không còn vạch.")]),
      ("No screen shows who has read a message.||Không màn hình nào cho thấy ai đã đọc tin.", [("N", "Sender sees no read mark after the recipient reads.||Người gửi không thấy dấu đã đọc sau khi người nhận đọc.")])]),
    ("MS", "A member of a conversation can send a message of up to 10,000 characters. Writing requires membership.||Thành viên của một cuộc trò chuyện gửi được tin dài tới 10.000 ký tự. Phải là thành viên mới viết được.", "G9 NR11", "FQ-07 FQ-21 FA-02", "Home: composer||Home: ô soạn tin", "2.5", "BR-11, BR-12",
     [("A message of 1 to 10,000 characters is sent; one of 10,001 cannot be sent.||Tin từ 1 tới 10.000 ký tự thì gửi được; tin 10.001 ký tự thì không.", [("B", "10,000 sent; 10,001 not sent.||10.000 gửi được; 10.001 không gửi được."), ("N", "Only spaces: nothing is sent.||Chỉ có khoảng trắng: không gửi gì.")]),
      ("A person who is not a member of the conversation cannot send to it, and pickers list only joined conversations.||Người không phải thành viên thì không gửi được vào đó, và các danh sách chọn chỉ liệt kê cuộc trò chuyện đã tham gia.", [("N", "Send to an unjoined channel by direct request: refused.||Gửi vào kênh chưa tham gia bằng request trực tiếp: bị từ chối."), ("P", "After joining, sending works.||Sau khi tham gia thì gửi được.")])]),
    ("MS", "A message carries up to 10 files, each up to 100 MB. Images get thumbnails.||Một tin kèm tối đa 10 file, mỗi file tối đa 100 MB. Ảnh có thumbnail.", "G9 Q14", "FQ-04 FA-07", "Composer: attach (faked in the prototype)||Ô soạn tin: đính kèm (giả lập trong prototype)", "2.6", "BR-12",
     [("10 files are accepted on one message; an 11th is refused and the 10 remain.||Một tin nhận 10 file; file thứ 11 bị từ chối và 10 file kia vẫn còn.", [("B", "10 accepted, 11th refused.||10 file được, file thứ 11 bị từ chối.")]),
      ("A file of 100 MB is accepted; a larger one is refused before or during upload, and the server refuses it too.||File 100 MB được nhận; file lớn hơn bị từ chối trước hoặc trong khi tải, và server cũng từ chối.", [("B", "100 MB accepted; just over refused.||100 MB được; nhỉnh hơn thì bị từ chối."), ("N", "Oversized upload sent straight to storage: refused.||Tải file quá cỡ thẳng lên kho: bị từ chối.")]),
      ("An attached image shows a thumbnail in the message.||Ảnh đính kèm hiện thumbnail trong tin nhắn.", [("P", "Send a PNG: thumbnail appears.||Gửi một PNG: có thumbnail.")]),
      ("Only people who can see the conversation can open its files.||Chỉ người xem được cuộc trò chuyện mới mở được file của nó.", [("N", "A file address from a private channel opened by a non-member: refused.||Địa chỉ file của kênh riêng tư do người ngoài mở: bị từ chối.")])]),
    ("MS", "The author can edit a message at any time, with no time limit; an edited message is marked '(edited)'.||Tác giả sửa được tin bất kỳ lúc nào, không giới hạn thời gian; tin đã sửa có nhãn '(edited)'.", "Q13", "", "Message menu: Edit||Menu tin nhắn: Edit", "2.10", "BR-24",
     [("The author can edit a message of any age; everyone then sees the new text with '(edited)'.||Tác giả sửa được tin dù cũ tới đâu; mọi người thấy nội dung mới kèm '(edited)'.", [("P", "Edit a message from last month.||Sửa một tin từ tháng trước."), ("N", "Another member has no Edit on it, and a direct request is refused.||Thành viên khác không có Edit, và request trực tiếp bị từ chối.")])]),
    ("MS", "Deleting a message asks for confirmation. A deleted message that has replies keeps its thread, and its files are removed from storage.||Xoá một tin thì hỏi xác nhận. Tin đã xoá mà có trả lời thì giữ thread, và file của nó bị gỡ khỏi kho.", "Q13 G10 NR3", "FQ-05", "Message menu: Delete||Menu tin nhắn: Delete", "2.10", "BR-20, BR-24, BR-25",
     [("Delete removes the message only after a confirmation; cancelling changes nothing; there is no Undo.||Delete chỉ xoá tin sau khi xác nhận; huỷ thì không đổi gì; không có Undo.", [("P", "Confirm: gone for everyone.||Xác nhận: mất với mọi người."), ("N", "Cancel: message unchanged.||Huỷ: tin giữ nguyên.")]),
      ("Deleting a message with replies leaves the replies readable.||Xoá tin có trả lời thì các trả lời vẫn đọc được.", [("P", "Delete a parent with 3 replies: 3 replies remain.||Xoá tin gốc có 3 trả lời: 3 trả lời vẫn còn.")]),
      ("After deletion the message's files can no longer be opened or found in Files.||Sau khi xoá, file của tin không còn mở được hay tìm thấy trong Files.", [("N", "Open the old file address: not available.||Mở địa chỉ file cũ: không còn.")])]),
    ("MS", "An Admin or Owner can delete another person's message only in a conversation they belong to. The message then reads 'Message deleted by an admin' and its author is told.||Admin hoặc Owner chỉ xoá được tin của người khác trong cuộc trò chuyện mà họ là thành viên. Tin khi đó ghi 'Message deleted by an admin' và tác giả được báo.", "G14 G16", "GQ-20", "Message menu (seen only as Owner)||Menu tin nhắn (chỉ xem với vai trò Owner)", "2.10", "BR-26",
     [("An Admin in the channel can delete a Member's message; it shows 'Message deleted by an admin' and the author gets a notice.||Admin trong kênh xoá được tin của Member; tin hiện 'Message deleted by an admin' và tác giả nhận thông báo.", [("P", "Admin deletes: label shown, author notified.||Admin xoá: có nhãn, tác giả được báo.")]),
      ("An Admin or Owner who is not in a private channel cannot see or delete its messages.||Admin hoặc Owner không ở trong một kênh riêng tư thì không thấy và không xoá được tin trong đó.", [("N", "Owner outside the channel: no access by any route.||Owner ngoài kênh: không vào được bằng đường nào."), ("N", "A Member cannot delete another Member's message.||Member không xoá được tin của Member khác.")])]),
    ("NT", "A mention creates an Activity item for the person mentioned. Your own action never notifies you. An item becomes done on its own once the thing it asks for is done.||Mention tạo một mục Activity cho người được nhắc. Hành động của chính mình không tạo thông báo cho mình. Mục tự thành xong khi việc nó yêu cầu đã xong.", "NR5", "GQ-01 FA-12 GQ-06", "Composer @, Activity||Ô soạn tin @, Activity", "2.7", "BR-15",
     [("Mentioning a member of the channel gives them exactly one Activity item.||Mention một thành viên của kênh thì họ nhận đúng một mục Activity.", [("P", "Mention once: one item.||Mention một lần: một mục.")]),
      ("Mentioning yourself, or reacting to your own message, creates no item and no badge for you.||Tự mention mình, hoặc reaction vào tin của mình, không tạo mục hay huy hiệu nào cho mình.", [("N", "Self-mention: Activity unchanged.||Tự mention: Activity không đổi.")]),
      ("Opening the mentioned message marks its item done without a separate action.||Mở tin được mention thì mục tự thành xong, không cần thao tác riêng.", [("P", "Open the message: item done, count down by one.||Mở tin: mục thành xong, số đếm giảm một.")])]),
    ("NT", "During Pause or Focus time there is no toast, push or sound, including your own reminders. Badges still update. When it ends, one summary lists what arrived.||Trong Pause hoặc Focus time không có toast, push hay âm thanh, kể cả nhắc việc của chính mình. Huy hiệu vẫn cập nhật. Khi kết thúc, một bản tóm tắt liệt kê những gì đã tới.", "NR6 Q16", "", "Account menu: Pause, Focus time||Menu tài khoản: Pause, Focus time", "2.7, 2.11", "BR-16",
     [("While paused, a mention produces no toast, push or sound, and the badge still rises.||Khi đang pause, một mention không tạo toast, push hay âm thanh, và huy hiệu vẫn tăng.", [("P", "Paused, mentioned: badge +1, nothing else.||Đang pause, được mention: huy hiệu +1, không gì khác."), ("X", "A reminder falls due during Focus: no toast.||Nhắc việc tới hạn trong Focus: không có toast.")]),
      ("Ending Pause or Focus shows one summary of what arrived.||Kết thúc Pause hoặc Focus thì hiện một bản tóm tắt những gì đã tới.", [("P", "3 mentions during Focus: one summary naming 3.||3 mention trong Focus: một bản tóm tắt ghi 3."), ("B", "Nothing arrived: no summary, or an empty one, consistently.||Không có gì tới: không có tóm tắt, hoặc tóm tắt trống, nhất quán.")]),
      ("Starting Focus during Focus extends it; ending restores the earlier status.||Bắt đầu Focus khi đang Focus thì kéo dài nó; kết thúc thì trả lại trạng thái trước đó.", [("X", "Start twice: one Focus period, longer.||Bắt đầu hai lần: một khoảng Focus, dài hơn.")])]),
    ("NT", "The default notification level is 'Mentions only' for channels and 'All messages' for DMs.||Mức thông báo mặc định là 'Mentions only' cho kênh và 'All messages' cho DM.", "G13", "GQ-02", "Details panel: notification level||Panel Details: mức thông báo", "2.7", "BR-17",
     [("A newly joined channel is at 'Mentions only'; a new DM is at 'All messages'.||Kênh vừa tham gia ở mức 'Mentions only'; DM mới ở mức 'All messages'.", [("P", "Join a channel: level reads 'Mentions only'.||Tham gia kênh: mức ghi 'Mentions only'."), ("P", "New DM: level reads 'All messages'.||DM mới: mức ghi 'All messages'.")])]),
    ("NT", "Any member of a channel can use @channel. In a channel of 20 or more people it asks for confirmation first.||Thành viên nào của kênh cũng dùng được @channel. Trong kênh từ 20 người trở lên thì hỏi xác nhận trước.", "G8 Q17", "", "Composer @ (no @channel in the prototype)||Ô soạn tin @ (prototype không có @channel)", "2.7", "BR-18",
     [("@channel in a channel of 20 people asks for confirmation; in one of 19 it does not.||@channel trong kênh 20 người thì hỏi xác nhận; trong kênh 19 người thì không.", [("B", "19 members: sent at once. 20 members: asked first.||19 thành viên: gửi ngay. 20 thành viên: hỏi trước."), ("N", "Cancel the confirmation: nothing is sent.||Huỷ hộp xác nhận: không gửi gì.")])]),
    ("NT", "Phase 1 has badges, Web Push and sound. A push shows the sender, the conversation and the start of the message. The web app is installable.||Phase 1 có huy hiệu, Web Push và âm thanh. Push hiện người gửi, cuộc trò chuyện và phần đầu tin nhắn. Ứng dụng web cài được.", "Q16 G11 Q28", "GQ-11 GQ-06", "not observable in the prototype||không quan sát được trong prototype", "2.7", "",
     [("With the app closed and push allowed, a mention produces a system notification naming the sender and the conversation and showing the start of the message.||Khi ứng dụng đóng và đã cho phép push, một mention tạo thông báo hệ thống ghi người gửi, cuộc trò chuyện và phần đầu tin nhắn.", [("P", "App closed, mention: notification with the three parts.||Ứng dụng đóng, có mention: thông báo có đủ ba phần."), ("N", "Push not allowed: no notification, badge still updates.||Chưa cho phép push: không có thông báo, huy hiệu vẫn cập nhật.")]),
      ("The web app can be installed to the home screen or desktop from a supported browser.||Ứng dụng web cài được ra màn hình chính hoặc desktop từ trình duyệt được hỗ trợ.", [("P", "Install offered and works.||Có đề nghị cài và cài được.")])]),
    ("CH", "Every Member, Admin and Owner can create a public or private channel. A name uses lowercase letters, digits and hyphens, up to 80 characters, and is unique. Public or private is fixed at creation.||Mọi Member, Admin và Owner tạo được kênh công khai hoặc riêng tư. Tên dùng chữ thường, số và gạch nối, tối đa 80 ký tự, và không trùng. Công khai hay riêng tư cố định từ lúc tạo.", "Q12 G7", "FQ-17 FQ-18 FA-04 FA-05 GQ-20 FQ-09", NOSCREEN, "2.8", "BR-19, BR-37",
     [("A valid, unused name creates the channel with its creator as a member.||Tên hợp lệ và chưa dùng thì tạo được kênh, người tạo là thành viên.", [("P", "Member creates a public channel.||Member tạo một kênh công khai."), ("P", "Member creates a private channel.||Member tạo một kênh riêng tư.")]),
      ("A name of 80 characters is accepted, one of 81 refused; a name already in use is refused.||Tên 80 ký tự được nhận, 81 ký tự bị từ chối; tên đã dùng thì bị từ chối.", [("B", "80 accepted, 81 refused.||80 được, 81 bị từ chối."), ("N", "Existing name refused.||Tên đã có bị từ chối."), ("N", "A name with a character outside a–z, 0–9, hyphen is not created as typed.||Tên có ký tự ngoài a–z, 0–9, gạch nối thì không được tạo đúng như đã gõ.")]),
      ("An existing channel offers no way to switch between public and private.||Kênh đã tạo không có cách nào đổi giữa công khai và riêng tư.", [("N", "No such control; a direct request is refused.||Không có điều khiển này; request trực tiếp bị từ chối.")])]),
    ("CH", "Joining a public channel gives its full history. Channels are archived, never deleted.||Tham gia kênh công khai thì thấy đầy đủ lịch sử. Kênh được lưu trữ, không bao giờ bị xoá.", "Q27", "FQ-10", "Browse channels||Browse channels", "2.9", "",
     [("A person who joins a public channel can read messages sent before they joined.||Người tham gia kênh công khai đọc được tin đã gửi trước khi họ vào.", [("P", "Join, scroll to the first message.||Tham gia, cuộn tới tin đầu tiên.")]),
      ("No role has a way to delete a channel; an archived channel keeps its history.||Không vai trò nào có cách xoá kênh; kênh đã lưu trữ vẫn giữ lịch sử.", [("N", "No delete control for Owner.||Owner không có điều khiển xoá."), ("P", "Archived channel still readable by its members.||Kênh đã lưu trữ vẫn đọc được với thành viên.")])]),
    ("CH", "Leaving a public channel happens at once with Undo for 5 seconds. Leaving a private channel asks for confirmation, and the person can return only when a member invites them. When the last member leaves, the channel is archived.||Rời kênh công khai thì xảy ra ngay kèm Undo 5 giây. Rời kênh riêng tư thì hỏi xác nhận, và chỉ quay lại được khi một thành viên mời. Khi thành viên cuối rời đi, kênh được lưu trữ.", "NR3 OQ2", "FA-10", "Details panel: Leave channel||Panel Details: Leave channel", "2.9", "BR-20, BR-23",
     [("Leaving a public channel shows Undo for 5 seconds and no confirmation; Undo restores membership.||Rời kênh công khai hiện Undo 5 giây và không hỏi xác nhận; Undo trả lại tư cách thành viên.", [("P", "Leave, Undo within 5 s: still a member.||Rời, Undo trong 5 giây: vẫn là thành viên."), ("B", "After 5 s Undo is gone.||Sau 5 giây không còn Undo.")]),
      ("Leaving a private channel asks for confirmation that says a member must invite you back, and offers no Undo.||Rời kênh riêng tư thì hỏi xác nhận có ghi phải được thành viên mời lại, và không có Undo.", [("P", "Confirm: left; the channel is absent from Browse and Ctrl+K.||Xác nhận: đã rời; kênh không có trong Browse và Ctrl+K."), ("N", "Cancel: still a member.||Huỷ: vẫn là thành viên.")]),
      ("When the last member leaves a channel it becomes archived.||Khi thành viên cuối rời kênh thì kênh thành lưu trữ.", [("X", "Sole member leaves: channel archived, not deleted.||Thành viên duy nhất rời: kênh được lưu trữ, không bị xoá.")])]),
    ("CH", "Members can start direct messages and group DMs of up to 8 people. People cannot be added to or removed from a group DM.||Thành viên mở được tin nhắn trực tiếp và group DM tối đa 8 người. Không thêm hay bớt người trong group DM được.", "Q17 G12 Q12", "FQ-20", "New message (one person only in the prototype)||New message (prototype chỉ chọn được một người)", "2.14", "BR-36, BR-37",
     [("A group of 8 people including its creator can be started; a 9th person cannot be included.||Tạo được nhóm 8 người tính cả người tạo; không đưa được người thứ 9 vào.", [("B", "8 people: created. 9: refused.||8 người: tạo được. 9: bị từ chối."), ("P", "DM with one person opens.||DM với một người mở được.")]),
      ("An existing group DM offers no way to add or remove a person.||Group DM đã có không có cách nào thêm hay bớt người.", [("N", "No such control; a direct request is refused.||Không có điều khiển này; request trực tiếp bị từ chối.")]),
      ("A guest cannot start a DM.||Guest không mở được DM.", [("N", "Guest has no New message to members (phase 5 role, rule checked now).||Guest không có New message tới thành viên (vai trò của phase 5, kiểm tra quy tắc từ bây giờ).")])]),
    ("CH", "Only an Admin or Owner can remove a person from a channel, and only in a channel they belong to.||Chỉ Admin hoặc Owner gỡ được người khỏi kênh, và chỉ trong kênh mà họ là thành viên.", "G14 Q12", "FQ-19 GQ-20", NOSCREEN, "no chart||chưa có sơ đồ", "BR-38",
     [("An Admin who is a member of a channel can remove another member from it; a Member cannot.||Admin là thành viên của kênh thì gỡ được thành viên khác; Member thì không.", [("P", "Admin in the channel removes a Member.||Admin trong kênh gỡ một Member."), ("N", "Member tries: refused.||Member thử: bị từ chối.")]),
      ("An Admin or Owner who is not in the channel cannot remove anyone from it.||Admin hoặc Owner không ở trong kênh thì không gỡ được ai khỏi đó.", [("N", "Owner outside the channel: refused.||Owner ngoài kênh: bị từ chối.")])]),
    ("LT", "A person can save messages to Later and set a reminder. A reminder time must be in the future.||Người dùng lưu được tin vào Later và đặt nhắc việc. Giờ nhắc phải ở tương lai.", "Q2 NR7", "FQ-06", "Later; message menu: Remind me||Later; menu tin nhắn: Remind me", "2.11", "",
     [("Saving a message adds it to that person's Later list only.||Lưu một tin thì thêm nó vào danh sách Later của riêng người đó.", [("P", "Save: appears in Later.||Lưu: xuất hiện trong Later."), ("N", "Another person's Later does not show it.||Later của người khác không có nó.")]),
      ("A reminder cannot be set to a time in the past.||Không đặt được nhắc việc vào giờ đã qua.", [("N", "Past time refused.||Giờ đã qua bị từ chối."), ("B", "One minute ahead accepted.||Trước một phút thì được.")])]),
    ("AD", "The Admin page opens only for Admins and Owners. An Admin invites people as Members; an Owner invites with any role.||Trang Admin chỉ mở cho Admin và Owner. Admin mời người với vai trò Member; Owner mời với vai trò nào cũng được.", "Q12 Q11", "GQ-20 FQ-03 FQ-11 FA-11 VQ-01", "Admin (members part not in the prototype)||Admin (phần thành viên không có trong prototype)", "2.12", "",
     [("A Member has no Admin entry and its address shows no admin content; the server refuses every admin request from a Member.||Member không có mục Admin và địa chỉ của nó không hiện nội dung quản trị; server từ chối mọi request quản trị từ Member.", [("N", "Member opens the Admin address: refused.||Member mở địa chỉ Admin: bị từ chối."), ("N", "Member calls an admin request directly: refused.||Member gọi thẳng một request quản trị: bị từ chối."), ("P", "Admin and Owner open it.||Admin và Owner mở được.")]),
      ("An Admin's invitation creates a Member; only an Owner can invite an Admin or Owner.||Lời mời của Admin tạo ra Member; chỉ Owner mời được Admin hoặc Owner.", [("P", "Owner invites an Admin.||Owner mời một Admin."), ("N", "Admin tries to invite as Admin: refused.||Admin thử mời với vai trò Admin: bị từ chối.")])]),
    ("AD", "Only an Owner changes roles. An Admin deactivates and reactivates Members; an Owner anyone. There can be several Owners, and the last Owner cannot be demoted or deactivated.||Chỉ Owner đổi vai trò. Admin vô hiệu hoá và kích hoạt lại Member; Owner thì với bất kỳ ai. Có thể có nhiều Owner, và Owner cuối cùng không thể bị hạ vai trò hay vô hiệu hoá.", "Q12 G6", "GQ-20 VQ-01", NOSCREEN, "2.13", "BR-27, BR-28",
     [("An Owner can change a role; an Admin cannot.||Owner đổi được vai trò; Admin thì không.", [("P", "Owner makes a Member an Admin.||Owner đưa một Member lên Admin."), ("N", "Admin tries to change a role: refused.||Admin thử đổi vai trò: bị từ chối.")]),
      ("An Admin can deactivate a Member and cannot deactivate an Admin or Owner.||Admin vô hiệu hoá được Member và không vô hiệu hoá được Admin hay Owner.", [("P", "Admin deactivates a Member.||Admin vô hiệu hoá một Member."), ("N", "Admin tries on an Owner: refused.||Admin thử với Owner: bị từ chối.")]),
      ("With one Owner left, demoting or deactivating that Owner is refused; with two, it succeeds.||Khi chỉ còn một Owner, hạ vai trò hoặc vô hiệu hoá Owner đó bị từ chối; khi có hai thì được.", [("B", "One Owner: refused. Two Owners: allowed.||Một Owner: bị từ chối. Hai Owner: được.")])]),
    ("SH", "When the connection drops, loaded content stays readable, messages being sent wait and send themselves when it returns, and every other action is blocked with an explanation.||Khi mất kết nối, nội dung đã tải vẫn đọc được, tin đang gửi thì chờ và tự gửi khi có lại mạng, và mọi hành động khác bị chặn kèm giải thích.", "NR13", "FQ-22 FA-06 FA-09 FA-17", "Offline banner, 'Waiting to send'||Banner offline, 'Waiting to send'", "3.1", "BR-30",
     [("Offline, loaded conversations can still be read and scrolled.||Khi offline, các cuộc trò chuyện đã tải vẫn đọc và cuộn được.", [("P", "Go offline: content stays.||Mất mạng: nội dung vẫn còn.")]),
      ("A message sent offline is shown as waiting and is delivered exactly once after the connection returns.||Tin gửi khi offline hiện là đang chờ và được gửi đúng một lần sau khi có lại mạng.", [("P", "Send offline, reconnect: delivered once.||Gửi khi offline, có lại mạng: tới nơi một lần."), ("X", "Connection flaps several times: still one copy.||Mạng chập chờn nhiều lần: vẫn chỉ một bản.")]),
      ("Any other action offline does not happen, does not report success, and says why.||Mọi hành động khác khi offline không xảy ra, không báo thành công, và nêu lý do.", [("N", "React offline: no reaction recorded, explanation shown.||Reaction khi offline: không ghi nhận, có giải thích."), ("N", "Join a channel offline: not joined.||Tham gia kênh khi offline: chưa tham gia.")])]),
    ("SH", "A form that has content does not close on an outside click; closing it by a button asks whether to discard.||Form đã có nội dung không đóng khi bấm ra ngoài; đóng bằng nút thì hỏi có bỏ không.", "NR4", "GQ-03", "Every dialog with fields||Mọi hộp thoại có ô nhập", "2.8", "BR-21",
     [("With text typed, an outside click leaves the form open and the text intact.||Khi đã gõ chữ, bấm ra ngoài thì form vẫn mở và chữ còn nguyên.", [("N", "Click outside: nothing lost.||Bấm ra ngoài: không mất gì.")]),
      ("With text typed, the close button asks to discard; with nothing typed it closes at once.||Khi đã gõ chữ, nút đóng hỏi có bỏ không; chưa gõ gì thì đóng ngay.", [("P", "Typed, close: asked.||Đã gõ, đóng: được hỏi."), ("B", "Empty form: closes without asking.||Form trống: đóng không hỏi.")])]),
    ("SH", "A reversible action happens at once with Undo for 5 seconds. An irreversible action, or one that affects other people, asks for confirmation and names its target. Never both.||Hành động hoàn tác được thì xảy ra ngay kèm Undo 5 giây. Hành động không hoàn tác được, hoặc ảnh hưởng tới người khác, thì hỏi xác nhận và nêu rõ đối tượng. Không bao giờ cả hai.", "NR3", "", "Toasts and confirmations||Toast và hộp xác nhận", "2.9, 2.10, 2.13", "BR-20",
     [("No action shows both a confirmation and an Undo.||Không hành động nào vừa hỏi xác nhận vừa có Undo.", [("N", "Review every destructive action: one or the other.||Rà mọi hành động phá huỷ: chỉ một trong hai.")]),
      ("Every confirmation names the thing it acts on.||Mọi hộp xác nhận đều nêu tên thứ nó tác động.", [("P", "Each confirmation contains the target's name.||Mỗi hộp xác nhận có tên đối tượng.")])]),
    ("SH", "Every searchable or filterable list has an empty state written for its context, and a count on a chip equals the rows shown. After something is created, the screen shows it.||Mọi danh sách tìm hoặc lọc được đều có trạng thái trống viết cho ngữ cảnh của nó, và số trên chip bằng số hàng đang hiện. Sau khi tạo thứ gì, màn hình hiện thứ đó.", "NR8 NR10", "", "Activity, Later, Files, People, Browse channels||Activity, Later, Files, People, Browse channels", "2.4, 2.9, 2.11", "BR-22, BR-32",
     [("A search with no result shows a message specific to that list, centred in the content area.||Tìm không ra kết quả thì hiện câu riêng cho danh sách đó, ở giữa vùng nội dung.", [("P", "No-result search in each list.||Tìm không ra ở từng danh sách.")]),
      ("For every chip with a count, the number equals the rows listed under it.||Với mọi chip có số, con số bằng số hàng liệt kê bên dưới.", [("P", "Compare count and rows for each chip.||So số đếm và số hàng ở từng chip."), ("X", "A listed item's message is deleted: count and rows still agree.||Tin của một mục bị xoá: số đếm và số hàng vẫn khớp.")]),
      ("After creating an item, it is visible without changing a filter by hand.||Sau khi tạo một mục, nó hiện ra mà không phải tự đổi bộ lọc.", [("P", "Create under a filter that would hide it: the filter changes.||Tạo khi đang lọc theo cách sẽ ẩn nó: bộ lọc tự đổi.")])]),
    ("SH", "Ctrl+K searches conversations, people, messages and actions. Vietnamese text matches when typed without diacritics.||Ctrl+K tìm cuộc trò chuyện, người, tin nhắn và thao tác. Chữ tiếng Việt khớp cả khi gõ không dấu.", "Q15 Q2", "GQ-19", "Search box 'Ctrl K', command palette||Ô Search 'Ctrl K', bảng lệnh", "1.1", "",
     [("Typing 'nguyen' finds 'Nguyễn'.||Gõ 'nguyen' thì tìm thấy 'Nguyễn'.", [("P", "Unaccented query finds accented name and message.||Từ không dấu tìm ra tên và tin có dấu."), ("P", "Accented query also finds it.||Từ có dấu cũng tìm ra.")]),
      ("Search never returns a private conversation, or a message from one, to a person who is not in it.||Tìm kiếm không bao giờ trả về cuộc trò chuyện riêng tư, hay tin trong đó, cho người không ở trong.", [("N", "Non-member searches a word used only in a private channel: no result.||Người ngoài tìm một từ chỉ dùng trong kênh riêng tư: không có kết quả.")])]),
    ("SH", "Presence turns to Away after 5 minutes without activity. There is no separate Offline state.||Trạng thái hiện diện chuyển sang Away sau 5 phút không hoạt động. Không có trạng thái Offline riêng.", "G3", "", "Presence dot on avatars||Chấm hiện diện trên avatar", "", "",
     [("A person with no activity for 5 minutes is shown as Away to others.||Người không hoạt động 5 phút thì người khác thấy là Away.", [("B", "Just under 5 minutes: active. At 5 minutes: Away.||Gần 5 phút: active. Đủ 5 phút: Away."), ("P", "Any activity returns them to active.||Có hoạt động thì về active.")])]),
]
# requirement, decided by, how it is measured
NFR = [
    ("Responsive web is the first platform. Smallest supported size is 360 × 560. Under 720 px one pane at a time; 720 to 1099 px side panels overlay the chat; from 1100 px three columns.||Web responsive là nền tảng đầu tiên. Kích thước nhỏ nhất được hỗ trợ là 360 × 560. Dưới 720 px mỗi lần một khung; từ 720 tới 1099 px panel bên phủ lên khung chat; từ 1100 px có ba cột.", "Q3 NR2 OQ5", "Every phase-1 screen checked at 360 × 560, 719, 720, 1099 and 1100 px: nothing clipped, nothing unreachable.||Mọi màn hình phase 1 kiểm ở 360 × 560, 719, 720, 1099 và 1100 px: không bị cắt, không có gì không chạm tới được."),
    ("No feature is hover-only or desktop-only; every action has an entry point on narrow and touch screens.||Không tính năng nào chỉ dùng được bằng hover hay chỉ trên desktop; mọi hành động đều có lối vào trên màn hình hẹp và cảm ứng.", "NR1 OQ4", "Every action in the test list completed on a touch device at 360 px.||Mọi hành động trong danh sách test thực hiện được trên thiết bị cảm ứng ở 360 px."),
    ("Every icon-only button has a name for screen readers; a modal traps focus and returns it to the opening button; menus work with arrow keys.||Mọi nút chỉ có icon đều có tên cho trình đọc màn hình; modal giữ focus và trả về nút đã mở; menu dùng được bằng phím mũi tên.", "NR9", "Automated check finds no unnamed button; keyboard-only run of each modal and menu.||Kiểm tra tự động không thấy nút nào thiếu tên; chạy từng modal và menu chỉ bằng bàn phím."),
    ("The first version serves one company, up to about 200 people, on one server.||Phiên bản đầu phục vụ một công ty, tới khoảng 200 người, trên một server.", "Q9 Q4", "Load test with 200 signed-in people. **No speed target is decided: VQ-02.**||Test tải với 200 người đăng nhập. **Chưa quyết định mục tiêu tốc độ: VQ-02.**"),
    ("English (default) and Vietnamese, both fully translated; two looks, Calm and Focus.||Tiếng Anh (mặc định) và tiếng Việt, cả hai dịch đầy đủ; hai look, Calm và Focus.", "Q18", "Automatic check finds no missing translation key; every screen reviewed in both languages and both looks.||Kiểm tra tự động không thấy khoá dịch nào thiếu; mọi màn hình được rà ở cả hai ngôn ngữ và hai look."),
    ("The web app is an installable PWA; its service worker is used for push only.||Ứng dụng web là PWA cài được; service worker chỉ dùng cho push.", "Q28", "Installs on the supported browsers; with the network off no stale page is served from a cache.||Cài được trên các trình duyệt hỗ trợ; khi tắt mạng không có trang cũ nào được phục vụ từ cache."),
    ("Single-tenant and self-hosted, reachable from the public internet, deployed with Docker Compose on one VPS.||Single-tenant và tự host, truy cập được từ internet công cộng, triển khai bằng Docker Compose trên một VPS.", "Q4 Q20", "A fresh server reaches a working sign-in page from the documented steps alone.||Một server mới tới được trang đăng nhập hoạt động chỉ từ các bước đã ghi trong tài liệu."),
    ("Dates and times: one format across the app; the year is shown when it is not the current year; 'Invalid Date' never appears.||Ngày giờ: một định dạng trên toàn ứng dụng; hiện năm khi không phải năm hiện tại; 'Invalid Date' không bao giờ xuất hiện.", "NR7", "Search of every screen for 'Invalid Date' with empty and odd inputs. **Which format: GQ-15.**||Tìm 'Invalid Date' trên mọi màn hình với dữ liệu trống và bất thường. **Định dạng nào: GQ-15.**"),
    ("Toasts and floating bars never cover the composer or the navigation.||Toast và thanh nổi không bao giờ che ô soạn tin hay thanh điều hướng.", "NR12", "Trigger each toast at 360 px and 1100 px: composer and navigation stay usable.||Kích từng toast ở 360 px và 1100 px: ô soạn tin và điều hướng vẫn dùng được."),
    ("Built with TypeScript, React, Postgres and WebSocket; the backend is a modular monolith in Node.||Xây bằng TypeScript, React, Postgres và WebSocket; backend là modular monolith trên Node.", "Q5 Q24b", "Repository check.||Kiểm tra repository."),
    ("Files are kept in object storage; search uses Postgres full-text.||File lưu ở object storage; tìm kiếm dùng full-text của Postgres.", "Q14 Q15", "Repository and deployment check.||Kiểm tra repository và triển khai."),
    ("Sign-in mail is sent through configurable SMTP.||Mail đăng nhập gửi qua SMTP cấu hình được.", "Q25", "Changing the SMTP settings changes the sender without a code change. **Which account: still open.**||Đổi cấu hình SMTP thì đổi người gửi mà không sửa code. **Tài khoản nào: còn mở.**"),
]
NFR_MISSING = [
    ["Speed and capacity targets||Mục tiêu tốc độ và sức tải", "VQ-02"],
    ["Backup, recovery and allowed downtime||Sao lưu, khôi phục và thời gian ngừng cho phép", "VQ-03"],
    ["Supported browsers||Trình duyệt được hỗ trợ", "GQ-11"],
    ["Storage running out||Hết dung lượng lưu trữ", "GQ-09"],
    ["Record of administrative actions||Ghi nhận hành động quản trị", "GQ-16"],
    ["Data export||Xuất dữ liệu", "GQ-17"],
    ["Behaviour when a new version is deployed||Hành vi khi triển khai bản mới", "GQ-10"],
    ["Privacy and security rules beyond permissions (how a session is stored, encryption in transit and at rest)||Quy định riêng tư và bảo mật ngoài phân quyền (phiên được lưu thế nào, mã hoá khi truyền và khi lưu)", "Technical tab; never asked of you||Tab Technical; chưa từng hỏi bạn"],
]
TECH_DEPS = [
    ["Web Push on iPhone works only for an installed web app||Web Push trên iPhone chỉ chạy khi ứng dụng web đã được cài", "FR-18 · Q28, GQ-11", "Try on a real iPhone before the notification work starts.||Thử trên iPhone thật trước khi bắt đầu phần thông báo."],
    ["Postgres full-text search matching Vietnamese without diacritics||Full-text của Postgres khớp tiếng Việt không dấu", "FR-31 · Q15", "A short trial with sample Vietnamese messages.||Thử ngắn với tin nhắn tiếng Việt mẫu."],
    ["Uploading 100 MB straight to object storage from a browser, with the size enforced by the server||Tải 100 MB thẳng lên object storage từ trình duyệt, server kiểm soát dung lượng", "FR-10 · Q14", "Trial upload on a slow connection.||Thử tải trên kết nối chậm."],
    ["Catching up after a reconnect without losing or doubling a message||Bắt kịp sau khi kết nối lại mà không mất hay trùng tin", "FR-27 · NR13", "Two-client test with the network cut mid-send.||Test hai client, cắt mạng giữa lúc gửi."],
    ["Mail delivery of sign-in codes through SMTP (speed, spam folders)||Gửi mã đăng nhập qua SMTP (tốc độ, hộp spam)", "FR-01, FR-04 · Q25", "Send to Gmail and Outlook addresses from the chosen account.||Gửi tới địa chỉ Gmail và Outlook từ tài khoản đã chọn."],
    ["200 people connected at once on one server||200 người kết nối cùng lúc trên một server", "NFR-04 · Q9", "Load test once VQ-02 gives a target.||Test tải khi VQ-02 có mục tiêu."],
]


def half(s, lang):
    return s.split("||")[0 if lang == "en" else 1] if isinstance(s, str) and "||" in s else s


def gq_rows():
    return {q[0]: q for q in GA.Q}


def open_items():
    """Every decision still required: id, question, proposal, owner, severity."""
    out = []
    for r in FQ_ROWS:
        out.append([r[0], r[1], r[3], FQ_OWNER[r[0]], FQ_SEV[r[0]]])
    for q in GA.Q:
        out.append([q[0], q[1], f"{q[3].split('||')[0]} Suggested: {q[4].split('||')[0]}||{q[3].split('||')[1]} Đề xuất: {q[4].split('||')[1]}", q[5], q[6]])
    for v in VQ:
        out.append([v[0], v[1], v[3], v[4], v[5]])
    order = {"C": 0, "H": 1, "M": 2, "L": 3}
    return sorted(out, key=lambda r: (order[r[4]], r[0]))


OPEN = open_items()
OPEN_SEV = {r[0]: r[4] for r in OPEN}


def state(fr):
    ids = fr[3].split()
    qs = [i for i in ids if not i.startswith("FA-")]
    if any(OPEN_SEV.get(i) in ("C", "H") for i in qs):
        return "B"
    if qs:
        return "Q"
    return "A" if ids else "R"


STATE = {"R": "Ready||Sẵn sàng", "A": "Ready if the assumptions are accepted||Sẵn sàng nếu chấp nhận các giả định",
         "Q": "Core ready; details wait for answers||Phần lõi sẵn sàng; chi tiết chờ trả lời", "B": "**Blocked**||**Bị chặn**"}


def build(lang, B):
    en = lang == "en"
    frs, acs, tss = [], [], []
    for i, fr in enumerate(FR, 1):
        fid = f"FR-{i:02d}"
        frs.append((fid, fr))
        for crit, tests in fr[7]:
            aid = f"AC-{len(acs) + 1:03d}"
            acs.append((aid, fid, crit))
            for typ, txt in tests:
                tss.append((f"TS-{len(tss) + 1:03d}", aid, fid, typ, txt))
    states = {fid: state(fr) for fid, fr in frs}
    n_state = {k: sum(1 for v in states.values() if v == k) for k in "RAQB"}
    by_type = {k: sum(1 for t in tss if t[3] == k) for k in "PNBX"}
    blockers = [r for r in OPEN if r[4] in ("C", "H")]
    n_raw = len(B["gaps"]) + len(GA.F) + len(FQ_ROWS) + len(GA.Q) + len(FA_ROWS) + len(GA.A) + len(VQ)
    confirmed = [("Q", "decisions", len(B["decisions"])), ("G", "assumptions", len(B["assumptions"])),
                 ("OQ", "questions", len(B["questions"])), ("NR", "rules", len(B["rules"]))]
    n_conf = sum(c[2] for c in confirmed)
    n_assumed = len(FA_ROWS) + len(GA.A)
    deferred = [p for p in B["phases"] if str(p["id"]) != "1"]

    def decided_cell(ids):
        parts = []
        for sid in ids.split():
            kind, q, a = FM.qa(sid, lang)
            parts.append(f"{a} ({sid})")
        return " · ".join(parts)

    flow_rows = []
    for ch in CHARTS:
        num = ch.m["title"].split(" ")[0]
        ids = FM.CITE[num].split()
        dec = [i for i in ids if FM.qa(i, "en")[0] in ("decided", "rule") and i not in FM.TECH]
        ass = [i for i in ids if i.startswith("FA-")]
        opn = [i for i in ids if i[:2] in ("FQ", "GQ")]
        nd = sum(1 for n in ch.m["nodes"] if n["kind"] == "decision")
        nx = sum(1 for n in ch.m["nodes"] if n["kind"] == "error")
        hard = [i for i in opn if OPEN_SEV.get(i) in ("C", "H")]
        verdict = ("**Blocked** by ||**Bị chặn** bởi " if hard else "Valid with open details||Hợp lệ, còn chi tiết mở" if opn or ass else "Valid||Hợp lệ")
        if hard:
            verdict = half(verdict, lang) + ", ".join(hard)
        flow_rows.append([half(ch.m["title"], lang), f"{nd} · {nx}", ", ".join(dec) or "—", ", ".join(ass) or "—", ", ".join(opn) or "—", half(verdict, lang)])

    not_drawn = [f for f in B["flows"] if str(f.get("phase")) == "1"]
    S = [
        {"title": "Requirement clarification and validation||Làm rõ và kiểm định yêu cầu",
         "intro": f"This tab brings the prototype analysis, the gap analysis, the open questions and the assumptions together and asks one thing: **are the requirements ready to build?** It takes {n_raw} raw findings, questions and assumptions, merges them into {len(T)} findings, separates what you decided ({n_conf} answers) from what is assumed ({n_assumed}) and what is open ({len(OPEN)}), and writes requirements only from what you decided: {len(frs)} functional, {len(NFR)} non-functional, {len(acs)} acceptance criteria and {len(tss)} test scenarios.||Tab này gom phân tích prototype, phân tích gap, các câu hỏi mở và các giả định lại và hỏi một điều: **yêu cầu đã sẵn sàng để làm chưa?** Nó lấy {n_raw} phát hiện, câu hỏi và giả định thô, gộp thành {len(T)} phát hiện, tách những gì bạn đã quyết định ({n_conf} câu trả lời) khỏi những gì đang giả định ({n_assumed}) và còn mở ({len(OPEN)}), và chỉ viết yêu cầu từ những gì bạn đã quyết định: {len(frs)} yêu cầu chức năng, {len(NFR)} phi chức năng, {len(acs)} tiêu chí chấp nhận và {len(tss)} kịch bản test.",
         "blocks": [
             {"type": "note", "text": f"**Verdict: not ready as a whole.** {n_state['R'] + n_state['A']} of {len(frs)} functional requirements can start ({n_state['R']} ready, {n_state['A']} once their assumptions are accepted); {n_state['Q']} have a ready core with details waiting; {n_state['B']} are blocked by {len(blockers)} high-priority questions. No development ticket is generated from this tab; the 96 tickets on the Plan tab stay drafts until section 9 clears them.||**Kết luận: chưa sẵn sàng trên tổng thể.** {n_state['R'] + n_state['A']} trên {len(frs)} yêu cầu chức năng bắt đầu được ({n_state['R']} sẵn sàng, {n_state['A']} khi các giả định được chấp nhận); {n_state['Q']} có phần lõi sẵn sàng, chi tiết đang chờ; {n_state['B']} bị chặn bởi {len(blockers)} câu hỏi ưu tiên cao. Tab này không sinh ticket phát triển nào; 96 ticket ở tab Plan vẫn là bản nháp cho tới khi mục 9 cho qua."},
             {"type": "table", "head": ["Output||Kết quả", "Count||Số lượng", "Section||Mục"], "rows": [
                 ["Findings backlog||Backlog phát hiện", f"{len(T)} (from {n_raw})||{len(T)} (từ {n_raw})", "1"],
                 ["Requirement decisions||Quyết định về yêu cầu", f"{n_conf} confirmed · {n_assumed} assumed · {len(OPEN)} open||{n_conf} đã chốt · {n_assumed} giả định · {len(OPEN)} còn mở", "2"],
                 ["User flows validated||User flow đã kiểm định", str(len(CHARTS)), "3"],
                 ["Business rules||Quy tắc nghiệp vụ", str(len(BR_ROWS)), "4"],
                 ["Functional · non-functional requirements||Yêu cầu chức năng · phi chức năng", f"{len(frs)} · {len(NFR)}", "5"],
                 ["Acceptance criteria||Tiêu chí chấp nhận", str(len(acs)), "6"],
                 ["Test scenarios||Kịch bản test", str(len(tss)), "7"],
                 ["Traceability matrix||Ma trận truy vết", f"{len(frs)} rows||{len(frs)} dòng", "8"],
                 ["Readiness report||Báo cáo sẵn sàng", "", "9"]]}]},
        {"title": "1 · Findings backlog||1 · Backlog phát hiện",
         "intro": f"Everything found so far, merged so each problem appears once: the 39 gaps from walking the prototype, the {len(GA.F)} findings of the gap analysis, the questions (FQ, GQ) and the assumptions (FA, AS). Ordered by severity, then by what it costs the business.||Mọi thứ đã tìm ra cho tới nay, gộp lại để mỗi vấn đề chỉ xuất hiện một lần: 39 gap khi đi qua prototype, {len(GA.F)} phát hiện của phân tích gap, các câu hỏi (FQ, GQ) và các giả định (FA, AS). Xếp theo mức độ, rồi theo thiệt hại với công việc.",
         "blocks": [
             {"type": "table", "head": ["ID||ID", "Finding||Phát hiện", "Merges||Gộp từ", "Category||Nhóm", "Severity||Mức độ", "Business impact||Ảnh hưởng", "Owner||Phụ trách", "Depends on · status||Phụ thuộc · tình trạng"],
              "rows": [[t[0], t[1], t[2].replace(" ", ", "), GA.CAT[t[3]], SEV[t[4]], t[5], t[6], t[7]] for t in sorted(T, key=lambda t: "CHML".index(t[4]))]},
             {"type": "h", "text": "Duplicates removed||Trùng lặp đã gộp"},
             {"type": "table", "head": ["Same problem||Cùng một vấn đề", "Recorded as||Đã ghi nhận là", "Kept in||Giữ ở"], "rows": DUPES},
             {"type": "h", "text": "Conflicting findings||Phát hiện mâu thuẫn nhau"},
             {"type": "table", "head": ["Topic||Chủ đề", "The prototype||Prototype", "Against||Đối lập với", "Standing||Tình trạng"], "rows": CONFLICTS},
             {"type": "h", "text": "Dependencies||Phụ thuộc"},
             {"type": "table", "head": ["This must be settled first||Việc này phải xong trước", "Because it holds up||Vì nó giữ chân"], "rows": DEPENDS}]},
        {"title": "2 · Requirement decisions||2 · Quyết định về yêu cầu",
         "intro": "Three kinds, kept apart: what you decided, what is assumed and waits for a yes, and what is open. Only the first kind becomes a requirement.||Ba loại, để riêng: những gì bạn đã quyết định, những gì đang giả định và chờ đồng ý, và những gì còn mở. Chỉ loại đầu trở thành yêu cầu.",
         "blocks": [
             {"type": "h", "text": f"Confirmed ({n_conf})||Đã chốt ({n_conf})"},
             {"type": "table", "head": ["Kind||Loại", "Count||Số lượng", "Where||Ở đâu"], "rows": [
                 ["Answers in the question rounds (Q1 to Q31)||Câu trả lời ở các vòng hỏi (Q1 tới Q31)", str(len(B["decisions"])), "Questions & Gaps||Questions & Gaps"],
                 ["Assumptions you confirmed (G1 to G16)||Giả định bạn đã xác nhận (G1 tới G16)", str(len(B["assumptions"])), "Requirements||Requirements"],
                 ["Review questions answered (OQ1 to OQ17)||Câu hỏi review đã trả lời (OQ1 tới OQ17)", str(len(B["questions"])), "Questions & Gaps||Questions & Gaps"],
                 ["Rules made from gaps (NR1 to NR13)||Quy tắc rút ra từ gap (NR1 tới NR13)", str(len(B["rules"])), "Requirements||Requirements"]]},
             {"type": "h", "text": f"Decisions required from stakeholders ({len(OPEN)})||Quyết định cần từ các bên ({len(OPEN)})"},
             {"type": "p", "text": "Every open question in one list: those raised while drawing flows (FQ), in the gap analysis (GQ) and by this validation (VQ). The proposal is a suggestion and is used nowhere until you agree.||Mọi câu hỏi còn mở trong một danh sách: các câu nảy ra khi vẽ flow (FQ), trong phân tích gap (GQ) và từ lần kiểm định này (VQ). Đề xuất chỉ là gợi ý và không được dùng ở đâu cho tới khi bạn đồng ý."},
             {"type": "table", "head": ["ID||ID", "Decision needed||Cần quyết định", "Proposal||Đề xuất", "Who decides||Ai quyết định", "Priority||Ưu tiên"],
              "rows": [[r[0], r[1], r[2], r[3], SEV[r[4]]] for r in OPEN]},
             {"type": "h", "text": f"Assumptions awaiting a yes ({n_assumed})||Giả định chờ đồng ý ({n_assumed})"},
             {"type": "table", "head": ["ID||ID", "Assumed||Đang giả định", "Used in||Dùng ở", "Why this value||Vì sao chọn vậy"],
              "rows": [[r[0], r[1], r[2], r[3]] for r in FA_ROWS] + [[a[0], a[1], "—", a[2]] for a in GA.A]}]},
        {"title": "3 · User flow validation||3 · Kiểm định user flow",
         "intro": f"Each of the {len(CHARTS)} charts on the Flows tab, checked against the confirmed decisions. Today's review already corrected them (entry points that did not exist, values shown as decided, the offline wording). 'Decisions · errors' counts the branching points and the refusal or error states drawn. A chart is blocked when a high-priority question decides its shape.||Từng sơ đồ trong {len(CHARTS)} sơ đồ ở tab Flows, đối chiếu với các quyết định đã chốt. Lần rà hôm nay đã sửa chúng (lối vào không tồn tại, giá trị ghi như đã chốt, câu chữ offline). 'Quyết định · lỗi' đếm số điểm rẽ nhánh và số trạng thái từ chối hoặc lỗi đã vẽ. Sơ đồ bị chặn khi một câu hỏi ưu tiên cao quyết định hình dạng của nó.",
         "blocks": [
             {"type": "table", "head": ["Flow||Flow", "Decisions · errors||Quyết định · lỗi", "Built on (confirmed)||Dựa trên (đã chốt)", "Assumes||Đang giả định", "Open||Còn mở", "Result||Kết quả"], "rows": flow_rows},
             {"type": "note", "text": f"**Checked by script:** every decision has at least two answers drawn, every step is reachable, and no step stops without being an end or a stated refusal. **Not covered by a chart:** the {len(not_drawn)} written phase-1 flows include journeys with no chart yet, among them first set-up by the first Owner, adding people to a channel, removing a member, archiving a channel, threads, reactions, pins, Activity, Files, People, Preferences and status. They are written step by step on the Flows tab and wait on VQ-01.||**Được script kiểm tra:** mọi quyết định có ít nhất hai câu trả lời được vẽ, mọi bước đều tới được, và không bước nào dừng lại mà không phải điểm kết thúc hoặc lần từ chối có ghi rõ. **Chưa có sơ đồ:** {len(not_drawn)} flow viết của phase 1 gồm cả những hành trình chưa có sơ đồ, trong đó có thiết lập lần đầu bởi Owner đầu tiên, thêm người vào kênh, gỡ thành viên, lưu trữ kênh, thread, reaction, ghim, Activity, Files, People, Preferences và trạng thái. Chúng được viết từng bước ở tab Flows và đang chờ VQ-01."}]},
        {"title": "4 · Business rules||4 · Quy tắc nghiệp vụ",
         "intro": "The rules the flows and requirements rely on. Each names the decision behind it; a rule whose source is 'Technical' comes from the technical design and was not a question put to you.||Các quy tắc mà flow và yêu cầu dựa vào. Mỗi quy tắc nêu quyết định đứng sau nó; quy tắc có nguồn 'Technical' đến từ thiết kế kỹ thuật và chưa phải là câu hỏi đã đặt cho bạn.",
         "blocks": [{"type": "table", "head": ["ID||ID", "Rule||Quy tắc", "Flows||Flow", "Decided by||Quyết định bởi"], "rows": BR_ROWS}]},
        {"title": "5 · Functional and non-functional requirements||5 · Yêu cầu chức năng và phi chức năng",
         "intro": "Phase 1 only. Each functional requirement states only what you decided, with the answer quoted in 'Decided by'. Anything still assumed or open that touches it is listed beside it and is **not** part of the requirement.||Chỉ phase 1. Mỗi yêu cầu chức năng chỉ nêu những gì bạn đã quyết định, kèm câu trả lời được trích ở cột 'Quyết định bởi'. Những gì còn giả định hoặc còn mở liên quan tới nó được ghi bên cạnh và **không** thuộc yêu cầu.",
         "blocks": [
             {"type": "h", "text": f"Functional requirements ({len(frs)})||Yêu cầu chức năng ({len(frs)})"},
             {"type": "table", "head": ["ID||ID", "Area||Mảng", "Requirement||Yêu cầu", "Decided by||Quyết định bởi", "Not yet decided||Chưa quyết định", "Readiness||Mức sẵn sàng"],
              "rows": [[fid, AREA[fr[0]], fr[1], decided_cell(fr[2]), fr[3].replace(" ", ", ") or "—", STATE[states[fid]]] for fid, fr in frs]},
             {"type": "h", "text": f"Non-functional requirements ({len(NFR)})||Yêu cầu phi chức năng ({len(NFR)})"},
             {"type": "table", "head": ["ID||ID", "Requirement||Yêu cầu", "Decided by||Quyết định bởi", "How it is measured||Đo bằng cách nào"],
              "rows": [[f"NFR-{i:02d}", n[0], n[1].replace(" ", ", "), n[2]] for i, n in enumerate(NFR, 1)]},
             {"type": "h", "text": "Non-functional areas with no decision||Mảng phi chức năng chưa có quyết định"},
             {"type": "p", "text": "These cannot be written as requirements, because nothing measurable was decided.||Các mảng này chưa viết thành yêu cầu được, vì chưa có gì đo được được quyết định."},
             {"type": "table", "head": ["Area||Mảng", "Waits on||Chờ"], "rows": NFR_MISSING}]},
        {"title": "6 · Acceptance criteria||6 · Tiêu chí chấp nhận",
         "intro": "Each criterion can be checked with a yes or a no. Numbers come from the decisions; a criterion that would need an undecided number is left out and listed under missing coverage in section 7.||Mỗi tiêu chí kiểm được bằng có hoặc không. Các con số lấy từ quyết định; tiêu chí nào cần một con số chưa quyết định thì không viết, và được liệt kê ở phần thiếu độ phủ của mục 7.",
         "blocks": [{"type": "table", "head": ["ID||ID", "Requirement||Yêu cầu", "Criterion||Tiêu chí"], "rows": [[a, f, c] for a, f, c in acs]}]},
        {"title": "7 · QA test scenarios||7 · Kịch bản test cho QA",
         "intro": f"{len(tss)} scenarios, each tied to one criterion: {by_type['P']} positive, {by_type['N']} negative, {by_type['B']} boundary, {by_type['X']} exception. Every criterion has at least one.||{len(tss)} kịch bản, mỗi cái gắn với một tiêu chí: {by_type['P']} tích cực, {by_type['N']} phủ định, {by_type['B']} biên, {by_type['X']} ngoại lệ. Tiêu chí nào cũng có ít nhất một kịch bản.",
         "blocks": [
             {"type": "table", "head": ["ID||ID", "Criterion||Tiêu chí", "Requirement||Yêu cầu", "Type||Loại", "Scenario||Kịch bản"], "rows": [[t[0], t[1], t[2], TT[t[3]], t[4]] for t in tss]},
             {"type": "h", "text": "Missing test coverage||Độ phủ test còn thiếu"},
             {"type": "table", "head": ["What cannot be tested yet||Chưa test được gì", "Why||Vì sao", "Waits on||Chờ"], "rows": [
                 ["Expiry of a sign-in code; lock after wrong tries||Mã đăng nhập hết hạn; khoá sau nhiều lần sai", "No decided number||Chưa có con số được quyết định", "FA-13, FA-14"],
                 ["Session renewal on use||Phiên gia hạn khi dùng", "Not decided whether 30 days counts from sign-in or last use||Chưa quyết định 30 ngày tính từ lúc đăng nhập hay lần dùng cuối", "FA-15"],
                 ["Every error, loading and retry state||Mọi trạng thái lỗi, đang tải và thử lại", "No decided behaviour; flow 3.3 is a proposal||Chưa có hành vi được quyết định; flow 3.3 là đề xuất", "FA-08, FA-02, GQ-03, FQ-21"],
                 ["Mention in a muted conversation; 'Nothing' against Mute||Mention trong cuộc trò chuyện đã tắt tiếng; 'Nothing' so với Mute", "Open||Còn mở", "GQ-01, GQ-02"],
                 ["Links, reload and browser Back||Link, tải lại và Back của trình duyệt", "Open||Còn mở", "GQ-06"],
                 ["Sign out, signed-in devices, session ended||Sign out, thiết bị đã đăng nhập, hết phiên", "Only in written flows||Chỉ có trong flow viết", "VQ-01"],
                 ["The full permission matrix: one test per row and role||Toàn bộ bảng quyền: mỗi dòng và mỗi vai trò một test", "The table is not signed off; only the rules in FR-13, FR-19, FR-22, FR-23, FR-25, FR-26 are covered||Bảng chưa được duyệt; mới phủ các quy tắc ở FR-13, FR-19, FR-22, FR-23, FR-25, FR-26", "GQ-20"],
                 ["Two people or two devices at once: live updates, typing, unread across devices||Hai người hoặc hai thiết bị cùng lúc: cập nhật trực tiếp, đang gõ, chưa đọc giữa các thiết bị", "Cannot be observed in the prototype; no decision on conflicts||Không quan sát được trong prototype; chưa có quyết định về xung đột", "FQ-02, GQ-13"],
                 ["Speed, load, backup and recovery||Tốc độ, tải, sao lưu và khôi phục", "No target||Chưa có mục tiêu", "VQ-02, VQ-03"],
                 ["Phase-1 features with no requirement written here: threads, reactions, pins, Activity filters, Files, People, Preferences, status, typing indicator||Tính năng phase 1 chưa có yêu cầu ở đây: thread, reaction, ghim, bộ lọc Activity, Files, People, Preferences, trạng thái, chỉ báo đang gõ", "In scope by Q2 and Q17 and described in written flows, but with no decision of their own to write a criterion from||Thuộc phạm vi theo Q2 và Q17 và có trong flow viết, nhưng chưa có quyết định riêng để viết tiêu chí", "VQ-01"]]}]},
        {"title": "8 · Requirements traceability matrix||8 · Ma trận truy vết yêu cầu",
         "intro": "One row per functional requirement, from the screen in the prototype to the tests. An empty rule cell means the requirement comes straight from a decision with no numbered rule.||Mỗi yêu cầu chức năng một dòng, từ màn hình trong prototype tới các test. Ô quy tắc trống nghĩa là yêu cầu đến thẳng từ một quyết định, không qua quy tắc có đánh số.",
         "blocks": [{"type": "table", "head": ["UI screen||Màn hình", "User flow||User flow", "Business rule||Quy tắc", "Requirement||Yêu cầu", "Acceptance criteria||Tiêu chí chấp nhận", "Test scenarios||Kịch bản test"],
                     "rows": [[fr[4], fr[5] or "—", fr[6] or "—", fid,
                               ", ".join(a for a, f, _ in acs if f == fid),
                               ", ".join(t[0] for t in tss if t[2] == fid)] for fid, fr in frs]}]},
        {"title": "9 · Development readiness report||9 · Báo cáo sẵn sàng phát triển",
         "intro": "Whether building can start, and what stands in the way.||Đã bắt đầu làm được chưa, và điều gì đang cản.",
         "blocks": [
             {"type": "table", "head": ["Item||Hạng mục", "Count||Số lượng", "Detail||Chi tiết"], "rows": [
                 ["Resolved findings||Phát hiện đã giải quyết", "39 + 5", "The 39 prototype gaps each have a required behaviour (T-11); 4 conflicts settled by NR3, Q13, OQ2, Q18; display name settled by Q31.||39 gap của prototype đều có hành vi yêu cầu (T-11); 4 mâu thuẫn được giải quyết bởi NR3, Q13, OQ2, Q18; tên hiển thị được chốt bởi Q31."],
                 ["Remaining open questions||Câu hỏi còn mở", str(len(OPEN)), f"{len(blockers)} high priority (below), {len(OPEN) - len(blockers)} medium or low. Section 2.||{len(blockers)} ưu tiên cao (bên dưới), {len(OPEN) - len(blockers)} trung bình hoặc thấp. Mục 2."],
                 ["Accepted assumptions||Giả định đã chấp nhận", str(len(B["assumptions"]) + 1), "G1 to G16, and AS-05 (demo-only controls never ship).||G1 tới G16, và AS-05 (điều khiển chỉ để demo không lên sản phẩm)."],
                 ["Assumptions not yet accepted||Giả định chưa được chấp nhận", str(n_assumed - 1), "FA-01 to FA-17 and AS-01 to AS-08 except AS-05. Section 2.||FA-01 tới FA-17 và AS-01 tới AS-08 trừ AS-05. Mục 2."],
                 ["Deferred requirements||Yêu cầu hoãn lại", f"{len(deferred)} phases||{len(deferred)} phase", " · ".join(f"{p['id']}: {p['name']}" for p in deferred)],
                 ["Critical blockers||Điểm chặn nghiêm trọng", "3", "T-01 (no way in is designed), T-02 (no member management), T-03 (permissions unsigned).||T-01 (chưa thiết kế lối vào), T-02 (chưa có quản lý thành viên), T-03 (phân quyền chưa duyệt)."]]},
             {"type": "h", "text": f"High-priority questions that block work ({len(blockers)})||Câu hỏi ưu tiên cao đang chặn công việc ({len(blockers)})"},
             {"type": "table", "head": ["ID||ID", "Decision needed||Cần quyết định", "Who decides||Ai quyết định", "Holds up||Giữ chân"],
              "rows": [[r[0], r[1], r[3], ", ".join(fid for fid, fr in frs if r[0] in fr[3].split()) or "—"] for r in blockers]},
             {"type": "h", "text": "Readiness by requirement||Mức sẵn sàng theo yêu cầu"},
             {"type": "table", "head": ["Readiness||Mức sẵn sàng", "Requirements||Yêu cầu", "What it means||Nghĩa là"], "rows": [
                 [STATE["R"], ", ".join(f for f, s in states.items() if s == "R") or "—", "Fully decided; can be specified and built.||Đã quyết định đủ; viết spec và làm được."],
                 [STATE["A"], ", ".join(f for f, s in states.items() if s == "A") or "—", "Buildable once you say yes to the assumptions listed beside it.||Làm được khi bạn đồng ý với các giả định ghi bên cạnh."],
                 [STATE["Q"], ", ".join(f for f, s in states.items() if s == "Q") or "—", "The decided part can be built; the open detail must be answered before its ticket closes.||Phần đã quyết định làm được; chi tiết còn mở phải được trả lời trước khi đóng ticket."],
                 [STATE["B"], ", ".join(f for f, s in states.items() if s == "B") or "—", "A high-priority question decides its screens or rules. Do not start.||Một câu hỏi ưu tiên cao quyết định màn hình hoặc quy tắc của nó. Chưa bắt đầu."]]},
             {"type": "h", "text": "Dependencies that need technical validation||Phụ thuộc cần kiểm chứng kỹ thuật"},
             {"type": "table", "head": ["To prove||Cần chứng minh", "Affects||Ảnh hưởng tới", "How||Bằng cách"], "rows": TECH_DEPS},
             {"type": "note", "text": f"**What clears the gate.** (1) Answer the {len(blockers)} high-priority questions, or accept the proposal for each in writing. (2) Say yes or no to the unaccepted assumptions. (3) Add the missing screens to the prototype for T-01 to T-05, or accept that they are designed during the build. After that this tab is regenerated, the blocked requirements move up, and tickets can be drawn from the requirements. Until then the 96 draft tickets on the Plan tab are not confirmed work.||**Điều gì mở được cổng.** (1) Trả lời {len(blockers)} câu hỏi ưu tiên cao, hoặc chấp nhận bằng văn bản đề xuất cho từng câu. (2) Đồng ý hoặc không với các giả định chưa được chấp nhận. (3) Bổ sung vào prototype các màn hình còn thiếu cho T-01 tới T-05, hoặc chấp nhận rằng chúng được thiết kế trong lúc làm. Sau đó tab này được sinh lại, các yêu cầu bị chặn được nâng lên, và ticket có thể rút ra từ yêu cầu. Cho tới lúc đó 96 ticket nháp ở tab Plan chưa phải là công việc đã chốt."}]},
    ]
    return {"sections": deep(S, lang), "open": len(blockers)}


for lang in LANGS:
    p = HERE / f"blueprint.{lang}.json"
    B = json.loads(p.read_text(encoding="utf-8"))
    B["validation"] = build(lang, B)
    if lang == "vi":
        B.setdefault("meta", {}).setdefault("labels", {})["Validation"] = "Kiểm định"
    p.write_text(json.dumps(B, ensure_ascii=False, indent=1), encoding="utf-8")
    v = B["validation"]
    print(f"{p.name}: validation written · {len(v['sections'])} sections · {v['open']} blocking questions")
