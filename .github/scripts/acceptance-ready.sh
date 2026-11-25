#!/usr/bin/env bash
# Says whether an acceptance record is well formed and, when its verdict is Accepted,
# whether the proof stands. No network, no model.
# Usage (from the repository root): bash .github/scripts/acceptance-ready.sh <slug> [--ready]
# Outcome record docs/acceptance/<slug>.md:
#   header Outcome, Milestone, Tickets; sections "Success Criteria" (- SC1. ...),
#   "Confirmed" (BA, a name and a date), "Results" (columns SC, Tickets, Evidence, Verdict,
#   Reason) and "Verdict" (Accepted, Not accepted or Pending, then "By: BA, <name>").
#   Evidence cites a QA row as <KEY>:<ID>. Confirmed must not be later than any run date.
#   Accepted needs every criterion Accepted and every ticket of the header to pass qa-ready.sh.
# Milestone record docs/acceptance/milestone-<m>.md:
#   header Milestone, Outcomes (slugs); sections "Exit check" (- EC1. ...), "Results"
#   (columns EC, Evidence, Verdict, Reason) and "Verdict". Accepted needs every outcome
#   Accepted and evidence for every exit-check part.
# With --ready: prints "ready" or "not ready" and one "- " line for each ticket of the header
# that has no QA record or does not pass qa-ready.sh (the list the BA works from).
# Prints one "- " line per gap. Exit 0: no gap (or ready). Exit 1: gaps. Exit 2: wrong usage.
set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
slug="${1:-}"
mode="${2:-}"
[ -n "$slug" ] || { echo "usage: acceptance-ready.sh <slug> [--ready]" >&2; exit 2; }
case "$mode" in ""|--ready) ;; *) echo "usage: acceptance-ready.sh <slug> [--ready]" >&2; exit 2 ;; esac
rec="docs/acceptance/$slug.md"
[ -f "$rec" ] || { echo "no acceptance record: $rec" >&2; exit 2; }

US=$'\037'
gaps=0
gap() { echo "- $1"; gaps=$((gaps + 1)); }

header() { sed -n "s/^$1:[[:space:]]*\(.*[^[:space:]]\)[[:space:]]*$/\1/p" "${2:-$rec}" | head -1; }
section() { awk -v h="$2" '/^## /{on = (index($0, "## " h) == 1); next} on' "$1"; }
# table <file> <heading> <columns>: one line per row, cells joined by US; "!col" for a missing column
table() {
  section "$1" "$2" | awk -v want="$3" '
    function trim(s) { gsub(/^[ \t\r]+|[ \t\r]+$/, "", s); return s }
    BEGIN { nw = split(want, w, " ") }
    /^[ \t]*\|/ {
      if ($0 ~ /^[ \t]*\|[-: |\t]+\|?[ \t\r]*$/) next
      n = split($0, c, "|")
      if (!hdr) {
        hdr = 1
        for (i = 2; i < n; i++) col[trim(c[i])] = i
        for (i = 1; i <= nw; i++) if (!(w[i] in col)) { print "!" w[i]; bad = 1 }
        next
      }
      if (bad) next
      line = ""
      for (i = 1; i <= nw; i++) line = line (i > 1 ? "\037" : "") trim(c[col[w[i]]])
      print line
    }'
}
verdict_word() { # first word(s) of the Verdict section of $1
  section "$1" "Verdict" | sed -n '/[^[:space:]]/{s/^[[:space:]]*//;p;q;}' | sed -En 's/^(Accepted|Not accepted|Pending).*/\1/p'
}
keys() { printf '%s' "$1" | tr ',' ' ' | tr -s ' ' '\n' | sed '/^$/d'; }
has_section() { grep -q "^## $2" "$1"; }
sec_order() { # $1 file, rest: headings in the required order; reports missing and misordered
  local f="$1" prev=0 h ln; shift
  for h in "$@"; do
    ln=$(grep -n "^## $h" "$f" | head -1 | cut -d: -f1)
    if [ -z "$ln" ]; then gap "the record has no \`## $h\` section"
    else
      [ "$ln" -gt "$prev" ] || gap "the sections are not in this order: $*"
      prev="$ln"
    fi
  done
}

