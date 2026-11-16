#!/usr/bin/env bash
# Tests for review-request.sh. Usage: bash .github/scripts/review-request.test.sh
# Each case feeds one comment body to the script and checks the exit code and
# the word it prints.
set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
failed=0

# $1 name, $2 expected exit code, $3 expected output, $4 comment body
check() {
  local name="$1" want="$2" word="$3" out rc
  out=$(printf '%s' "$4" | bash "$here/review-request.sh"); rc=$?
  if [ "$rc" -ne "$want" ]; then
    echo "FAIL $name: exit $rc, expected $want"; echo "$out"; failed=$((failed + 1)); return
  fi
  if [ "$out" != "$word" ]; then
    echo "FAIL $name: printed \"$out\", expected \"$word\""; failed=$((failed + 1)); return
  fi
  echo "ok   $name"
}

check "mention alone"             0 "auto"     "@reviewer"
check "mention in a sentence"     0 "auto"     "Ready now, @reviewer please take a look."
check "mention then punctuation"  0 "auto"     "ping @reviewer."
check "ultra asked"               0 "ultra"    "@reviewer ultra"
check "standard asked"            0 "standard" "@reviewer standard"
check "depth word in capitals"    0 "ultra"    "@reviewer ULTRA please"
check "mention in capitals"       0 "auto"     "@Reviewer"
check "depth word must follow"    0 "auto"     "@reviewer this is not an ultra hard one"
check "second line"               0 "standard" "Done with the fixes.
@reviewer standard"
check "windows line ends"         0 "ultra"    $'@reviewer ultra\r\n'
check "first mention decides"     0 "standard" "@reviewer standard, not @reviewer ultra"

check "no mention"                1 ""         "Looks good to me."
check "empty comment"             1 ""         ""
check "longer handle"             1 ""         "thanks @reviewers"
check "handle with a dash"        1 ""         "thanks @reviewer-bot"
check "an email address"          1 ""         "write to team@reviewer.dev"
check "quoted reply only"         1 ""         "> @reviewer ultra
I agree with the above."
check "quoted then real"          0 "auto"     "> @reviewer ultra
@reviewer"
check "inside a code span word"   1 ""         "the handle is foo@reviewer"

if [ "$failed" -gt 0 ]; then
  echo "$failed failed"; exit 1
fi
echo "all passed"
