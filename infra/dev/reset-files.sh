#!/usr/bin/env bash
# pnpm dev:reset:files - delete every object in the development bucket and
# keep the bucket.
#
# With --check it runs every check and stops before it changes anything. A
# missing bucket is not one of those checks: it fails the run itself.

set -u

# shellcheck source=infra/dev/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
# shellcheck source=infra/dev/guard.sh
. "$DEV_DIR/guard.sh"

guard_development "$ENV_FILE" || exit 1
bucket="$(require_bucket_name)" || exit 1
require_docker || exit 1
require_service minio || exit 1
[ "${1:-}" = "--check" ] && exit 0

in_minio '
  mc stat "local/$1" >/dev/null 2>&1 || exit 91
  mc rm --recursive --force "local/$1" >/dev/null
' "$bucket"
status=$?

if [ "$status" -eq 91 ]; then
  fail "pnpm dev:reset:files failed: the bucket '$bucket' is missing. Run \`pnpm dev:up\`, which creates it."
  exit 1
fi
if [ "$status" -ne 0 ]; then
  fail "pnpm dev:reset:files failed: could not empty the bucket '$bucket'."
  exit 1
fi

say "The bucket '$bucket' is empty."
