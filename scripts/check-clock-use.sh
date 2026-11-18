#!/usr/bin/env bash
# TOKI-008 R19: application code reads time only through an injected clock.
# Prints each file that calls Date.now(, new Date() or a bare timer function;
# exit 1 when there is one. Test files and the system clock file are exempt.
set -u
cd "$(dirname "$0")/.."
hits=$(grep -rnE 'Date\.now\(|new Date\(\)|\bset(Timeout|Interval)\(' \
  apps/server/src packages/client-core/src \
  --include='*.ts' --include='*.tsx' \
  --exclude='*.test.ts' --exclude='*.test.tsx' 2>/dev/null || true)
if [ -n "$hits" ]; then
  echo "Direct time use in application code (use the injected Clock):"
  echo "$hits"
  exit 1
fi
echo "No direct time use in apps/server/src or packages/client-core/src."
