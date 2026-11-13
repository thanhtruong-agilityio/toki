#!/usr/bin/env python3
"""Writes page.en.json and page.vi.json: the data of the nine-tab Blueprint page.

It reads the generators and data files in ../blueprint and does not change them. It gives every question,
answer, rule and assumption one id in a single decision log (D-001 onward; the earlier id is kept beside it),
merges the findings into one backlog, and links plan areas to the requirements they build.

Run:   python3 gen_page.py
Then:  python3 ~/.claude/skills/prototype-blueprint/scripts/build_page.py --data en=page.en.json --data vi=page.vi.json \\
           --prototype ../blueprint/prototype/index.html --out toki-blueprint.html --title "Toki Blueprint"
"""
import contextlib, io, json, pathlib, re, sys

HERE = pathlib.Path(__file__).parent
BP = HERE.parent / "blueprint"
sys.path.insert(0, str(BP))
before = {l: (BP / f"blueprint.{l}.json").read_text(encoding="utf-8") for l in ("en", "vi")}
with contextlib.redirect_stdout(io.StringIO()):
    import gen_validation as GV
for l, text in before.items():          # the generators rewrite the data files on import; put them back exactly
    (BP / f"blueprint.{l}.json").write_text(text, encoding="utf-8")
GA, FM = GV.GA, GV.FM
from test_details import DETAILS          # preconditions ## steps ## expected result, one entry per test, in order
assert len(DETAILS) == sum(len(t) for fr in GV.FR for _, t in fr[7]), "test_details.py is out of step with the tests in gen_validation.py"
P2S = {"P0": "C", "P1": "H", "P2": "M", "P3": "L"}


def pick(x, lang):
    if isinstance(x, str):
        return x.split("||")[0 if lang == "en" else 1] if "||" in x else x
    if isinstance(x, (list, tuple)):
        return [pick(i, lang) for i in x]
    return x


# ───────── one decision log: every earlier id gets one new id ─────────
B_EN = json.loads(before["en"])
ORDER = {"C": 0, "H": 1, "M": 2, "L": 3}
RESOLVE = FM.RESOLVE          # an earlier open question or assumption -> the decision that settled it; the row keeps
# its D id and becomes that decision. Decisions that settle nothing earlier get new ids.
SETTLING = set(RESOLVE.values())
FIRST = [d["id"] for d in B_EN["decisions"] if int(re.sub(r"\D", "", d["id"])) <= 31]      # the decisions that had ids before 13 Nov
LATER = [d["id"] for d in B_EN["decisions"] if d["id"] not in FIRST and d["id"] not in SETTLING]
old_ids = FIRST + [a["id"] for a in B_EN["assumptions"]] + [q["id"] for q in B_EN["questions"]] + \
          [r["id"] for r in B_EN["rules"]] + [r[0] for r in GV.OPEN] + [r[0] for r in GV.FA_ROWS] + [a[0] for a in GA.A] + LATER
NEW = {o: f"D-{i:03d}" for i, o in enumerate(old_ids, 1)}
for old, q in RESOLVE.items():
    NEW.setdefault(q, NEW[old])                  # a settling decision is cited by the id of the row it settled
ID_RE = re.compile(r"\b(OQ\d{1,2}|NR\d{1,2}|FA-\d{2}|FQ-\d{2}|GQ-\d{2}|AS-\d{2}|VQ-\d{2}|Q\d{1,2}[abc]?|G\d{1,2})\b")
sub = lambda s: ID_RE.sub(lambda m: NEW.get(m.group(1), m.group(1)), s)


OPEN_ID = re.compile(r"\b(FQ-\d{2}|GQ-\d{2}|VQ-\d{2}|FA-\d{2})\b")


def settle(x):
    """A text that says 'Open: GQ-03' is stale once every id in it has been settled: say 'Decided' instead."""
    if isinstance(x, str):
        ids = OPEN_ID.findall(x)
        if ids and all(i in RESOLVE for i in ids):
            for a, b in (("**Open:**", "**Decided:**"), ("Open:", "Decided:"), ("**Còn mở:**", "**Đã quyết định:**"), ("Còn mở:", "Đã quyết định:"),
                         ("still open", "now decided"), ("còn mở", "đã quyết định")):
                x = x.replace(a, b)
        return x
    if isinstance(x, list):
        return [settle(i) for i in x]
    if isinstance(x, dict):
        return {k: settle(v) for k, v in x.items()}
    return x


