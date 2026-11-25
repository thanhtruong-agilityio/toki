#!/usr/bin/env bash
# Tests for acceptance-ready.sh. Usage: bash .github/scripts/acceptance-ready.test.sh
# Each case writes records into a temporary folder and checks the exit code and a
# word of the reported gap. Fixtures are made up.
set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cd "$work" || exit 2
mkdir -p docs/specs docs/qa docs/acceptance
failed=0

cat > docs/specs/sample.md <<'SPEC'
# Sample design

Ticket: TOKI-900

## Requirements
- R1. It lists things.
- R2. It stores things.
SPEC

qa_row() { echo "| $1 | $2 | command | run it | prints 3 lines | out.txt | P1 | QA Ann, 2026-11-25 | $3 | QA Ann, ${4:-2026-11-25} |"; }
qa_cols="| ID | Requirement | Layer | Steps | Expected | Evidence | Priority | Approved | Result | Run |
|---|---|---|---|---|---|---|---|---|---|"
write_qa() { # $1 key, then rows
  local k="$1"; shift
  printf '# QA record: %s\nTicket: %s\nSpec: docs/specs/sample.md\nVersion: v\nEnvironment: e\n\n## Test matrix\n%s\n%s\n' \
    "$k" "$k" "$qa_cols" "$(printf '%s\n' "$@")" > "docs/qa/$k.md"
}
write_qa TOKI-900 "$(qa_row T1 R1 Pass)" "$(qa_row T2 R2 Pass)"
write_qa TOKI-901 "$(qa_row T1 R1 Pass)" "$(qa_row T2 R2 Fail)"

hdr="Outcome: I99
Milestone: M9
Tickets: TOKI-900"
sc="## Success Criteria
- SC1. The thing lists. (source: the done line of I99)
- SC2. The thing stores."
conf="## Confirmed
BA Bea, 2026-11-24"
res_cols="| SC | Tickets | Evidence | Verdict | Reason |
|---|---|---|---|---|"
res="## Results
$res_cols
| SC1 | TOKI-900 | TOKI-900:T1 | Accepted | listed |
| SC2 | TOKI-900 | TOKI-900:T2 | Accepted | stored |"
verd="## Verdict
Accepted
By: BA, Bea"

# $1 name, $2 expected exit, $3 text the output must hold, $4 slug, rest: the record text
check() {
  local name="$1" want="$2" needle="$3" slug="$4" out rc
  printf '%s\n' "$5" > "docs/acceptance/$slug.md"
  out=$(bash "$here/acceptance-ready.sh" "$slug" 2>&1); rc=$?
  if [ "$rc" -ne "$want" ]; then
    echo "FAIL $name: exit $rc, expected $want"; echo "$out"; failed=$((failed + 1)); return
  fi
  if [ -n "$needle" ] && ! printf '%s' "$out" | grep -qF -- "$needle"; then
    echo "FAIL $name: output lacks \"$needle\""; echo "$out"; failed=$((failed + 1)); return
  fi
  echo "ok   $name"
}
rec() { printf '# Acceptance: sample\n%s\n\n%s\n\n%s\n\n%s\n\n%s\n' "$1" "$2" "$3" "$4" "$5"; }

check "clean, accepted" 0 "ok - " out "$(rec "$hdr" "$sc" "$conf" "$res" "$verd")"
check "clean, not accepted" 0 "" out "$(rec "$hdr" "$sc" "$conf" "## Results
$res_cols
| SC1 | TOKI-900 | TOKI-900:T1 | Accepted | listed |
| SC2 | TOKI-900 | TOKI-900:T2 | Not accepted | not stored |" "## Verdict
Not accepted
By: BA, Bea")"
check "pending needs no passing ticket" 0 "" out "$(rec "Outcome: I99
Milestone: M9
Tickets: TOKI-901" "$sc" "$conf" "## Results
$res_cols
| SC1 | TOKI-901 | | Not accepted | not run |
| SC2 | TOKI-901 | | Not accepted | not run |" "## Verdict
Pending")"
check "changes to the criteria are allowed" 0 "" out "$(rec "$hdr" "$sc" "$conf

## Changes to the criteria
- SC3. Added on 2026-11-26 because of a decision." "$res" "$verd")"

