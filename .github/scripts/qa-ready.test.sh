#!/usr/bin/env bash
# Tests for qa-ready.sh. Usage: bash .github/scripts/qa-ready.test.sh
# Each case writes a spec and a QA record into a temporary folder and checks the
# exit code and a word of the reported gap. Fixtures are made up.
set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cd "$work" || exit 2
mkdir -p docs/specs docs/qa
failed=0

cat > docs/specs/sample.md <<'SPEC'
# Sample design

Intent: docs/intents/sample.md (A)
Ticket: TOKI-900

## Requirements
- R1. It lists things.
- R2. It stores things.
- R3. It deletes things.

## Design
Nothing.
SPEC

hdr="Ticket: TOKI-900
Spec: docs/specs/sample.md
Version: abc1234
Environment: local"
cols="| ID | Requirement | Layer | Steps | Expected | Evidence | Priority | Approved | Result | Run |
|---|---|---|---|---|---|---|---|---|---|"
ok_row() { # $1 id, $2 requirement
  echo "| $1 | $2 | command | run it | prints 3 lines | out.txt | P1 | QA Ann, 2026-11-25 | Pass | QA Ann, 2026-11-25 |"
}
all_rows="$(ok_row T1 R1)
$(ok_row T2 R2)
$(ok_row T3 R3)"

# $1 name, $2 expected exit, $3 text the output must hold, $4 header, $5 matrix block, $6 tail
check() {
  local name="$1" want="$2" needle="$3" out rc
  printf '# QA record: TOKI-900\n%s\n\n## Test matrix\n%s\n\n%s\n' "$4" "$5" "${6:-}" > docs/qa/TOKI-900.md
  out=$(bash "$here/qa-ready.sh" TOKI-900 2>&1); rc=$?
  if [ "$rc" -ne "$want" ]; then
    echo "FAIL $name: exit $rc, expected $want"; echo "$out"; failed=$((failed + 1)); return
  fi
  if [ -n "$needle" ] && ! printf '%s' "$out" | grep -qF -- "$needle"; then
    echo "FAIL $name: output lacks \"$needle\""; echo "$out"; failed=$((failed + 1)); return
  fi
  echo "ok   $name"
}

check "clean record" 0 "ok - passes QA" "$hdr" "$cols
$all_rows"
check "excused requirement" 0 "" "$hdr" "$cols
$(ok_row T1 R1)
$(ok_row T2 R2)" "## Not covered
- R3. Dropped in the spec."
check "spaces and extra text in cells" 0 "" "$hdr" "$cols
|  T1  |  R1 (AC-001)  | unit | s | 3 | f.test.ts | P1 |  QA Ann, 2026-11-25 | Pass | QA Ann, 2026-11-25 |
$(ok_row T2 R2)
$(ok_row T3 R3)"

