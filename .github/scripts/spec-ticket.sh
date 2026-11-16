#!/usr/bin/env bash
# Gives a merged spec its ticket (see spec-ready.sh for what "ready" means).
# Usage (from the repository root, on the merged main):
#   bash .github/scripts/spec-ticket.sh <spec.md> [pr-number]
# The ticket is the issue titled "<intent title> (<KEY>)"; it is created when missing.
# Ready:     it gets the "accepted" status label of docs/ticket-config.yml.
# Not ready: it gets the "blocked" status label, and a comment lists the open
#            questions and concerns.
# A closed issue, or one already in development or later, is left alone.
# A spec with no `Ticket:` line or no intent file cannot have a ticket: the gaps go
# to the job summary and, with a pr-number, into a comment on that pull request.
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

say() { # one result line, to the log and to the job summary
  echo "$spec: $1"
  echo "### \`$spec\`: $1" >> "$summary"
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

key=$(sed -n 's/^Ticket:[[:space:]]*\([A-Za-z0-9_-]*\).*/\1/p' "$spec" | head -1)
intent=$(sed -n 's/^Intent:[[:space:]]*\([^[:space:]]*\).*/\1/p' "$spec" | head -1)

if [ -z "$key" ] || [ -z "$intent" ] || [ ! -f "$intent" ]; then
  say "no ticket can be made"
  printf '%s\n' "$gaps" | tee -a "$summary"
  if [ -n "$pr" ]; then
    run gh pr comment "$pr" --body "$(printf '%s\n\n%s\n' \
      "No ticket can be made for \`$spec\`: it needs a \`Ticket:\` line and an existing intent file." "$gaps")"
  fi
  exit 0
fi

name=$(sed -n 's/^# \(Intent:[[:space:]]*\)\{0,1\}//p' "$intent" | head -1)
[ -n "$name" ] || name=$(sed -n 's/^# //p' "$spec" | head -1)  # intent without a title line
title="$name ($key)"

accepted=$(status_name accepted); accepted="${accepted:-Ready for Dev}"
blocked=$(status_name blocked); blocked="${blocked:-Blocked}"
origin="merged spec"
[ -n "$pr" ] && origin="#$pr"

# The status the ticket gets, the comment that goes with it, and the statuses it
# may be moved from. Every other status (in development or later) is left alone.
if [ "$ready" -eq 0 ]; then
  target="$accepted"
  note="Spec accepted ($origin). Source of truth: \`$spec\`. Intent: \`$intent\`. No open question or concern."
  from="$(status_name intent)
$(status_name spec-review)
$blocked"
else
  target="$blocked"
  note=$(printf '%s\n\n%s\n\n%s\n' \
    "Spec merged ($origin), source of truth: \`$spec\`. These points of the spec are still open:" \
    "$gaps" \
    "The ticket moves to \"$accepted\" when a later merge to \`main\` closes them.")
  from="$(status_name intent)
$(status_name spec-review)
$accepted"
fi

issue=$(gh issue list --state all --limit 1000 --json number,state,title,labels \
  | jq -c --arg k "($key)" '[.[] | select(.title | endswith($k))] | sort_by(.number) | .[0] // empty')

if [ -z "$issue" ]; then
  body=$(printf 'Intent: %s\n\n%s\n' "$intent" "$(cat "$intent")")
  if [ "${DRY_RUN:-}" = "1" ]; then
    run gh issue create --title "$title" --label "$target" --body "$body"
    [ "$ready" -eq 0 ] || run gh issue comment "<new issue>" --body "$note"
  else
    url=$(gh issue create --title "$title" --label "$target" --body "$body")
    echo "$url"
    [ "$ready" -eq 0 ] || gh issue comment "$url" --body "$note"
  fi
  say "created \"$title\" as $target"
  exit 0
fi

number=$(printf '%s' "$issue" | jq -r '.number')
state=$(printf '%s' "$issue" | jq -r '.state')
labels=$(printf '%s' "$issue" | jq -r '.labels[].name')

if [ "$state" != "OPEN" ]; then
  say "#$number is closed; left alone"
  exit 0
fi

if printf '%s\n' "$labels" | grep -qxF "$target"; then
  # Still blocked after a merge that touched the spec: say what is open now.
  if [ "$ready" -ne 0 ] && [ -n "$pr" ]; then
    run gh issue comment "$number" --body "$note"
    say "#$number stays $target; open points posted"
  else
    say "#$number needs no change"
  fi
  exit 0
fi

for k in in-dev in-review in-qa done; do
  label=$(status_name "$k")
  if [ -n "$label" ] && printf '%s\n' "$labels" | grep -qxF "$label"; then
    say "#$number is already \"$label\"; left alone"
    exit 0
  fi
done

args=(--add-label "$target")
while IFS= read -r label; do
  [ -n "$label" ] || continue
  printf '%s\n' "$labels" | grep -qxF "$label" && args+=(--remove-label "$label")
done <<< "$from"
run gh issue edit "$number" "${args[@]}"
run gh issue comment "$number" --body "$note"
say "#$number moved to $target"
