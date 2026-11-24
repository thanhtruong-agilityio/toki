#!/usr/bin/env bash
# Decide whether a CI check has to run, from the files a pull request changes.
#
#   bash .github/scripts/changed.sh <check>      check: e2e | tests | typecheck | build | size | i18n
#
# Prints one line, `run=true` or `run=false`, that the workflow appends to $GITHUB_OUTPUT.
# The files are `git diff --name-only $BASE_SHA HEAD`. With no BASE_SHA (a push to main, a manual run)
# every check runs, so every commit on main gets a full result.
# CHANGED_FILES (one path per line) replaces the git diff; the test file uses it.
#
# A check also runs when a file that changes its result for every area changes: the lock file, the
# root package.json, the TypeScript and workspace configuration, and this workflow and script.
# `lint` is not here: `pnpm format:check` reads the documents too, so lint always runs.
set -euo pipefail

check="${1:-}"

# Patterns of bash `case` (`*` also matches `/`).
common='package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json .nvmrc .github/workflows/ci.yml .github/scripts/changed.sh'
case "$check" in
e2e) own='apps/* packages/* e2e/* playwright*.ts' ;;
tests) own='apps/* packages/* tools/* vitest.config.ts' ;;
typecheck) own='apps/* packages/* e2e/* tools/* playwright*.ts vitest.config.ts' ;;
build) own='apps/* packages/*' ;;
size) own='apps/web/* packages/* tools/bundle-size/*' ;;
i18n) own='packages/i18n/*' ;;
*)
  echo "usage: changed.sh e2e|tests|typecheck|build|size|i18n" >&2
  exit 2
  ;;
esac

if [ -z "${CHANGED_FILES+set}" ]; then
  if [ -z "${BASE_SHA:-}" ]; then
    echo "$check: no base commit, run" >&2
    echo "run=true"
    exit 0
  fi
  CHANGED_FILES="$(git diff --no-renames --name-only "$BASE_SHA" HEAD)"
fi

set -f # the patterns are for `case`, not for the shell to expand
while IFS= read -r file; do
  [ -n "$file" ] || continue
  for pattern in $own $common; do
    # shellcheck disable=SC2254
    case "$file" in
    $pattern)
      echo "$check: $file changed, run" >&2
      echo "run=true"
      exit 0
      ;;
    esac
  done
done <<<"$CHANGED_FILES"

echo "$check: no file it depends on changed, skip" >&2
echo "run=false"