check "no ticket line" 1 "Ticket:" "Spec: docs/specs/sample.md
Version: v
Environment: e" "$cols
$all_rows"
check "ticket line differs from the file" 1 "TOKI-901" "Ticket: TOKI-901
Spec: docs/specs/sample.md
Version: v
Environment: e" "$cols
$all_rows"
check "no spec line" 1 "Spec:" "Ticket: TOKI-900
Version: v
Environment: e" "$cols
$all_rows"
check "spec file missing" 1 "does not exist" "Ticket: TOKI-900
Spec: docs/specs/none.md
Version: v
Environment: e" "$cols
$all_rows"
check "no version line" 1 "Version:" "Ticket: TOKI-900
Spec: docs/specs/sample.md
Environment: e" "$cols
$all_rows"
check "no environment line" 1 "Environment:" "Ticket: TOKI-900
Spec: docs/specs/sample.md
Version: v" "$cols
$all_rows"
check "missing column" 1 "column Evidence" "$hdr" "| ID | Requirement | Layer | Steps | Expected | Priority | Approved | Result | Run |
|---|---|---|---|---|---|---|---|---|
| T1 | R1 | unit | s | v | P1 | a | Pass | r |"
check "no matrix" 1 "no test matrix" "$hdr" "nothing here"
check "requirement without a row" 1 "R3 has no test case and no reason" "$hdr" "$cols
$(ok_row T1 R1)
$(ok_row T2 R2)"
check "row for a requirement the spec lacks" 1 "R9" "$hdr" "$cols
$all_rows
$(ok_row T4 R9)"
check "layer not allowed" 1 "layer" "$hdr" "$cols
$(ok_row T1 R1)
$(ok_row T2 R2)
| T3 | R3 | smoke | s | v | f | P1 | QA Ann, 2026-11-25 | Pass | QA Ann, 2026-11-25 |"
check "expected is vague" 1 "Expected" "$hdr" "$cols
$(ok_row T1 R1)
$(ok_row T2 R2)
| T3 | R3 | unit | s | works | f | P1 | QA Ann, 2026-11-25 | Pass | QA Ann, 2026-11-25 |"
check "expected is empty" 1 "Expected" "$hdr" "$cols
$(ok_row T1 R1)
$(ok_row T2 R2)
| T3 | R3 | unit | s |  | f | P1 | QA Ann, 2026-11-25 | Pass | QA Ann, 2026-11-25 |"
check "pass without evidence" 1 "T3 is Pass with no Evidence" "$hdr" "$cols
$(ok_row T1 R1)
$(ok_row T2 R2)
| T3 | R3 | unit | s | 3 lines |  | P1 | QA Ann, 2026-11-25 | Pass | QA Ann, 2026-11-25 |"
check "result without approval" 1 "T3 has a Result and no Approved" "$hdr" "$cols
$(ok_row T1 R1)
$(ok_row T2 R2)
| T3 | R3 | unit | s | 3 lines | f | P1 |  | Pass | QA Ann, 2026-11-25 |"
check "result without a run" 1 "T3 has a Result and no Run" "$hdr" "$cols
$(ok_row T1 R1)
$(ok_row T2 R2)
| T3 | R3 | unit | s | 3 lines | f | P1 | QA Ann, 2026-11-25 | Pass |  |"
check "result word not allowed" 1 "T3" "$hdr" "$cols
$(ok_row T1 R1)
$(ok_row T2 R2)
| T3 | R3 | unit | s | 3 lines | f | P1 | QA Ann, 2026-11-25 | Passed | QA Ann, 2026-11-25 |"
check "failed row" 1 "T3 is Fail" "$hdr" "$cols
$(ok_row T1 R1)
$(ok_row T2 R2)
| T3 | R3 | unit | s | 3 lines | f | P1 | QA Ann, 2026-11-25 | Fail | QA Ann, 2026-11-25 |"
check "blocked row is not passed" 1 "T3 is Blocked" "$hdr" "$cols
$(ok_row T1 R1)
$(ok_row T2 R2)
| T3 | R3 | manual | s | 3 lines |  | P1 | QA Ann, 2026-11-25 | Blocked | QA Ann, 2026-11-25 |"
check "row not run" 1 "T3 has not been run" "$hdr" "$cols
$(ok_row T1 R1)
$(ok_row T2 R2)
| T3 | R3 | unit | s | 3 lines | f | P1 | QA Ann, 2026-11-25 |  |  |"
check "duplicate id" 1 "T1 is used twice" "$hdr" "$cols
$all_rows
$(ok_row T1 R2)"

# usage
bash "$here/qa-ready.sh" >/dev/null 2>&1; rc=$?
if [ "$rc" -eq 2 ]; then echo "ok   no argument"; else echo "FAIL no argument: exit $rc, expected 2"; failed=$((failed + 1)); fi
bash "$here/qa-ready.sh" TOKI-777 >/dev/null 2>&1; rc=$?
if [ "$rc" -eq 2 ]; then echo "ok   record missing"; else echo "FAIL record missing: exit $rc, expected 2"; failed=$((failed + 1)); fi

[ "$failed" -eq 0 ] && echo "all passed"
[ "$failed" -eq 0 ]
