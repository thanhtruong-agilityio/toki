#!/usr/bin/env bash
# Tests for review-request.sh. Usage: bash .github/scripts/review-request.test.sh
# Each case feeds one comment body to the script and checks the exit code.
set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
failed=0

# $1 name, $2 expected exit code, $3 comment body
check() {
  local name="$1" want="$2" out rc
  out=$(printf '%s' "$3" | bash "$here/review-request.sh"); rc=$?
  if [ "$rc" -ne "$want" ]; then
    echo "FAIL $name: exit $rc, expected $want"; echo "$out"; failed=$((failed + 1)); return
  fi
  if [ -n "$out" ]; then
    echo "FAIL $name: printed \"$out\", expected nothing"; failed=$((failed + 1)); return
  fi
  echo "ok   $name"
}

check "mention alone"             0 "@reviewer"
check "mention in a sentence"     0 "Ready now, @reviewer please take a look."
check "mention then punctuation"  0 "ping @reviewer."
check "mention in capitals"       0 "@Reviewer"
check "second line"               0 "Done with the fixes.
@reviewer"
check "windows line ends"         0 $'@reviewer\r\n'
check "quoted then real"          0 "> @reviewer
@reviewer"

check "no mention"                1 "Looks good to me."
check "empty comment"             1 ""
check "longer handle"             1 "thanks @reviewers"
check "handle with a dash"        1 "thanks @reviewer-bot"
check "an email address"          1 "write to team@reviewer.dev"
check "quoted reply only"         1 "> @reviewer
I agree with the above."
check "glued to a word"           1 "the handle is foo@reviewer"

if [ "$failed" -gt 0 ]; then
  echo "$failed failed"; exit 1
fi
echo "all passed"
