#!/usr/bin/env bash
# Says whether the QA record of a ticket passes QA. No network, no model.
# Usage (from the repository root): bash .github/scripts/qa-ready.sh <KEY>
# Reads docs/qa/<KEY>.md and the spec it names. Passes when all of:
#   - the header has Ticket (the key), Spec (a file that exists), Version and Environment;
#   - the test matrix has the columns ID, Requirement, Layer, Steps, Expected, Evidence,
#     Priority, Approved, Result, Run;
#   - every requirement (R1, R2, ...) of the spec has a row or an entry under "## Not covered";
#   - every row names a requirement of the spec, a valid Layer and a concrete Expected;
#   - every row is approved, run and Pass, and a Pass row has Evidence; a row that is not
#     run, Fail or Blocked is not passed.
# Prints one "- " line per gap. Exit 0: passes QA. Exit 1: gaps. Exit 2: wrong usage.
set -uo pipefail

key="${1:-}"
[ -n "$key" ] || { echo "usage: qa-ready.sh <KEY>" >&2; exit 2; }
rec="docs/qa/$key.md"
[ -f "$rec" ] || { echo "no QA record: $rec" >&2; exit 2; }

gaps=0
gap() { echo "- $1"; gaps=$((gaps + 1)); }

header() { sed -n "s/^$1:[[:space:]]*\(.*[^[:space:]]\)[[:space:]]*$/\1/p" "$rec" | head -1; }
section() { # $1 file, $2 heading; prints the body of that "## " section
  awk -v h="$2" '/^## /{on = (index($0, "## " h) == 1); next} on' "$1"
}

ticket=$(header Ticket)
spec=$(header Spec)
if [ -z "$ticket" ]; then gap "the record has no \`Ticket:\` line"
elif [ "$ticket" != "$key" ]; then gap "\`Ticket:\` is $ticket, the file is $key.md"; fi
if [ -z "$spec" ]; then gap "the record has no \`Spec:\` line"
elif [ ! -f "$spec" ]; then gap "the spec does not exist: $spec"; fi
[ -n "$(header Version)" ] || gap "the record has no \`Version:\` line"
[ -n "$(header Environment)" ] || gap "the record has no \`Environment:\` line"

reqs=""
if [ -n "$spec" ] && [ -f "$spec" ]; then
  reqs=$(section "$spec" "Requirements" | sed -n 's/^-[[:space:]]*\(R[0-9][0-9]*\)\..*/\1/p' | tr '\n' ' ')
fi
notcov=$(section "$rec" "Not covered" | sed -n 's/^-[[:space:]]*\(R[0-9][0-9]*\)\..*/\1/p' | tr '\n' ' ')

out=$(section "$rec" "Test matrix" | awk -v reqs="$reqs" -v nc="$notcov" '
  function trim(s) { gsub(/^[ \t\r]+|[ \t\r]+$/, "", s); return s }
  function gap(m) { print "- " m }
  BEGIN {
    n = split(reqs, a, " "); for (i = 1; i <= n; i++) inspec[a[i]] = 1
    n = split(nc, a, " "); for (i = 1; i <= n; i++) excused[a[i]] = 1
    split("ID Requirement Layer Steps Expected Evidence Priority Approved Result Run", need, " ")
    split("works work ok correct correctly pass passes fine good", v, " ")
    for (i in v) { vague[v[i]] = 1 }
    vague["as expected"] = 1; vague["displays correctly"] = 1
  }
  /^[ \t]*\|/ {
    if ($0 ~ /^[ \t]*\|[-: |\t]+\|?[ \t\r]*$/) next
    nc2 = split($0, c, "|")
    if (!hdr) {
      hdr = 1
      for (i = 2; i < nc2; i++) col[trim(c[i])] = i
      for (i = 1; i <= 10; i++) if (!(need[i] in col)) { gap("the matrix has no column " need[i]); bad = 1 }
      next
    }
    if (bad) next
    id = trim(c[col["ID"]]); req = trim(c[col["Requirement"]]); lay = trim(c[col["Layer"]])
    xp = trim(c[col["Expected"]]); ev = trim(c[col["Evidence"]])
    ap = trim(c[col["Approved"]]); res = trim(c[col["Result"]]); run = trim(c[col["Run"]])
    if (id == "") id = "(row without ID)"
    if (id in seen) gap(id " is used twice"); seen[id] = 1
    split(req, rt, /[ (,]/); r = rt[1]
    if (r !~ /^R[0-9]+$/) gap(id " names no requirement (R1, R2, ...)")
    else if (!(r in inspec)) gap(id " names " r ", which the spec does not have")
    else covered[r] = 1
    if (lay !~ /^(unit|integration|api|e2e|command|manual)$/) gap(id " has a layer that is not allowed: \"" lay "\"")
    low = tolower(xp); gsub(/[ \t.]+$/, "", low)
    if (low == "" || (low in vague)) gap(id " has an Expected that is not a concrete value: \"" xp "\"")
    if (res == "") gap(id " has not been run")
    else if (res !~ /^(Pass|Fail|Blocked)$/) gap(id " has a Result that is not allowed: \"" res "\"")
    else {
      if (ap == "") gap(id " has a Result and no Approved")
      if (run == "") gap(id " has a Result and no Run")
      if (res == "Pass" && ev == "") gap(id " is Pass with no Evidence")
      if (res == "Fail") gap(id " is Fail")
      if (res == "Blocked") gap(id " is Blocked, which is not passed")
    }
  }
  END {
    if (!hdr) { gap("the record has no test matrix"); exit }
    n = split(reqs, a, " ")
    for (i = 1; i <= n; i++) if (!(a[i] in covered) && !(a[i] in excused)) gap(a[i] " has no test case and no reason")
  }')
awk_rc=$?
[ "$awk_rc" -eq 0 ] || gap "the test matrix could not be read"
if [ -n "$out" ]; then
  printf '%s\n' "$out"
  gaps=$((gaps + $(printf '%s\n' "$out" | wc -l)))
fi

[ "$gaps" -eq 0 ] && echo "ok - passes QA"
[ "$gaps" -eq 0 ]
