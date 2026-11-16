#!/usr/bin/env bash
# Says whether a merged spec is ready for a ticket. No network, no model.
# Usage (from the repository root): bash .github/scripts/spec-ready.sh <spec.md>
# Ready means all of:
#   - the spec has a `Ticket:` line and an `Intent:` line, and the intent file exists;
#   - no line of "Open questions from the intent" says "Not answered" without
#     carrying the question forward to a numbered concern;
#   - every item of "Areas of concern" records a decision ("Decided", "Answered",
#     "Accepted" or "Settled") after its last open marker ("Not decided",
#     "Not answered", "not a decision").
# Prints one "- " line per gap and one "note:" line per assumption (notes do not block). Exit 0: ready. Exit 1: gaps. Exit 2: wrong usage.
set -uo pipefail

spec="${1:-}"
[ -f "$spec" ] || { echo "usage: spec-ready.sh <spec.md>" >&2; exit 2; }

gaps=0
gap() { echo "- $1"; gaps=$((gaps + 1)); }
short() { local s="$1"; [ "${#s}" -gt 140 ] && s="${s:0:140}..."; printf '%s' "$s"; }

section() { # $1 heading prefix; prints the body of that "## " section
  awk -v h="$1" '/^## /{on = (index($0, "## " h) == 1); next} on' "$spec"
}

ticket=$(sed -n 's/^Ticket:[[:space:]]*\([A-Za-z0-9_-]*\).*/\1/p' "$spec" | head -1)
intent=$(sed -n 's/^Intent:[[:space:]]*\([^[:space:]]*\).*/\1/p' "$spec" | head -1)

[ -n "$ticket" ] || gap "the spec has no \`Ticket:\` line"
if [ -z "$intent" ]; then
  gap "the spec has no \`Intent:\` line"
elif [ ! -f "$intent" ]; then
  gap "the intent file does not exist: $intent"
fi

[ -n "$(section "Requirements" | tr -d '[:space:]')" ] || gap "the spec has no Requirements section"

# Open questions: "Not answered" is fine only when the line hands over to a concern.
while IFS= read -r line; do
  [[ "$line" =~ ^[[:space:]]*-[[:space:]] ]] || continue
  printf '%s' "$line" | grep -qi 'not answered' || continue
  printf '%s' "$line" | grep -qiE 'concern [0-9]+' && continue
  gap "open question not answered: $(short "${line#*- }")"
done <<< "$(section "Open questions")"

# Areas of concern: one item per numbered line; following lines belong to the item.
concerns=$(section "Areas of concern" | awk '
  /^[0-9]+\. / { if (item != "") print item; item = $0; next }
  /^[ \t]*$/ { next }
  item != "" { item = item " " $0 }
  END { if (item != "") print item }')
# An item is settled when its last decision word comes after its last open marker,
# so "X is not decided. ... Decided: Y." is settled and "Decided: Y. Not decided: Z." is open.
verdicts=$(printf '%s\n' "$concerns" | awk '
  function lastpos(s, re,   off, r) {
    off = 0; r = 0
    while (match(substr(s, off + 1), re)) { r = off + RSTART; off = off + RSTART + RLENGTH - 1 }
    return r
  }
  /^[0-9]+\. / {
    n = $0; sub(/\..*/, "", n)
    text = $0; sub(/^[0-9]+\. /, "", text)
    open = lastpos(tolower($0), "not decided|not answered|not a decision")
    s = $0; gsub(/Answered in part/, "answered in part", s)  # not a decision by itself
    done = lastpos(s, "Decided|Answered|Accepted|Settled")
    if (open == 0 && done == 0) print "none\t" n "\t" text
    else if (open > done) print "open\t" n "\t" text
  }')
while IFS=$'\t' read -r kind n text; do
  case "$kind" in
    open) gap "concern $n is still open: $(short "$text")" ;;
    none) gap "concern $n records no decision: $(short "$text")" ;;
  esac
done <<< "$verdicts"

# Assumptions do not block: merging the spec accepts them. They are listed for the reader.
while IFS= read -r hit; do
  [ -n "$hit" ] || continue
  echo "note: assumption at line ${hit%%:*}: $(short "${hit#*:}")"
done <<< "$(grep -nE '(^|[^A-Za-z])Assumption[.:]' "$spec")"

[ "$gaps" -eq 0 ] && echo "ok - ready for a ticket"
[ "$gaps" -eq 0 ]
