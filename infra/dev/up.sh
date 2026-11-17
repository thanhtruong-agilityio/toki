#!/usr/bin/env bash
# pnpm dev:up - start Postgres, MinIO and Mailpit and wait until all three are
# healthy. Safe to run again: running services and their data are left alone.

set -u

# shellcheck source=infra/dev/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

require_docker || exit 1
require_env_file || exit 1
bucket="$(require_bucket_name)" || exit 1

if ! compose up -d --wait --wait-timeout 180; then
  # Name what is not healthy, unless Compose already stopped on the file itself
  # (a missing value, for example) and said why.
  if services="$(compose config --services 2>/dev/null)"; then
    # Compose gives up as soon as one service fails, while the others may
    # still be starting. Give those a moment to settle, so only the services
    # that really failed are named.
    tries=0
    while [ "$tries" -lt 30 ] &&
      compose ps -a --format '{{.State}} {{.Health}}' 2>/dev/null | grep -q '^running starting$'; do
      sleep 2
      tries=$((tries + 1))
    done
    for service in $services; do
      state="$(compose ps -a --format '{{.State}} {{.Health}}' "$service" 2>/dev/null | head -n 1)"
      if [ "$state" != "running healthy" ]; then
        fail "Not healthy: $service (${state:-not started})"
      fi
    done
  fi
  fail "pnpm dev:up failed: the services are not all healthy."
  exit 1
fi

# The development bucket: created when missing, left alone when present.
if ! in_minio 'mc mb --ignore-existing "local/$1" >/dev/null' "$bucket"; then
  fail "pnpm dev:up failed: could not create the bucket '$bucket' in MinIO."
  exit 1
fi

say "Postgres, MinIO and Mailpit are up and healthy."