tickets=""
check_outcome() {
  local o m t
  o=$(header Outcome); m=$(header Milestone); t=$(header Tickets)
  [ -n "$o" ] || gap "the record has no \`Outcome:\` line"
  [ -n "$m" ] || gap "the record has no \`Milestone:\` line"
  [ -n "$t" ] || gap "the record has no \`Tickets:\` line"
  tickets=$(keys "$t")
  sec_order "$rec" "Success Criteria" "Confirmed" "Results" "Verdict"

  local scs
  scs=$(section "$rec" "Success Criteria" | sed -n 's/^-[[:space:]]*\(SC[0-9][0-9]*\)\..*/\1/p')
  [ -n "$scs" ] || gap "the record has no criterion (- SC1. ...) under Success Criteria"

  local conf cdate
  conf=$(section "$rec" "Confirmed" | grep -E 'BA.*[A-Za-z].*[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1)
  cdate=$(printf '%s' "$conf" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1)
  if has_section "$rec" "Confirmed" && [ -z "$conf" ]; then gap "Confirmed has no line with BA, a name and a date (YYYY-MM-DD)"; fi
  if [ -n "$cdate" ]; then
    local k id run rd
    for k in $tickets; do
      [ -f "docs/qa/$k.md" ] || continue
      while IFS="$US" read -r id run; do
        [ -n "$id" ] || continue
        rd=$(printf '%s' "$run" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1)
        [ -n "$rd" ] || continue
        [[ "$cdate" > "$rd" ]] && gap "Confirmed ($cdate) is later than the run of $k:$id ($rd)"
      done <<< "$(table "docs/qa/$k.md" "Test matrix" "ID Run" | grep -v '^!')"
    done
  fi

  local sc tk ev vd rs rowsc="" notacc="" c cites
  while IFS="$US" read -r sc tk ev vd rs; do
    case "$sc" in ""|!*) [ "${sc#!}" != "$sc" ] && gap "the Results table has no column ${sc#!}"; continue ;; esac
    rowsc="$rowsc $sc"
    case "$vd" in
      Accepted)
        [ -n "$tk" ] || gap "$sc is Accepted with no ticket"
        [ -n "$ev" ] || gap "$sc is Accepted with no evidence"
        for c in $(keys "$tk"); do
          [ -f "docs/qa/$c.md" ] || gap "$c has no QA record (cited by $sc)"
        done
        for cites in $(printf '%s' "$ev" | grep -oE '[A-Za-z]+-[0-9]+:[A-Za-z0-9]+'); do
          k="${cites%%:*}"; id="${cites#*:}"
          if [ -f "docs/qa/$k.md" ] && ! table "docs/qa/$k.md" "Test matrix" "ID" | grep -qx "$id"; then
            gap "$sc cites $cites, which is not a row of docs/qa/$k.md"
          fi
        done ;;
      "Not accepted") notacc="$notacc $sc" ;;
      *) gap "$sc has a Verdict that is not allowed: \"$vd\" (Accepted or Not accepted)"; notacc="$notacc $sc" ;;
    esac
  done <<< "$(table "$rec" "Results" "SC Tickets Evidence Verdict Reason")"
  for sc in $scs; do
    case " $rowsc " in *" $sc "*) ;; *) gap "$sc has no row in Results"; notacc="$notacc $sc" ;; esac
  done

  local vw
  vw=$(verdict_word "$rec")
  if has_section "$rec" "Verdict"; then
    case "$vw" in
      Accepted|"Not accepted")
        grep -q '^By:' "$rec" || gap "the Verdict has no \`By:\` line (By: BA, <name>)" ;;
      Pending) ;;
      *) gap "the Verdict is not Accepted, Not accepted or Pending" ;;
    esac
  fi
  if [ "$vw" = "Accepted" ]; then
    [ -z "${notacc// /}" ] || gap "the Verdict is Accepted but not every criterion is Accepted:$notacc"
    local k
    for k in $tickets; do
      if [ ! -f "docs/qa/$k.md" ]; then gap "$k has no QA record, so the Verdict cannot be Accepted"
      elif ! bash "$here/qa-ready.sh" "$k" >/dev/null 2>&1; then gap "$k does not pass QA (run qa-ready.sh $k)"; fi
    done
  fi
}

