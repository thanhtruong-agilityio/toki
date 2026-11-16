#!/usr/bin/env bash
# Reads one pull request comment on standard input and says whether it asks for
# a review, without a network call or a model. It prints nothing.
#
#   exit 0   the comment mentions @reviewer
#   exit 1   the comment does not ask for a review
#
# The mention is the whole handle: "@reviewers", "@reviewer-bot" and
# "team@reviewer.dev" do not count. Letter case does not matter. A quoted line
# (one that starts with ">") is skipped, so a reply that quotes an earlier
# request does not start a second review.
set -uo pipefail

mention='(^|[^a-z0-9_.@-])@reviewer([^a-z0-9_-]|$)'

while IFS= read -r line || [ -n "$line" ]; do
  line=$(printf '%s' "$line" | tr -d '\r' | tr '[:upper:]' '[:lower:]')
  case "$line" in
    '>'* | ' >'* | '  >'* | '   >'*) continue ;;
  esac
  if [[ "$line" =~ $mention ]]; then
    exit 0
  fi
done

exit 1
