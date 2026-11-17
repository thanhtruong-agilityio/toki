#!/usr/bin/env bash
# PreToolUse hook (Edit, Write): refuse a change to pnpm-lock.yaml.
# `pnpm install` rewrites this file; a hand edit puts it out of step with package.json.
# It covers the Edit and Write tools only; a change made through Bash (`sed -i`, `echo >`)
# is not caught.

input="$(cat)"
file="$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)"

if [ "$(basename -- "$file" 2>/dev/null)" = "pnpm-lock.yaml" ]; then
  cat >&2 <<'MSG'
pnpm-lock.yaml is not edited by hand (this hook covers the Edit and Write tools only).
Change package.json and run `pnpm install`, which rewrites this file.
MSG
  exit 2
fi
exit 0
