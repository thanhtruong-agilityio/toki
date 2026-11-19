#!/usr/bin/env bash
# Stop hook: show a desktop notification when Claude finishes a turn.
# When the turn completed tasks of the task list, the notification names them.
# Never fails the turn: with no notifier on the machine it does nothing.
# NOTIFY_DRY_RUN=1 prints the message and shows no notification.

project="$(basename "${CLAUDE_PROJECT_DIR:-$PWD}")"
title="Claude Code"
message="Claude finished in ${project}"

# Replays the update_plan calls of the transcript (one JSON object per line) and
# prints "Done <done>/<all>: <titles>" for the tasks completed since the last
# message of the user. Prints nothing when the turn completed none.
tasks_done() {
  jq -nRr '
    def complete($i):
      if $i >= 0 and $i < (.items | length) and .items[$i].status != "completed"
      then .turn += [.items[$i].content] | .items[$i].status = "completed"
      else . end;
    def first_with($status): .items | map(.status) | index($status);

    reduce (inputs | fromjson? | select(type == "object")) as $e ({items: [], turn: []};
      if $e.type == "user"
         and ($e.message.content | type == "string" or (type == "array" and any(.[]; .type == "text")))
      then .turn = []
      elif $e.type == "assistant" then
        reduce ($e.message.content[]?
                | select(.type == "tool_use" and (.name | endswith("update_plan")))
                | .input) as $in (.;
          (if $in.items then
             [.items[] | select(.status == "completed") | .content] as $old
             | .items = [$in.items[] | {content, status}]
             | .turn += [.items[] | select(.status == "completed") | .content
                         | select(. as $c | $old | index($c) | not)]
           else . end)
          | (if $in.advance == true then
               (first_with("in_progress") // -1) as $i | complete($i)
               | first_with("pending") as $j
               | if $j != null then .items[$j].status = "in_progress" else . end
             else . end)
          | reduce ($in.done // [] | .[]) as $n (.; complete($n - 1))
          | (if $in.start and $in.start >= 1 and $in.start <= (.items | length)
             then .items[$in.start - 1].status = "in_progress" else . end))
      else . end)
    | select(.turn | length > 0)
    | "Done \([.items[] | select(.status == "completed")] | length)/\(.items | length): \(.turn | join(", "))"
    | if length > 150 then .[0:147] + "..." else . end
  ' "$1" 2>/dev/null
}

if [ ! -t 0 ] && command -v jq >/dev/null 2>&1; then
  transcript="$(jq -r '.transcript_path // empty' 2>/dev/null)"
  if [ -n "$transcript" ] && [ -r "$transcript" ]; then
    done_line="$(tasks_done "$transcript")"
    if [ -n "$done_line" ]; then
      title="Claude Code - ${project}"
      message="$done_line"
    fi
  fi
fi

if [ -n "${NOTIFY_DRY_RUN:-}" ]; then
  printf '%s\n' "$message"
  exit 0
fi

case "$(uname -s)" in
  Darwin)
    if command -v osascript >/dev/null 2>&1; then
      osascript - "$message" "$title" >/dev/null 2>&1 <<'APPLESCRIPT'
on run argv
  display notification (item 1 of argv) with title (item 2 of argv) sound name "Glass"
end run
APPLESCRIPT
    fi
    ;;
  Linux)
    if command -v notify-send >/dev/null 2>&1; then
      notify-send "$title" "$message" >/dev/null 2>&1
    fi
    ;;
esac

exit 0
