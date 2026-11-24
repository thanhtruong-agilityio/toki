#!/usr/bin/env python3
"""Copy the state of each ticket from GitHub into both Blueprint data files.

For every ticket of the plan it writes:
  status  the logical status key of docs/ticket-config.yml (done, in-review, in-dev, accepted, blocked, ...),
          or removes the key when the ticket has no issue yet. The labels on the tracker lag behind the code,
          so a ticket is "done" when its issue is closed or a pull request from its ticket branch
          (`<type>/toki-NNN-slug`, not `spec/` or `docs/`) is merged, whatever its label says
  issue   the number of the GitHub issue
  spec.state  "merged" when the spec pull request named in spec.pr is merged

It also writes meta.ticketsSynced (the day of the run). Needs an authenticated gh.
Run it from docs/blueprint, then rebuild the page (see README.md).
"""
import datetime
import json
import pathlib
import re
import subprocess
import sys

HERE = pathlib.Path(__file__).parent
REPO = "thanhtruong-agilityio/toki"
# order matters when an issue carries two status labels: the later stage wins
ORDER = ["intent", "blocked", "spec-review", "accepted", "in-dev", "in-review", "in-qa", "done"]


def gh(*args):
    return json.loads(subprocess.run(["gh", *args, "--repo", REPO], check=True, capture_output=True, text=True).stdout)


def status_names():
    """logical key -> name on the tracker, from the statuses block of ticket-config.yml"""
    text = (HERE.parent / "ticket-config.yml").read_text(encoding="utf-8")
    block = re.search(r"^statuses:.*?\n((?:[ \t]+.*\n)+)", text, re.M).group(1)
    return {k: v.strip() for k, v in re.findall(r"^\s+([\w-]+):\s*([^#\n]+)", block, re.M)}


def main():
    names = status_names()
    by_name = {v: k for k, v in names.items()}
    issues = gh("issue", "list", "--state", "all", "--limit", "500", "--json", "number,title,state,labels")
    prs = gh("pr", "list", "--state", "all", "--limit", "500", "--json", "number,state,headRefName")
    merged = set()          # tickets whose code is in main
    for p in prs:
        m = re.match(r"(?:feat|fix|chore|test|refactor|ci|perf|build)/([a-z]+)-(\d+)-", p["headRefName"])
        if m and p["state"] == "MERGED":
            merged.add(f"{m.group(1).upper()}-{m.group(2)}")
    prs = {p["number"]: p["state"] for p in prs}

    tickets, stale = {}, []
    for i in issues:
        m = re.search(r"\(([A-Z]+-\d+)\)\s*$", i["title"])
        if not m:
            continue
        keys = [by_name[l["name"]] for l in i["labels"] if l["name"] in by_name]
        status = max(keys, key=ORDER.index) if keys else "intent"
        if i["state"] == "CLOSED" or m.group(1) in merged:
            if status != "done":
                stale.append(f"{m.group(1)} #{i['number']} ({names[status]}, {'closed' if i['state'] == 'CLOSED' else 'open'})")
            status = "done"
        tickets[m.group(1)] = dict(status=status, issue=i["number"])

    today = datetime.date.today().isoformat()
    seen = set()
    for lang in ("en", "vi"):
        path = HERE / f"blueprint.{lang}.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        prefix = data["meta"].get("ticketPrefix", "")
        count = {}
        for ms in data["milestones"]:
            for area in ms["areas"]:
                for t in area["tickets"]:
                    hit = tickets.get(prefix + t["id"])
                    seen.add(prefix + t["id"])
                    t.pop("status", None)
                    t.pop("issue", None)
                    if hit:
                        t.update(hit)
                    count[hit["status"] if hit else "none"] = count.get(hit["status"] if hit else "none", 0) + 1
                    spec = t.get("spec")
                    n = re.search(r"#(\d+)", (spec or {}).get("pr", ""))
                    if n and prs.get(int(n.group(1))) == "MERGED":
                        spec["state"] = "merged"
        data["meta"]["ticketsSynced"] = today
        path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"blueprint.{lang}.json ·", " · ".join(f"{k} {v}" for k, v in sorted(count.items(), key=lambda x: -x[1])))
    if stale:
        print("code merged but the tracker says otherwise:", "; ".join(sorted(stale)), file=sys.stderr)
    extra = sorted(set(tickets) - seen)
    if extra:
        print("on the tracker but not in the plan:", " ".join(extra), file=sys.stderr)


if __name__ == "__main__":
    main()