check "no outcome line" 1 "Outcome:" out "$(rec "Milestone: M9
Tickets: TOKI-900" "$sc" "$conf" "$res" "$verd")"
check "no milestone line" 1 "Milestone:" out "$(rec "Outcome: I99
Tickets: TOKI-900" "$sc" "$conf" "$res" "$verd")"
check "no tickets line" 1 "Tickets:" out "$(rec "Outcome: I99
Milestone: M9" "$sc" "$conf" "$res" "$verd")"
check "no confirmed section" 1 "## Confirmed" out "$(printf '# A\n%s\n\n%s\n\n%s\n\n%s\n' "$hdr" "$sc" "$res" "$verd")"
check "sections out of order" 1 "order" out "$(rec "$hdr" "$conf" "$sc" "$res" "$verd")"
check "no criteria" 1 "no criterion" out "$(rec "$hdr" "## Success Criteria
nothing" "$conf" "$res" "$verd")"
check "confirmed without a name and date" 1 "Confirmed" out "$(rec "$hdr" "$sc" "## Confirmed
yes" "$res" "$verd")"
check "confirmed after a run" 1 "later than" out "$(rec "$hdr" "$sc" "## Confirmed
BA Bea, 2026-11-26" "$res" "$verd")"
check "results table without a column" 1 "no column Reason" out "$(rec "$hdr" "$sc" "$conf" "## Results
| SC | Tickets | Evidence | Verdict |
|---|---|---|---|
| SC1 | TOKI-900 | TOKI-900:T1 | Accepted |
| SC2 | TOKI-900 | TOKI-900:T2 | Accepted |" "$verd")"
check "no results section" 1 "## Results" out "$(printf '# A\n%s\n\n%s\n\n%s\n\n%s\n' "$hdr" "$sc" "$conf" "$verd")"
check "no verdict section" 1 "## Verdict" out "$(printf '# A\n%s\n\n%s\n\n%s\n\n%s\n' "$hdr" "$sc" "$conf" "$res")"
check "criterion without a result row" 1 "SC2 has no row" out "$(rec "$hdr" "$sc" "$conf" "## Results
$res_cols
| SC1 | TOKI-900 | TOKI-900:T1 | Accepted | listed |" "$verd")"
check "accepted with no ticket" 1 "SC2 is Accepted with no ticket" out "$(rec "$hdr" "$sc" "$conf" "## Results
$res_cols
| SC1 | TOKI-900 | TOKI-900:T1 | Accepted | listed |
| SC2 |  | TOKI-900:T2 | Accepted | stored |" "$verd")"
check "accepted with no evidence" 1 "SC2 is Accepted with no evidence" out "$(rec "$hdr" "$sc" "$conf" "## Results
$res_cols
| SC1 | TOKI-900 | TOKI-900:T1 | Accepted | listed |
| SC2 | TOKI-900 |  | Accepted | stored |" "$verd")"
check "accepted, ticket has no qa record" 1 "TOKI-777 has no QA record" out "$(rec "$hdr" "$sc" "$conf" "## Results
$res_cols
| SC1 | TOKI-900 | TOKI-900:T1 | Accepted | listed |
| SC2 | TOKI-777 | TOKI-777:T1 | Accepted | stored |" "$verd")"
check "cites a row that does not exist" 1 "TOKI-900:T9" out "$(rec "$hdr" "$sc" "$conf" "## Results
$res_cols
| SC1 | TOKI-900 | TOKI-900:T1 | Accepted | listed |
| SC2 | TOKI-900 | TOKI-900:T9 | Accepted | stored |" "$verd")"
check "result verdict word" 1 "SC2" out "$(rec "$hdr" "$sc" "$conf" "## Results
$res_cols
| SC1 | TOKI-900 | TOKI-900:T1 | Accepted | listed |
| SC2 | TOKI-900 | TOKI-900:T2 | Maybe | stored |" "$verd")"
check "verdict accepted with a criterion not accepted" 1 "every criterion" out "$(rec "$hdr" "$sc" "$conf" "## Results
$res_cols
| SC1 | TOKI-900 | TOKI-900:T1 | Accepted | listed |
| SC2 | TOKI-900 | TOKI-900:T2 | Not accepted | no |" "$verd")"
check "verdict accepted with a ticket that fails qa" 1 "TOKI-901 does not pass QA" out "$(rec "Outcome: I99
Milestone: M9
Tickets: TOKI-900, TOKI-901" "$sc" "$conf" "$res" "$verd")"
check "verdict word" 1 "Verdict" out "$(rec "$hdr" "$sc" "$conf" "$res" "## Verdict
Done
By: BA, Bea")"
check "verdict without a role" 1 "By:" out "$(rec "$hdr" "$sc" "$conf" "$res" "## Verdict
Accepted")"

