#!/usr/bin/env bash
# Tests for the project hooks. Usage: bash .claude/hooks/hooks.test.sh
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
mkdir -p "$work/bin" && ln -s "$(command -v jq)" "$work/bin/jq"
no_tools="$work/bin"
err=$(printf '%s' "$(write_json "$fdir/bad2.ts")" | CLAUDE_PROJECT_DIR="$repo" PATH="$no_tools:/usr/bin:/bin" bash "$here/$s" 2>&1)
code=$?
if [ "$code" -eq 0 ] && [ "$(cat "$fdir/bad2.ts")" = "$bad" ]; then
  echo "ok   R9 Prettier missing, exit 0"; pass=$((pass + 1))
else
  echo "FAIL R9 Prettier missing: exit $code"; fail=$((fail + 1))
fi
check "R9 file that does not exist" 0 "" $s "$(write_json "$fdir/nothing.ts")" "$repo"
check "R9 not JSON" 0 "" $s "not json" "$repo"

# Notification hook: with NOTIFY_DRY_RUN=1 it prints the message and shows nothing.
s=notify-on-finish.sh
user_line() { jq -cn --arg t "$1" '{type:"user",message:{content:$t}}'; }
plan_line() { jq -cn --argjson i "$1" '{type:"assistant",message:{content:[{type:"tool_use",name:"mcp__ccd_turn__update_plan",input:$i}]}}'; }
# notify <name> <expected message> <hook input> [PATH]
notify() {
  local name=$1 want=$2 json=$3 path=${4:-$PATH} out code
  out=$(printf '%s' "$json" | PATH="$path" NOTIFY_DRY_RUN=1 CLAUDE_PROJECT_DIR="$work/proj" bash "$here/$s" 2>&1)
  code=$?
  if [ "$code" -eq 0 ] && [ "$out" = "$want" ]; then
    echo "ok   $name"; pass=$((pass + 1))
  else
    echo "FAIL $name: exit $code, printed \"$out\", wanted \"$want\""; fail=$((fail + 1))
  fi
}
stop_json() { jq -cn --arg p "$1" '{hook_event_name:"Stop",transcript_path:$p}'; }
plain="Claude finished in proj"
t="$work/t1.jsonl"
{
  user_line "first request"
  plan_line '{"items":[{"content":"Read the hook","status":"in_progress"},{"content":"Write the test","status":"pending"},{"content":"Fix the hook","status":"pending"},{"content":"Update the docs","status":"pending"}]}'
  plan_line '{"advance":true}'
  user_line "go on"
  jq -cn '{type:"user",message:{content:[{type:"tool_result",content:"ok"}]}}'
  plan_line '{"advance":true}'
  plan_line '{"done":[4],"start":3}'
  echo '{"type":"assistant","message":{"content":[{"type":"tool_use","na'
} > "$t"
notify "notify tasks done in the last turn" "Done 3/4: Write the test, Update the docs" "$(stop_json "$t")"
t="$work/t2.jsonl"
{
  user_line "first request"
  plan_line '{"items":[{"content":"Read the hook","status":"in_progress"}]}'
  plan_line '{"advance":true}'
  user_line "thanks"
} > "$t"
notify "notify no task done in the last turn" "$plain" "$(stop_json "$t")"
t="$work/t3.jsonl"
{
  user_line "replace the plan"
  plan_line '{"items":[{"content":"A","status":"in_progress"},{"content":"B","status":"pending"}]}'
  plan_line '{"advance":true}'
  plan_line '{"items":[{"content":"A","status":"completed"},{"content":"C","status":"completed"},{"content":"D","status":"in_progress"}]}'
} > "$t"
notify "notify a new list keeps what was done" "Done 2/3: A, C" "$(stop_json "$t")"
t="$work/t4.jsonl"
long=$(printf 'A task with a rather long title number %s,' 1 2 3 4 5 6 7 8)
{
  user_line "many"
  plan_line "$(jq -cn --arg l "$long" '{items:[$l|split(",")[]|select(.!="")|{content:.,status:"completed"}]}')"
} > "$t"
out=$(stop_json "$t" | NOTIFY_DRY_RUN=1 CLAUDE_PROJECT_DIR="$work/proj" bash "$here/$s" 2>&1)
case "$out" in
  "Done 8/8: A task"*...) if [ "${#out}" -le 150 ]; then echo "ok   notify long list is cut"; pass=$((pass + 1)); else echo "FAIL notify long list: ${#out} characters"; fail=$((fail + 1)); fi ;;
  *) echo "FAIL notify long list: printed \"$out\""; fail=$((fail + 1)) ;;
esac
notify "notify no transcript file" "$plain" "$(stop_json "$work/missing.jsonl")"
notify "notify not JSON" "$plain" "not json"
mkdir -p "$work/nojq"
for tool in bash basename cat; do ln -s "$(command -v "$tool")" "$work/nojq/$tool"; done
notify "notify jq missing" "$plain" "$(stop_json "$work/t1.jsonl")" "$work/nojq"

# R10: no absolute path in the three scripts
if grep -nE '/(Users|home)/' "$here"/check-branch-slug.sh "$here"/block-lockfile-edit.sh "$here"/format-after-edit.sh >/dev/null 2>&1; then
  echo "FAIL R10 an absolute path is in a hook script"; fail=$((fail + 1))
else
  echo "ok   R10 no absolute path in a hook script"; pass=$((pass + 1))
fi

echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
