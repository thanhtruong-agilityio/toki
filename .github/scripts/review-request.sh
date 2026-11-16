#!/usr/bin/env bash
# Reads one pull request comment on standard input and says whether it asks for
# a review, without a network call or a model.
#
#   exit 0 and one word   the comment mentions @reviewer:
#                           "ultra" or "standard" when that word follows the
#                           mention, "auto" when the depth is left to the review
#   exit 1, no output     the comment does not ask for a review
#
# The mention is the whole handle: "@reviewers", "@reviewer-bot" and
# "team@reviewer.dev" do not count. Letter case does not matter. A quoted line
# (one that starts with ">") is skipped, so a reply that quotes an earlier
# request does not start a second review. The first mention decides.
set -uo pipefail

mention='(^|[^a-z0-9_.@-])@reviewer(([[:space:]]+(ultra|standard))?)([^a-z0-9_-]|$)'

while IFS= read -r line || [ -n "$line" ]; do
  line=$(printf '%s' "$line" | tr -d '\r' | tr '[:upper:]' '[:lower:]')
  case "$line" in
    '>'* | ' >'* | '  >'* | '   >'*) continue ;;
  esac
  if [[ "$line" =~ $mention ]]; then
    echo "${BASH_REMATCH[4]:-auto}"
    exit 0
  fi
done

exit 1
