#!/usr/bin/env bash
# Tests for spec-ready.sh. Usage: bash .github/scripts/spec-ready.test.sh
# Each case writes a small spec into a temporary folder and checks the exit code
# and, for a spec that is not ready, a word of the reported gap.
set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cd "$work" || exit 2
mkdir -p docs/intents docs/specs
printf '# Intent: Sample\nAuthor: A\n' > docs/intents/sample.md

failed=0

# $1 name, $2 expected exit code, $3 text the output must hold ("" for none),
# $4 header lines, $5 open questions, $6 concerns
check() {
  local name="$1" want="$2" needle="$3" spec="docs/specs/case.md" out rc
  {
    printf '# Sample design\n\n%s\n\n' "$4"
    printf '## Requirements\n- R1. It works.\n\n'
    printf '## Open questions from the intent\n%s\n\n' "$5"
    printf '## Areas of concern\n%s\n' "$6"
  } > "$spec"
  out=$(bash "$here/spec-ready.sh" "$spec"); rc=$?
  if [ "$rc" -ne "$want" ]; then
    echo "FAIL $name: exit $rc, expected $want"; echo "$out"; failed=$((failed + 1)); return
  fi
  if [ -n "$needle" ] && ! printf '%s' "$out" | grep -qF "$needle"; then
    echo "FAIL $name: output lacks \"$needle\""; echo "$out"; failed=$((failed + 1)); return
  fi
  echo "ok   $name"
}

head="Intent: docs/intents/sample.md (A)
Ticket: TOKI-900"
decided="1. Something was unclear. Decided: do X. Owner: A."

check "all decided" 0 "ok - ready" "$head" "- Which way? Answered: X. See concern 1." "$decided"
check "no question, no concern" 0 "" "$head" "- The intent lists none." ""
check "question carried to a decided concern" 0 "" "$head" \
  "- Which way? Not answered. Carried forward as concern 1." "$decided"
check "accepted counts as a decision" 0 "" "$head" "" "1. A limit exists. Accepted: it stays. Owner: A."
check "decision after 'not decided'" 0 "" "$head" "" \
  "1. The format is not decided, so R1 is vague. Decided: JSON. Owner: A."
check "partial answer completed by a decision" 0 "" "$head" "" \
  "1. Versions. Answered in part: no pnpm version. Decided for the rest: pin it. Owner: A."
check "concern over two lines" 0 "" "$head" "" "1. Something was unclear.
   Decided: do X. Owner: A."
check "assumption does not block" 0 "note: assumption" "$head" "" "$decided

Assumption: the file is named a.yml."

check "no ticket line" 1 "Ticket:" "Intent: docs/intents/sample.md (A)" "" "$decided"
check "no intent line" 1 "Intent:" "Ticket: TOKI-900" "" "$decided"
check "intent file missing" 1 "does not exist" "Intent: docs/intents/none.md (A)
Ticket: TOKI-900" "" "$decided"
check "question not answered" 1 "open question not answered" "$head" "- Which way? Not answered." "$decided"
check "question carried to a missing concern" 1 "concern 7, which does not exist" "$head" \
  "- Which way? Not answered. Carried forward as concern 7." "$decided"
check "question carried to an open concern" 1 "concern 1 is still open" "$head" \
  "- Which way? Not answered. Carried forward as concern 1." "1. Which way. Not decided. Owner: A."
check "concern with no decision" 1 "concern 1 records no decision" "$head" "" \
  "1. Decide whether X or Y. Owner: A."
check "proposal is not a decision" 1 "concern 1 is still open" "$head" "" \
  "1. The default is unknown. Proposal, not a decision: teal. Owner: A."
check "open part after a decision" 1 "concern 1 is still open" "$head" "" \
  "1. Two points. Decided: X for the first. Not decided: the second. Owner: A."
check "'still open' after a decision" 1 "concern 1 is still open" "$head" "" \
  "1. Rules. Decided by A on 2026-11-12. Still open: whether a hook is wanted. Owner: A."
check "partial answer alone" 1 "concern 1 records no decision" "$head" "" \
  "1. Versions. Answered in part: no pnpm version yet. Owner: A."
check "second concern open" 1 "concern 2 is still open" "$head" "" "$decided
2. Another point. Not decided. Owner: A."

[ "$failed" -eq 0 ] && echo "all cases passed"
[ "$failed" -eq 0 ]