check_milestone() {
  local m outs
  m=$(header Milestone); outs=$(header Outcomes)
  [ -n "$m" ] || gap "the record has no \`Milestone:\` line"
  [ -n "$outs" ] || gap "the record has no \`Outcomes:\` line"
  sec_order "$rec" "Exit check" "Results" "Verdict"

  local ecs
  ecs=$(section "$rec" "Exit check" | sed -n 's/^-[[:space:]]*\(EC[0-9][0-9]*\)\..*/\1/p')
  has_section "$rec" "Exit check" && [ -z "$ecs" ] && gap "the record has no part (- EC1. ...) under Exit check"

  local ec ev vd rs rowec="" notacc="" o
  while IFS="$US" read -r ec ev vd rs; do
    case "$ec" in ""|!*) [ "${ec#!}" != "$ec" ] && gap "the Results table has no column ${ec#!}"; continue ;; esac
    rowec="$rowec $ec"
    case "$vd" in
      Accepted) [ -n "$ev" ] || gap "$ec is Accepted with no evidence" ;;
      "Not accepted") notacc="$notacc $ec" ;;
      *) gap "$ec has a Verdict that is not allowed: \"$vd\" (Accepted or Not accepted)"; notacc="$notacc $ec" ;;
    esac
  done <<< "$(table "$rec" "Results" "EC Evidence Verdict Reason")"
  for ec in $ecs; do
    case " $rowec " in *" $ec "*) ;; *) gap "$ec has no row in Results"; notacc="$notacc $ec" ;; esac
  done

  local vw out_notacc=""
  vw=$(verdict_word "$rec")
  for o in $(keys "$outs"); do
    if [ ! -f "docs/acceptance/$o.md" ]; then gap "the outcome record docs/acceptance/$o.md does not exist"
    elif [ "$(verdict_word "docs/acceptance/$o.md")" != "Accepted" ]; then out_notacc="$out_notacc $o"; fi
  done
  if has_section "$rec" "Verdict"; then
    case "$vw" in
      Accepted|"Not accepted") grep -q '^By:' "$rec" || gap "the Verdict has no \`By:\` line (By: BA, <name>)" ;;
      Pending) ;;
      *) gap "the Verdict is not Accepted, Not accepted or Pending" ;;
    esac
  fi
  if [ "$vw" = "Accepted" ]; then
    for o in $out_notacc; do gap "$o is not Accepted, so the milestone cannot be"; done
    [ -z "${notacc// /}" ] || gap "the Verdict is Accepted but not every exit-check part is Accepted:$notacc"
  fi
}

if [ "$mode" = "--ready" ]; then
  t=$(header Tickets); lines=""
  for k in $(keys "$t"); do
    if [ ! -f "docs/qa/$k.md" ]; then lines="$lines- $k has no QA record
"
    elif ! bash "$here/qa-ready.sh" "$k" >/dev/null 2>&1; then lines="$lines- $k does not pass QA
"; fi
  done
  [ -n "$t" ] || lines="- the record has no \`Tickets:\` line
"
  if [ -z "$lines" ]; then echo "ready"; exit 0; fi
  echo "not ready"; printf '%s' "$lines"; exit 1
fi

case "$slug" in
  milestone-*) check_milestone ;;
  *) check_outcome ;;
esac

[ "$gaps" -eq 0 ] && echo "ok - no gap"
[ "$gaps" -eq 0 ]
