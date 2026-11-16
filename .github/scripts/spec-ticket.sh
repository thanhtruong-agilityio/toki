#!/usr/bin/env bash
# Gives a merged spec its ticket, when the spec is ready (see spec-ready.sh).
# Usage (from the repository root, on the merged main):
#   bash .github/scripts/spec-ticket.sh <spec.md> [pr-number]
# Ready:     the issue titled "<intent title> (<KEY>)" is created when it is missing,
#            and gets the "accepted" status label of docs/ticket-config.yml.
# Not ready: no issue is created or changed; the gaps go to the job summary and,
#            with a pr-number, into a comment on that pull request.
# Needs: gh, jq, GH_TOKEN, GH_REPO (or a checkout gh can read the repository from).
# DRY_RUN=1 prints the writes instead of making them.
set -euo pipefail

spec="${1:-}"
pr="${2:-}"
[ -f "$spec" ] || { echo "usage: spec-ticket.sh <spec.md> [pr-number]" >&2; exit 2; }

here=$(cd "$(dirname "$0")" && pwd)
config="docs/ticket-config.yml"
summary="${GITHUB_STEP_SUMMARY:-/dev/null}"

run() { # a write: printed in a dry run, executed otherwise
  if [ "${DRY_RUN:-}" = "1" ]; then printf 'DRY-RUN:'; printf ' %q' "$@"; printf '\n'; else "$@"; fi
}

status_name() { # $1 logical key of the statuses block; prints the tracker name
  [ -f "$config" ] || return 0
  awk -v key="$1" '
    /^statuses:/ { on = 1; next }
    on && /^[^ #]/ { on = 0 }
    on {
      line = $0; sub(/#.*/, "", line)
      split(line, kv, ":")
      k = kv[1]; gsub(/[ \t]/, "", k)
      if (k == key) { v = line; sub(/^[^:]*:[ \t]*/, "", v); sub(/[ \t]+$/, "", v); print v }
    }' "$config"
}

ready=0
report=$(bash "$here/spec-ready.sh" "$spec") || ready=$?
gaps=$(printf '%s\n' "$report" | grep '^- ' || true)

if [ "$ready" -ne 0 ]; then
  echo "$spec: not ready, no ticket."
  printf '%s\n' "$gaps"
  {
    echo "### \`$spec\`: no ticket"
    echo "$gaps"
    echo
  } >> "$summary"
  if [ -n "$pr" ]; then
    body=$(printf '%s\n\n%s\n\n%s\n' \
      "No ticket was made ready for \`$spec\`: it is merged, but these points are still open." \
      "$gaps" \
      "The ticket is made ready when a later merge to \`main\` closes them.")
    run gh pr comment "$pr" --body "$body"
  fi
  exit 0
fi

key=$(sed -n 's/^Ticket:[[:space:]]*\([A-Za-z0-9_-]*\).*/\1/p' "$spec" | head -1)
intent=$(sed -n 's/^Intent:[[:space:]]*\([^[:space:]]*\).*/\1/p' "$spec" | head -1)
name=$(sed -n 's/^# \(Intent:[[:space:]]*\)\{0,1\}//p' "$intent" | head -1)
title="$name ($key)"

accepted=$(status_name accepted); accepted="${accepted:-Ready for Dev}"
# Statuses a merge may move forward from. A ticket already past them is left alone.
early="$(status_name intent)
$(status_name blocked)
$(status_name spec-review)"

origin="merged spec"
[ -n "$pr" ] && origin="#$pr"
note="Spec accepted ($origin). Source of truth: \`$spec\`. Intent: \`$intent\`. No open question or concern."

issue=$(gh issue list --state all --limit 1000 --json number,state,title,labels \
  | jq -c --arg k "($key)" '[.[] | select(.title | endswith($k))] | sort_by(.number) | .[0] // empty')

if [ -z "$issue" ]; then
  body=$(printf 'Intent: %s\n\n%s\n' "$intent" "$(cat "$intent")")
  run gh issue create --title "$title" --label "$accepted" --body "$body"
  echo "$spec: created \"$title\" as $accepted."
  echo "### \`$spec\`: created \"$title\" as $accepted" >> "$summary"
  exit 0
fi

number=$(printf '%s' "$issue" | jq -r '.number')
state=$(printf '%s' "$issue" | jq -r '.state')
labels=$(printf '%s' "$issue" | jq -r '.labels[].name')

if [ "$state" != "OPEN" ] || printf '%s\n' "$labels" | grep -qxF "$accepted"; then
  echo "$spec: #$number needs no change."
  echo "### \`$spec\`: #$number needs no change" >> "$summary"
  exit 0
fi

# The issue has a status label that is not an early one: it is already being built.
if [ -f "$config" ]; then
  while IFS= read -r label; do
    [ -n "$label" ] || continue
    case "$label" in "$accepted") continue ;; esac
    printf '%s\n' "$early" | grep -qxF "$label" && continue
    for k in in-dev in-review in-qa done; do
      if [ "$label" = "$(status_name "$k")" ]; then
        echo "$spec: #$number is already \"$label\"; left alone."
        echo "### \`$spec\`: #$number is already \"$label\"; left alone" >> "$summary"
        exit 0
      fi
    done
  done <<< "$labels"
fi

args=(--add-label "$accepted")
while IFS= read -r label; do
  [ -n "$label" ] || continue
  printf '%s\n' "$labels" | grep -qxF "$label" && args+=(--remove-label "$label")
done <<< "$early"
run gh issue edit "$number" "${args[@]}"
run gh issue comment "$number" --body "$note"
echo "$spec: #$number moved to $accepted."
echo "### \`$spec\`: #$number moved to $accepted" >> "$summary"
