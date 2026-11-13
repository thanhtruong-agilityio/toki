#!/usr/bin/env python3
"""Builds toki-blueprint-v2.html: the Blueprint reorganised into nine tabs that follow the BA & QA workflow.

A proposal for review. It reads the v1 sources in ../blueprint and does not change them.
What v2 changes: one decision log (D-001…) instead of nine id series, one findings backlog, requirements and
QA as their own tabs, and a plan that follows the readiness of the requirements.
Run:   python3 build.py
"""
import base64, contextlib, io, json, pathlib, re, sys

HERE = pathlib.Path(__file__).parent
BP = HERE.parent / "blueprint"
sys.path.insert(0, str(BP))
before = {l: (BP / f"blueprint.{l}.json").read_text(encoding="utf-8") for l in ("en", "vi")}
with contextlib.redirect_stdout(io.StringIO()):
    import gen_validation as GV
for l, text in before.items():          # the generators rewrite the data files on import; put them back exactly
    (BP / f"blueprint.{l}.json").write_text(text, encoding="utf-8")
GA, FM = GV.GA, GV.FM
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
old_ids = [d["id"] for d in B_EN["decisions"]] + [a["id"] for a in B_EN["assumptions"]] + [q["id"] for q in B_EN["questions"]] + \
          [r["id"] for r in B_EN["rules"]] + [r[0] for r in GV.OPEN] + [r[0] for r in GV.FA_ROWS] + [a[0] for a in GA.A]
NEW = {o: f"D-{i:03d}" for i, o in enumerate(old_ids, 1)}
ID_RE = re.compile(r"\b(OQ\d{1,2}|NR\d{1,2}|FA-\d{2}|FQ-\d{2}|GQ-\d{2}|AS-\d{2}|VQ-\d{2}|Q\d{1,2}[abc]?|G\d{1,2})\b")
sub = lambda s: ID_RE.sub(lambda m: NEW.get(m.group(1), m.group(1)), s)


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

    def add(old, kind, q, a, owner="", sev="", status="Confirmed"):
        dec.append(dict(id=NEW[old], old=old, kind=kind, q=q, a=a, owner=owner, sev=sev, status=status))

    for d in B["decisions"]:
        add(d["id"], "ans", d["question"], d["decision"], "PO")
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
                ts.append(dict(id=f"TS-{n_ts:03d}", type=typ, text=en(txt)))
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
        built="13 Nov 2026" if lang == "en" else "13/11/2026", overview=B["overview"], counts=dict(actions=151),
        screens=[dict(name=en(s[0]), purpose=en(s[1]), actions=en(s[2]), phase=en(s[3])) for s in GA.SCREENS],
        findings=findings, dupes=en(GV.DUPES), conflicts=en(GV.CONFLICTS), depends=en(GV.DEPENDS),
        decisions=dec, charts=charts,
        written=[dict(id=f["id"], group=f["group"], title=f["title"], roles=f["roles"], context=f.get("context", ""), steps=f["steps"], cases=f.get("cases", [])) for f in B["flows"] if str(f["phase"]) == "1"],
        scope=B["requirements"]["sections"][0]["blocks"], roles=B["roles"], capabilities=B["capabilities"], states=B["states"],
        rules=[en(r) for r in GV.BR_ROWS], frs=frs,
        nfr=[dict(id=f"NFR-{i:02d}", text=en(n[0]), src=n[1].replace(" ", ", "), measure=en(n[2])) for i, n in enumerate(GV.NFR, 1)],
        nfrMissing=en(GV.NFR_MISSING), techDeps=en(GV.TECH_DEPS), technical=B["technical"]["sections"],
        milestones=milestones, phases=[dict(id=p["id"], name=p["name"], delivers=p.get("delivers", ""), state=p.get("state", "")) for p in B["phases"]],
    )
    out = remap(out)
    tf = lambda x: re.sub(r"\bT-(\d\d)\b", r"F-\1", x) if isinstance(x, str) else [tf(i) for i in x] if isinstance(x, list) else x
    for f in out["findings"]:                      # the merged findings are F-01… in v2
        f["note"] = tf(f["note"]).replace("Questions & Gaps", "Decisions")
    out["decisions"] = [dict(d, q=tf(d["q"]), a=tf(d["a"])) for d in out["decisions"]]
    return out


data = {l: build(l) for l in ("en", "vi")}
proto = base64.b64encode((BP / "prototype" / "index.html").read_bytes()).decode("ascii")
html = (HERE / "template.html").read_text(encoding="utf-8") \
    .replace("/*DATA*/null", json.dumps(data, ensure_ascii=False).replace("</", "<\\/")) \
    .replace("/*APP*/", (HERE / "app.js").read_text(encoding="utf-8")).replace("__PROTO_B64__", proto)
(HERE / "toki-blueprint-v2.html").write_text(html, encoding="utf-8")
d = data["en"]
print(f"toki-blueprint-v2.html · {len(html) // 1024} KB · en + vi · {len(d['decisions'])} decisions · {len(d['findings'])} findings · {len(d['charts'])} charts · {len(d['frs'])} FR · {sum(len(a['tickets']) for m in d['milestones'] for a in m['areas'])} tickets")
