#!/usr/bin/env bash
# pnpm dev:reset - return the development data to a clean state: the database,
# the stored files and the caught mail.
#
# It holds no reset step of its own. It runs the entry points of
# dev:reset:db, dev:reset:files and dev:reset:mail: first each one with
# --check, so nothing changes unless all three can run, then each one for
# real. A step that fails does not stop the ones after it.

set -u

# shellcheck source=scripts/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
# shellcheck source=scripts/guard.sh
. "$DEV_DIR/guard.sh"

guard_development "$ENV_FILE" || exit 1

steps="db files mail"

for step in $steps; do
  if ! bash "$DEV_DIR/reset-$step.sh" --check; then
    fail "pnpm dev:reset stopped before it changed anything: dev:reset:$step cannot run."
    exit 1
  fi
done

failed=""
for step in $steps; do
  if ! bash "$DEV_DIR/reset-$step.sh"; then
    failed="$failed dev:reset:$step"
  fi
done

if [ -n "$failed" ]; then
  fail "pnpm dev:reset failed in:$failed. The other steps ran."
  exit 1
fi

say "The development data is clean."