def remap(x):
    """Replace every earlier decision id in display text by its new id. In SVG, only inside text nodes."""
    if isinstance(x, str):
        if x.lstrip().startswith("<svg"):
            return re.sub(r">([^<]+)<", lambda m: ">" + sub(m.group(1)) + "<", x)
        return sub(x)
    if isinstance(x, list):
        return [remap(i) for i in x]
    if isinstance(x, dict):
        return {k: (v if k in ("old", "id") else remap(v)) for k, v in x.items()}
    return x


CHANGES = [
    ["Nine id series for questions and assumptions across four tabs||Chín dãy mã cho câu hỏi và giả định rải trên bốn tab", "One decision log, D-001 onward, each with a status. The earlier id stays in its own column.||Một sổ quyết định, từ D-001, mỗi mục có trạng thái. Mã cũ nằm ở một cột riêng.", "One place answers 'what is still open?'||Một nơi trả lời 'còn gì chưa chốt?'"],
    ["Gaps in two lists, merged again in a third||Gap ở hai danh sách, gộp lại ở danh sách thứ ba", "One findings backlog of 15; the 72 detailed observations open inside each.||Một backlog 15 phát hiện; 72 quan sát chi tiết mở ra bên trong từng mục.", "Each problem appears once||Mỗi vấn đề chỉ xuất hiện một lần"],
    ["Three analysis tabs that overlapped||Ba tab phân tích chồng lên nhau", "Findings → Decisions → Requirements → QA, the order of the BA & QA workflow.||Phát hiện → Quyết định → Yêu cầu → QA, đúng thứ tự của quy trình BA & QA.", "Tabs follow what the reader needs next||Tab đi theo thứ người đọc cần tiếp theo"],
    ["The Flows tab also held rules, assumptions and questions||Tab Flows chứa cả quy tắc, giả định và câu hỏi", "Flows holds charts and written journeys only.||Flows chỉ chứa sơ đồ và hành trình đã viết.", "A tab does one job||Mỗi tab làm một việc"],
    ["Plan, Milestones and Roadmap: three tabs, written before validation||Plan, Milestones và Roadmap: ba tab, viết trước khi kiểm định", "One Plan tab that opens with the readiness gate; each area shows the requirements it builds and whether it may start.||Một tab Kế hoạch mở đầu bằng cổng sẵn sàng; mỗi mảng cho thấy các yêu cầu nó thực hiện và đã bắt đầu được chưa.", "The plan follows the requirements||Kế hoạch đi sau yêu cầu"],
]

# area of the v1 plan -> the requirements it builds (area level; ticket level is the next step)
AREA_FR = {"Sign-in and members": "FR-01 FR-02 FR-03 FR-04 FR-06 FR-25 FR-26", "Conversations": "FR-05 FR-07 FR-19 FR-20 FR-21 FR-22 FR-23",
           "Messages and realtime": "FR-09 FR-11 FR-12 FR-13 FR-27", "Chat features": "FR-14 FR-17", "Unread and presence": "FR-08 FR-32",
           "Files": "FR-10", "Search": "FR-31", "Activity and Later": "FR-14 FR-24", "Notifications": "FR-15 FR-16 FR-18",
           "Preferences, People and polish": "FR-28 FR-29 FR-30"}


