#!/usr/bin/env python3
"""Builds ba-qa-workflow.html: the BA & QA workflow as a working page, filled with the Toki findings.

Reads the Blueprint generators in ../blueprint (it does not change the Blueprint) template.html and app.js here.
Run:   python3 build.py
"""
import contextlib, io, json, pathlib, sys

HERE = pathlib.Path(__file__).parent
BP = HERE.parent / "blueprint"
sys.path.insert(0, str(BP))
before = {l: (BP / f"blueprint.{l}.json").read_text(encoding="utf-8") for l in ("en", "vi")}
with contextlib.redirect_stdout(io.StringIO()):
    import gen_validation as GV
for l, text in before.items():          # the generators rewrite the data files on import; put them back exactly
    (BP / f"blueprint.{l}.json").write_text(text, encoding="utf-8")
(BP / "flowmaps.json").write_text((BP / "flowmaps.json").read_text(encoding="utf-8"), encoding="utf-8")

GA, FM = GV.GA, GV.FM
def pick(x, lang):
    if isinstance(x, str):
        return x.split("||")[0 if lang == "en" else 1] if "||" in x else x
    if isinstance(x, (list, tuple)):
        return [pick(i, lang) for i in x]
    return x


P2S = {"P0": "C", "P1": "H", "P2": "M", "P3": "L"}
TXT = {"seen": "Seen while walking through the prototype||Thấy khi đi qua prototype", "resolved": "Resolved: ||Đã giải quyết: ",
       "answer": "Answer||Câu trả lời", "cassume": "Confirmed assumption||Giả định đã xác nhận", "review": "Review answer||Trả lời khi review",
       "rule": "Rule||Quy tắc", "rulefrom": "Rule made from ||Quy tắc rút ra từ "}


def build(lang):
    en = lambda x: pick(x, lang)
    tx = lambda k: pick(TXT[k], lang)
    B = json.loads(before[lang])
    findings = [dict(id=f[0], text=en(f[1]), evidence=en(f[2]), cat=en(GA.CAT[f[3]]), type=en(GA.TYP[f[4]]), sev=f[5], status=en(f[7])) for f in GA.F]
    for g in B["gaps"]:
        c, t_, _ = GA.OLD[g["id"]].split()
        findings.append(dict(id=g["id"], text=g["title"], evidence=tx("seen"), cat=en(GA.CAT[c]), type=en(GA.TYP[t_]), sev=P2S[g["severity"]], status=tx("resolved") + g["requirement"]))
    questions = [dict(id=r[0], q=en(r[1]), proposal=en(r[2]), owner=r[3], sev=r[4]) for r in GV.OPEN]
    assumptions = [dict(id=r[0], text=en(r[1]), used=en(r[2]), why=en(r[3])) for r in GV.FA_ROWS] + \
                  [dict(id=a[0], text=en(a[1]), used="—", why=en(a[2])) for a in GA.A]
    confirmed = [dict(id=d["id"], q=d["question"], a=d["decision"], kind=tx("answer")) for d in B["decisions"]] + \
                [dict(id=a["id"], q=en(FM.G_QUESTION.get(a["id"], "")), a=a["text"], kind=tx("cassume")) for a in B["assumptions"]] + \
                [dict(id=q["id"], q=q["question"], a=q["answer"], kind=tx("review")) for q in B["questions"]] + \
                [dict(id=r["id"], q=tx("rulefrom") + r["from"], a=r["text"], kind=tx("rule")) for r in B["rules"]]
    flows = []
    for ch in GV.CHARTS:
        num = ch.m["title"].split(" ")[0]
        ids = FM.CITE[num].split()
        flows.append(dict(id=num, title=en(ch.m["title"]).split(" ", 1)[1],
                          decisions=sum(1 for n in ch.m["nodes"] if n["kind"] == "decision"),
                          errors=sum(1 for n in ch.m["nodes"] if n["kind"] == "error"), steps=len(ch.m["nodes"]),
                          decided=[i for i in ids if FM.qa(i, "en")[0] in ("decided", "rule") and i not in FM.TECH],
                          open=[i for i in ids if i[:2] in ("FQ", "GQ", "FA")]))
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
                        decided=[dict(id=s, a=FM.qa(s, lang)[2]) for s in fr[2].split()],
                        open=fr[3].split(), screen=en(fr[4]), flows=en(fr[5]), rules=fr[6], acs=acs))
    return dict(
        product="Toki", built="13 Nov 2026" if lang == "en" else "13/11/2026",
        counts=dict(actions=151, roles=len(B["roles"]), writtenFlows=len(B["flows"])),
        screens=[dict(name=en(s[0]), purpose=en(s[1]), actions=en(s[2]), phase=en(s[3])) for s in GA.SCREENS],
        missingFlows=en(GA.MF), findings=findings, questions=questions, assumptions=assumptions, confirmed=confirmed,
        triage=[dict(id=t_[0], text=en(t_[1]), merges=t_[2].split(), cat=en(GA.CAT[t_[3]]), sev=t_[4], impact=en(t_[5]), owner=t_[6], note=en(t_[7])) for t_ in GV.T],
        dupes=en(GV.DUPES), conflicts=en(GV.CONFLICTS), depends=en(GV.DEPENDS),
        flows=flows, rules=[en(r) for r in GV.BR_ROWS], frs=frs,
        nfr=[dict(id=f"NFR-{i:02d}", text=en(n[0]), src=n[1].replace(" ", ", "), measure=en(n[2])) for i, n in enumerate(GV.NFR, 1)],
        nfrMissing=en(GV.NFR_MISSING), techDeps=en(GV.TECH_DEPS),
        deferred=[dict(id=p["id"], name=p["name"], delivers=p.get("delivers", "")) for p in B["phases"] if str(p["id"]) != "1"],
    )


data = {l: build(l) for l in ("en", "vi")}
d = data["en"]
html = (HERE / "template.html").read_text(encoding="utf-8").replace("/*DATA*/null", json.dumps(data, ensure_ascii=False).replace("</", "<\\/")).replace("/*APP*/", (HERE / "app.js").read_text(encoding="utf-8"))
(HERE / "ba-qa-workflow.html").write_text(html, encoding="utf-8")
print(f"ba-qa-workflow.html · {len(html) // 1024} KB · en + vi · {len(d['findings'])} findings · {len(d['questions'])} questions · {len(d['frs'])} FR")
