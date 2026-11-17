#!/usr/bin/env bash
# pnpm dev:down - stop the three services. Their data stays in the named
# volumes, so `pnpm dev:up` brings it back.

set -u

# shellcheck source=infra/dev/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

require_docker || exit 1
require_env_file || exit 1

if ! compose down; then
  fail "pnpm dev:down failed."
  exit 1
fi

say "The dev services are stopped. Their data is kept."