write_qa TOKI-902 "$(qa_row T1 R1 Pass)" "| T2 | R2 | command | run it | prints 3 lines | out.txt | P1 | QA Ann, 2026-11-25 | Pass | QA Ann, yesterday |"
check "run with no date" 1 "TOKI-902:T2 has a Run with no date" out "$(rec "Outcome: I99
Milestone: M9
Tickets: TOKI-902" "$sc" "$conf" "## Results
$res_cols
| SC1 | TOKI-902 | TOKI-902:T1 | Not accepted | no |
| SC2 | TOKI-902 | TOKI-902:T2 | Not accepted | no |" "## Verdict
Pending")"

# --ready
printf '%s\n' "$(rec "$hdr" "$sc" "$conf" "$res" "## Verdict
Pending")" > docs/acceptance/out.md
out=$(bash "$here/acceptance-ready.sh" out --ready 2>&1); rc=$?
if [ "$rc" -eq 0 ] && printf '%s' "$out" | grep -qx "ready"; then echo "ok   --ready, every ticket passes"; else echo "FAIL --ready, every ticket passes: exit $rc"; echo "$out"; failed=$((failed + 1)); fi
printf '%s\n' "$(rec "Outcome: I99
Milestone: M9
Tickets: TOKI-900, TOKI-901, TOKI-777" "$sc" "$conf" "$res" "## Verdict
Pending")" > docs/acceptance/out.md
out=$(bash "$here/acceptance-ready.sh" out --ready 2>&1); rc=$?
if [ "$rc" -eq 1 ] && printf '%s' "$out" | grep -qx "not ready" && printf '%s' "$out" | grep -qF "TOKI-901 does not pass QA" && printf '%s' "$out" | grep -qF "TOKI-777 has no QA record"; then echo "ok   --ready, tickets not ready"; else echo "FAIL --ready, tickets not ready: exit $rc"; echo "$out"; failed=$((failed + 1)); fi

# milestone
mhdr="Milestone: M9
Outcomes: out"
exit_check="## Exit check
- EC1. The app starts.
- EC2. CI is green."
mres_cols="| EC | Evidence | Verdict | Reason |
|---|---|---|---|"
mres="## Results
$mres_cols
| EC1 | run output | Accepted | ok |
| EC2 | CI run 1 | Accepted | ok |"
mrec() { printf '# Milestone\n%s\n\n%s\n\n%s\n\n%s\n' "$1" "$2" "$3" "$4"; }
printf '%s\n' "$(rec "$hdr" "$sc" "$conf" "$res" "$verd")" > docs/acceptance/out.md
check "milestone, clean" 0 "ok - " milestone-m9 "$(mrec "$mhdr" "$exit_check" "$mres" "$verd")"
check "milestone, no outcomes line" 1 "Outcomes:" milestone-m9 "$(mrec "Milestone: M9" "$exit_check" "$mres" "$verd")"
check "milestone, outcome record missing" 1 "docs/acceptance/gone.md" milestone-m9 "$(mrec "Milestone: M9
Outcomes: out, gone" "$exit_check" "$mres" "$verd")"
printf '%s\n' "$(rec "$hdr" "$sc" "$conf" "$res" "## Verdict
Not accepted
By: BA, Bea")" > docs/acceptance/notyet.md
check "milestone, an outcome is not accepted" 1 "notyet is not Accepted" milestone-m9 "$(mrec "Milestone: M9
Outcomes: out, notyet" "$exit_check" "$mres" "$verd")"
check "milestone, exit check part without evidence" 1 "EC2 is Accepted with no evidence" milestone-m9 "$(mrec "$mhdr" "$exit_check" "## Results
$mres_cols
| EC1 | run output | Accepted | ok |
| EC2 |  | Accepted | ok |" "$verd")"
check "milestone, part without a row" 1 "EC2 has no row" milestone-m9 "$(mrec "$mhdr" "$exit_check" "## Results
$mres_cols
| EC1 | run output | Accepted | ok |" "$verd")"
check "milestone, no exit check" 1 "Exit check" milestone-m9 "$(printf '# M\n%s\n\n%s\n\n%s\n' "$mhdr" "$mres" "$verd")"

# usage
bash "$here/acceptance-ready.sh" >/dev/null 2>&1; rc=$?
if [ "$rc" -eq 2 ]; then echo "ok   no argument"; else echo "FAIL no argument: exit $rc, expected 2"; failed=$((failed + 1)); fi
bash "$here/acceptance-ready.sh" nothing >/dev/null 2>&1; rc=$?
if [ "$rc" -eq 2 ]; then echo "ok   record missing"; else echo "FAIL record missing: exit $rc, expected 2"; failed=$((failed + 1)); fi

[ "$failed" -eq 0 ] && echo "all passed"
[ "$failed" -eq 0 ]
