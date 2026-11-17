#!/usr/bin/env bash
# PostToolUse hook (Edit, Write): format the edited file with Prettier.
# Runs only for ts, tsx, js, jsx, mjs, cjs, json and css files; Prettier itself skips
# a file listed in .prettierignore. It never fails the tool call: whatever happens, it
# exits 0. `pnpm format:check` in CI stays the real check.

input="$(cat)"
file="$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)"

case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.css) ;;
  *) exit 0 ;;
esac

[ -f "$file" ] || exit 0
command -v pnpm >/dev/null 2>&1 || exit 0
cd "${CLAUDE_PROJECT_DIR:-$PWD}" 2>/dev/null || exit 0
pnpm exec prettier --write --log-level silent -- "$file" >/dev/null 2>&1
exit 0
