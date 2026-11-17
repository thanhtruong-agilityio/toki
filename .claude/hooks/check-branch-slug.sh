#!/usr/bin/env bash
# PreToolUse hook (Bash): refuse `gh pr create` and `git push` from a ticket branch
# that has no slug, e.g. feat/toki-002. The rule is `<type>/<ticket>-<slug>` (CLAUDE.md).
# `dev-state claim` creates `feat/<key>` with no slug; rename it before the PR is opened,
# because renaming on GitHub afterwards closes the pull request.

input="$(cat)"
command="$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)"

case "$command" in
  *"gh pr create"*|*"git push"*) ;;
  *) exit 0 ;;
esac

branch="$(git -C "${CLAUDE_PROJECT_DIR:-$PWD}" symbolic-ref --short HEAD 2>/dev/null)"

if printf '%s' "$branch" | grep -Eq '^[a-z]+/[a-z]+-[0-9]+$'; then
  ticket="${branch#*/}"
  cat >&2 <<MSG
Branch '$branch' has no slug. Name it <type>/<ticket>-<slug>, for example chore/$ticket-short-description,
where the slug says what the ticket does.
Rename it before the pull request is opened:
  git branch -m $branch <type>/$ticket-<slug>
  git push -u origin <type>/$ticket-<slug>
(Renaming after the PR is open closes the PR.) Then run: dev-state set $(echo "$ticket" | tr a-z A-Z) branch <new-name>
MSG
  exit 2
fi
exit 0
