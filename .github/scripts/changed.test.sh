#!/usr/bin/env bash
# Tests for changed.sh. Usage: bash .github/scripts/changed.test.sh
# Each case gives one check and a list of changed files, and compares the printed line.
set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
failed=0

# $1 name, $2 check, $3 changed files (one per line), $4 expected output
check() {
  local name="$1" out
  out=$(CHANGED_FILES="$3" bash "$here/changed.sh" "$2" 2>/dev/null)
  if [ "$out" != "$4" ]; then
    echo "FAIL $name: printed \"$out\", expected \"$4\""
    failed=$((failed + 1))
    return
  fi
  echo "ok   $name"
}

# The UI parity check (TOKI-109) reads the app, the tokens, the e2e folder, its own tools and the
# Playwright configs; it does not start for the server, the unit tests' folders or documents.
check "parity: web source" parity "apps/web/src/main.tsx" "run=true"
check "parity: tokens package" parity "packages/tokens/src/tokens.css" "run=true"
check "parity: parity file" parity "e2e/parity/tokens.spec.ts" "run=true"
check "parity: prototype copy" parity "e2e/prototype/index.html" "run=true"
check "parity: its own tool" parity "tools/ui-parity/container.mjs" "run=true"
check "parity: its config" parity "playwright.parity.config.ts" "run=true"
check "parity: lock file" parity "pnpm-lock.yaml" "run=true"
check "parity: other tool" parity "tools/bundle-size/check.mjs" "run=false"
check "parity: documents" parity $'docs/specs/a.md\nCLAUDE.md' "run=false"
check "e2e: the parity tool does not start the e2e job" e2e "tools/ui-parity/container.mjs" "run=false"

# Documents only: nothing that runs code starts.
for c in e2e tests typecheck build size i18n; do
  check "docs only, $c" "$c" $'docs/specs/a.md\nREADME.md\nCLAUDE.md\n.claude/rules/ticket.md\ndocs/plans/TOKI-1.md' "run=false"
done

# Code of an app starts the checks that read it.
check "web source, e2e" e2e "apps/web/src/main.tsx" "run=true"
check "server source, e2e" e2e "apps/server/src/main.ts" "run=true"
check "web source, tests" tests "apps/web/src/main.tsx" "run=true"
check "web source, build" build "apps/web/src/main.tsx" "run=true"
check "web source, size" size "apps/web/src/main.tsx" "run=true"
check "web source, typecheck" typecheck "apps/web/src/main.tsx" "run=true"
check "server source, size" size "apps/server/src/main.ts" "run=false"
check "web source, i18n" i18n "apps/web/src/main.tsx" "run=false"

# A package starts every check that uses it; i18n only its own.
check "shared package, e2e" e2e "packages/shared/src/index.ts" "run=true"
check "shared package, i18n" i18n "packages/shared/src/index.ts" "run=false"
check "i18n package, i18n" i18n "packages/i18n/src/vi.json" "run=true"

# The end-to-end tests do not start the unit tests, and the other way round.
check "e2e file, e2e" e2e "e2e/sign-in.spec.ts" "run=true"
check "e2e file, tests" tests "e2e/sign-in.spec.ts" "run=false"
check "playwright config, e2e" e2e "playwright.config.ts" "run=true"
check "playwright config, tests" tests "playwright.config.ts" "run=false"
check "vitest config, tests" tests "vitest.config.ts" "run=true"
check "vitest config, e2e" e2e "vitest.config.ts" "run=false"
check "bundle size tool, size" size "tools/bundle-size/check.mjs" "run=true"
check "bundle size tool, build" build "tools/bundle-size/check.mjs" "run=false"

# Files that change every result start every check.
for c in e2e tests typecheck build size i18n; do
  check "lock file, $c" "$c" "pnpm-lock.yaml" "run=true"
  check "workflow, $c" "$c" ".github/workflows/ci.yml" "run=true"
  check "root package.json, $c" "$c" "package.json" "run=true"
done

# One code file among documents is enough; an empty change and a deletion are read as given.
check "code among documents" e2e $'docs/a.md\napps/web/src/App.tsx\nREADME.md' "run=true"
check "empty change" e2e "" "run=false"
check "a path with a space" e2e "docs/a b.md" "run=false"

# No base commit: a push to main runs everything.
out=$(env -u CHANGED_FILES -u BASE_SHA bash "$here/changed.sh" e2e 2>/dev/null)
if [ "$out" = "run=true" ]; then echo "ok   no base commit"; else
  echo "FAIL no base commit: printed \"$out\""
  failed=$((failed + 1))
fi

# A wrong call is refused with exit 2.
CHANGED_FILES="" bash "$here/changed.sh" nonsense >/dev/null 2>&1
rc=$?
if [ "$rc" -eq 2 ]; then echo "ok   unknown check"; else
  echo "FAIL unknown check: exit $rc, expected 2"
  failed=$((failed + 1))
fi

[ "$failed" -eq 0 ] || {
  echo "$failed failed"
  exit 1
}
echo "all passed"
