#!/usr/bin/env bash
# Tests for the three project hooks. Usage: bash .claude/hooks/hooks.test.sh
# Each case feeds a tool call as JSON on standard input and checks the exit code
# and, for a refusal, a word of the message on standard error.
set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
repo=$(cd "$here/../.." && pwd)
work=$(mktemp -d)
# Format cases write their files in a folder inside the repository, because
# pnpm only finds Prettier from the project itself; the folder is removed at the end.
fdir="$repo/.hooks-test-$$"
trap 'rm -rf "$work" "$fdir"' EXIT

pass=0
fail=0

# check <name> <expected exit> <expected stderr word or ""> <script> <json> [project dir]
check() {
  local name=$1 want=$2 word=$3 script=$4 json=$5 dir=${6:-$work/proj}
  local err code
  err=$(printf '%s' "$json" | CLAUDE_PROJECT_DIR="$dir" bash "$here/$script" 2>&1 >/dev/null)
  code=$?
  if [ "$code" -ne "$want" ]; then
    echo "FAIL $name: exit $code, wanted $want"
    fail=$((fail + 1))
    return
  fi
  if [ -n "$word" ] && ! printf '%s' "$err" | grep -q -- "$word"; then
    echo "FAIL $name: message lacks '$word'"
    fail=$((fail + 1))
    return
  fi
  echo "ok   $name"
  pass=$((pass + 1))
}

bash_json() { jq -cn --arg c "$1" '{tool_name:"Bash",tool_input:{command:$c}}'; }
edit_json() { jq -cn --arg p "$1" '{tool_name:"Edit",tool_input:{file_path:$p}}'; }
write_json() { jq -cn --arg p "$1" '{tool_name:"Write",tool_input:{file_path:$p}}'; }

# A throw-away git repository whose branch the slug tests change.
mkdir -p "$work/proj" "$fdir"
git -C "$work/proj" init -q
git -C "$work/proj" symbolic-ref HEAD refs/heads/feat/toki-002

# R7: branch-slug hook
s=check-branch-slug.sh
check "R7 git push, no slug" 2 "git branch -m" $s "$(bash_json 'git push github feat/toki-002')"
check "R7 gh pr create, no slug" 2 "git branch -m" $s "$(bash_json 'gh pr create --title x')"
check "R7 git status, no slug" 0 "" $s "$(bash_json 'git status')"
git -C "$work/proj" symbolic-ref HEAD refs/heads/docs/toki-095-claude-md-sections
check "R7 git push, slug" 0 "" $s "$(bash_json 'git push github docs/toki-095-claude-md-sections')"
check "R7 gh pr create, slug" 0 "" $s "$(bash_json 'gh pr create --title x')"

# R8: lock-file hook
s=block-lockfile-edit.sh
check "R8 Edit pnpm-lock.yaml" 2 "pnpm install" $s "$(edit_json "$work/proj/pnpm-lock.yaml")"
check "R8 Write pnpm-lock.yaml" 2 "pnpm install" $s "$(write_json "$work/proj/pnpm-lock.yaml")"
check "R8 Edit nested pnpm-lock.yaml" 2 "pnpm install" $s "$(edit_json "$work/proj/a/b/pnpm-lock.yaml")"
check "R8 Edit package.json" 0 "" $s "$(edit_json "$work/proj/package.json")"
check "R8 Edit pnpm-lock.yaml.md" 0 "" $s "$(edit_json "$work/proj/pnpm-lock.yaml.md")"

# R9: format hook
s=format-after-edit.sh
bad='const   a  =  {b:1}'
printf '%s\n' "$bad" > "$fdir/bad.ts"
check "R9 .ts file" 0 "" $s "$(write_json "$fdir/bad.ts")" "$repo"
if grep -q '^const a = { b: 1 };$' "$fdir/bad.ts"; then
  echo "ok   R9 .ts file is formatted"; pass=$((pass + 1))
else
  echo "FAIL R9 .ts file is not formatted"; fail=$((fail + 1))
fi
printf '%s\n' "$bad" > "$fdir/bad.md"
check "R9 .md file" 0 "" $s "$(write_json "$fdir/bad.md")" "$repo"
if [ "$(cat "$fdir/bad.md")" = "$bad" ]; then
  echo "ok   R9 .md file is unchanged"; pass=$((pass + 1))
else
  echo "FAIL R9 .md file was changed"; fail=$((fail + 1))
fi
mkdir -p "$fdir/dist"
printf '%s\n' "$bad" > "$fdir/dist/out.ts"
check "R9 .prettierignore file" 0 "" $s "$(write_json "$fdir/dist/out.ts")" "$repo"
if [ "$(cat "$fdir/dist/out.ts")" = "$bad" ]; then
  echo "ok   R9 ignored file is unchanged"; pass=$((pass + 1))
else
  echo "FAIL R9 ignored file was changed"; fail=$((fail + 1))
fi
printf '%s\n' "$bad" > "$fdir/bad2.ts"
no_tools=$(dirname "$(command -v jq)")
err=$(printf '%s' "$(write_json "$fdir/bad2.ts")" | CLAUDE_PROJECT_DIR="$repo" PATH="$no_tools:/usr/bin:/bin" bash "$here/$s" 2>&1)
code=$?
if [ "$code" -eq 0 ] && [ "$(cat "$fdir/bad2.ts")" = "$bad" ]; then
  echo "ok   R9 Prettier missing, exit 0"; pass=$((pass + 1))
else
  echo "FAIL R9 Prettier missing: exit $code"; fail=$((fail + 1))
fi
check "R9 file that does not exist" 0 "" $s "$(write_json "$fdir/nothing.ts")" "$repo"
check "R9 not JSON" 0 "" $s "not json" "$repo"

# R10: no absolute path in the three scripts
if grep -nE '/(Users|home)/' "$here"/check-branch-slug.sh "$here"/block-lockfile-edit.sh "$here"/format-after-edit.sh >/dev/null 2>&1; then
  echo "FAIL R10 an absolute path is in a hook script"; fail=$((fail + 1))
else
  echo "ok   R10 no absolute path in a hook script"; pass=$((pass + 1))
fi

echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
