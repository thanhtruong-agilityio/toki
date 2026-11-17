#!/usr/bin/env bash
# pnpm dev:reset:mail - delete every message in the Mailpit inbox.
#
# It calls Mailpit's HTTP API from inside the mailpit container; the container
# is not restarted.
#
# With --check it runs every check and stops before it changes anything.

set -u

# shellcheck source=infra/dev/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
# shellcheck source=infra/dev/guard.sh
. "$DEV_DIR/guard.sh"

guard_development "$ENV_FILE" || exit 1
require_docker || exit 1
require_service mailpit || exit 1
[ "${1:-}" = "--check" ] && exit 0

# DELETE with no message ids deletes them all. Success is an HTTP 200.
if ! in_mailpit '
  printf "DELETE /api/v1/messages HTTP/1.0\r\n\r\n" |
    nc -w 5 127.0.0.1 8025 | head -n 1 | grep -q " 200"
'; then
  fail "pnpm dev:reset:mail failed: Mailpit did not confirm the delete."
  exit 1
fi

say "The Mailpit inbox is empty."
