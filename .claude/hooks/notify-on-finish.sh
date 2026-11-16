#!/usr/bin/env bash
# Stop hook: show a desktop notification when Claude finishes a turn.
# Never fails the turn: with no notifier on the machine it does nothing.

project="$(basename "${CLAUDE_PROJECT_DIR:-$PWD}")"
title="Claude Code"
message="Claude finished in ${project}"

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