def build(lang):
    en = lambda x: pick(x, lang)
    B = json.loads(before[lang])
    kinds = {}
    dec = []

    def add(old, kind, q, a, owner="", sev="", status="Confirmed", **kw):
        dec.append(dict(id=NEW[old], old=old, kind=kind, q=q, a=a, owner=owner, sev=sev, status=status, **kw))

    byq = {d["id"]: d for d in B["decisions"]}
    for d in B["decisions"]:
        if d["id"] in FIRST:
            add(d["id"], "ans", d["question"], d["decision"], "PO", topic=d.get("topic", ""), options=d.get("options", ""), source=d.get("source", ""))
    for a in B["assumptions"]:
        add(a["id"], "gas", en(FM.G_QUESTION.get(a["id"], "")), a["text"], "PO")
    for q in B["questions"]:
        add(q["id"], "rev", q["question"], q["answer"], "PO")
    for r in B["rules"]:
        add(r["id"], "rule", r["from"], r["text"], "BA")
    for r in GV.OPEN:
        add(r[0], "q", en(r[1]), en(r[2]), r[3], r[4], "Open")
    for r in GV.FA_ROWS:
        add(r[0], "asm", en(r[1]), en(r[3]), "PO", "M", "Open")
    for a in GA.A:
        add(a[0], "asm", en(a[1]), en(a[2]), "PO", "L", "Accepted Assumption" if a[0] == "AS-05" else "Open")
    for i in LATER:
        d = byq[i]
        add(i, "rev", d["question"], d["decision"], "PO", topic=d.get("topic", ""), options=d.get("options", ""), source=d.get("source", ""), note=d.get("note", ""))
    rows = {r["old"]: r for r in dec}
    acc = B.get("acceptedAssumptions", {})
    for i in acc.get("ids", []):                 # assumptions the user accepted: they stand as decisions
        rows[i].update(status="Accepted Assumption", sev="", note=acc.get("note", ""))
    for old, q in RESOLVE.items():               # the settled rows take the answer and its standing
        d, r = byq[q], rows[old]
        r.update(kind="rev", a=d["decision"], sev="", status="Deferred" if d.get("source") == "deferred" else "Confirmed",
                 old=f"{old} · {q}", topic=d.get("topic", ""), source=d.get("source", ""), note=d.get("note", ""))

    detail = {f[0]: dict(id=f[0], text=en(f[1]), evidence=en(f[2]), type=en(GA.TYP[f[4]]), sev=f[5], status=en(f[7])) for f in GA.F}
    for g in B["gaps"]:
        _, t_, _ = GA.OLD[g["id"]].split()
        detail[g["id"]] = dict(id=g["id"], text=g["title"], evidence=g["requirement"], type=en(GA.TYP[t_]), sev=P2S[g["severity"]], status="")
    findings = []
    for t in GV.T:
        m = t[2].split()
        if m and m[0].startswith("GAP-01…"):
            m = [g["id"] for g in B["gaps"]]
        findings.append(dict(id=t[0].replace("T-", "F-"), text=en(t[1]), cat=en(GA.CAT[t[3]]), sev=t[4], impact=en(t[5]), owner=t[6], note=en(t[7]),
                             details=[detail[i] for i in m if i in detail], decisions=[NEW[i] for i in m if i in NEW]))

    charts, cur = [], None
    for sec in B["flowsTab"]["sections"][1:4]:
        for bl in sec["blocks"]:
            if bl["type"] == "h":
                cur = dict(title=bl["text"], id=bl["text"].split(" ")[0], group=sec["title"], notes=[], sources=[])
                charts.append(cur)
            elif bl["type"] == "svg":
                cur["svg"], cur["caption"] = bl["svg"], bl.get("caption", "")
            elif bl["type"] == "list":
                cur["notes"] = bl["items"]
            elif bl["type"] == "fold":
                cur["sources"] = bl["items"]
    for c in charts:
        ids = FM.CITE[c["id"]].split()
        c["open"] = [NEW[i] for i in ids if i[:2] in ("FQ", "GQ", "FA")]

    frs, n_ac, n_ts = [], 0, 0
    for i, fr in enumerate(GV.FR, 1):
        acs = []
        for crit, tests in fr[7]:
            n_ac += 1
            ts = []
            for typ, txt in tests:
                n_ts += 1
                given, steps, expect = [x.strip() for x in en(DETAILS[n_ts - 1]).split("##")]
                ts.append(dict(id=f"TS-{n_ts:03d}", type=typ, text=en(txt), given=given, steps=steps, expect=expect))
            acs.append(dict(id=f"AC-{n_ac:03d}", text=en(crit), tests=ts))
        frs.append(dict(id=f"FR-{i:02d}", area=en(GV.AREA[fr[0]]), text=en(fr[1]),
                        decided=[dict(ref=NEW[s], a=FM.qa(s, lang)[2]) for s in fr[2].split()],
                        open=[NEW[s] for s in fr[3].split()], screen=en(fr[4]), flows=en(fr[5]), rules=fr[6], acs=acs))

    B_en = B_EN
    milestones = []
    for m, m_en in zip(B["milestones"], B_en["milestones"]):
        areas = []
        for a, a_en in zip(m["areas"], m_en["areas"]):
            areas.append(dict(name=a["name"], frs=AREA_FR.get(a_en["name"], "").split(),
                              tickets=[dict(id=B["meta"].get("ticketPrefix", "") + t["id"], title=t["title"], scope=t["scope"], size=t["size"]) for t in a["tickets"]]))
        milestones.append(dict(id=m["id"], name=m["name"], goal=m["goal"], exit=m["exit"], areas=areas))

    out = dict(
        product="Toki",
        prototypeNote=en("It simulates one person, always an Owner, with sample data and instant actions.||Nó mô phỏng một người, luôn là Owner, với dữ liệu mẫu và thao tác tức thì."),
        writtenNote=en("Drafted by Claude under Q19. On 13 Nov 2026 eight journeys were rewritten (F02, F03, F20, F21, F25, F39, F40, F41) and the other 35 of phase 1 were read against the decisions; 16 of them were corrected. Four choices found in them are covered by no decision and are still to be confirmed: the sign-in button in the sign-in mail (F04), sign out and the list of signed-in devices (F06), Undo after leaving a private channel (F23), and the emergency sign-in link (F43).||Do Claude soạn theo Q19. Ngày 13/11/2026 tám hành trình đã được viết lại (F02, F03, F20, F21, F25, F39, F40, F41) và 35 hành trình còn lại của phase 1 đã được đọc đối chiếu với các quyết định; 16 trong số đó đã được sửa. Có bốn lựa chọn trong đó chưa quyết định nào phủ tới và còn cần xác nhận: nút đăng nhập trong mail đăng nhập (F04), sign out và danh sách thiết bị đã đăng nhập (F06), Undo sau khi rời kênh riêng tư (F23), và link đăng nhập khẩn cấp (F43)."),
        changes=dict(title=en("How this page was reorganised on 13 Nov 2026||Trang này được sắp xếp lại thế nào ngày 13/11/2026"),
                     head=en(["Before||Trước đây", "Now||Bây giờ", "Why||Vì sao"]), rows=[en(r) for r in CHANGES]),
        built="13 Nov 2026" if lang == "en" else "13/11/2026", overview=B["overview"], counts=dict(actions=151),
        screens=[dict(name=en(s[0]), purpose=en(s[1]), actions=en(s[2]), phase=en(s[3])) for s in GA.SCREENS],
        findings=findings, dupes=en(GV.DUPES), conflicts=en(GV.CONFLICTS), depends=en(GV.DEPENDS),
        decisions=dec, charts=charts,
        written=[dict(id=f["id"], group=f["group"], title=f["title"], roles=f["roles"], context=f.get("context", ""), steps=f["steps"], cases=f.get("cases", []), phase=f["phase"]) for f in B["flows"]],
        scope=B["requirements"]["sections"][0]["blocks"], roles=B["roles"], capabilities=B["capabilities"], states=B["states"], eventMatrix=B.get("eventMatrix"),
        reqMore=B["requirements"]["sections"][1:], stillOpen=B.get("open", []), tagline=B["meta"].get("tagline", ""),
        intents=B.get("intents", []), plan=B.get("plan", {}), roadmapOutro=(B.get("roadmap") or {}).get("outro", ""),
        rules=[en(r) for r in GV.BR_ROWS], frs=frs,
        nfr=[dict(id=f"NFR-{i:02d}", text=en(n[0]), src=n[1].replace(" ", ", "), measure=en(n[2])) for i, n in enumerate(GV.NFR, 1)],
        nfrMissing=en(GV.NFR_MISSING), techDeps=en(GV.TECH_DEPS), technical=B["technical"]["sections"],
        milestones=milestones, phases=[dict(id=p["id"], name=p["name"], delivers=p.get("delivers", ""), state=p.get("state", "")) for p in B["phases"]],
    )
    out = settle(out)
    out = remap(out)
    for d in out["decisions"]:                    # "Raised as D-081 (D-081)." says nothing once the row is that id
        if d.get("note"):
            d["note"] = re.sub(r"(Raised as|Nêu ở) D-\d+ \(D-\d+\)\.\s*", "", d["note"]).strip()
    tf = lambda x: re.sub(r"\bT-(\d\d)\b", r"F-\1", x) if isinstance(x, str) else [tf(i) for i in x] if isinstance(x, list) else x
    for f in out["findings"]:                      # the merged findings are F-01… in v2
        f["note"] = tf(f["note"]).replace("Questions & Gaps", "Decisions")
    out["decisions"] = [dict(d, q=tf(d["q"]), a=tf(d["a"])) for d in out["decisions"]]
    return out


for lang in ("en", "vi"):
    d = build(lang)
    (HERE / f"page.{lang}.json").write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"page.{lang}.json · {len(d['decisions'])} decisions · {len(d['findings'])} findings · {len(d['charts'])} charts · {len(d['frs'])} FR · {sum(len(a['tickets']) for m in d['milestones'] for a in m['areas'])} tickets")
