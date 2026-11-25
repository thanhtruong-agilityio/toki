#!/usr/bin/env bash
# Checks behind the command rows of docs/qa/TOKI-095.md. Read-only: it reads files of one
# commit with `git show` and changes nothing. No network, no model.
# Usage (from the repository root): V=<commit> bash docs/qa/TOKI-095.checks.sh [T1 T2 ...]
# With no argument it runs every command row. Each row prints "<ID> <value>"; the value is
# what the Expected column of that row compares with.
set -uo pipefail
V="${V:-6153cd0}"
doc() { git show "$V:$1" 2>/dev/null; }
sec() { doc CLAUDE.md | awk -v h="$1" '/^## /{on = (index($0, "## " h) == 1)} on'; }
found() { # how many of the fixed strings appear in the text on stdin
  local text n=0 p; text=$(cat)
  for p in "$@"; do printf '%s' "$text" | grep -qF -- "$p" && n=$((n + 1)); done
  echo "$n"
}
settings() { doc .claude/settings.json; }

t1()  { echo "T1 $(sec 'What the project is' | found 'internal team chat' 'single-tenant' 'self-hosted' 'phase 1 is core chat on the web' 'prototype is the only design source')"; }
t2()  { echo "T2 $(doc CLAUDE.md | grep -c '^## Read first')"; }
t3()  { echo "T3 $(sec 'Repository layout' | found 'apps/server' 'apps/web' 'shared/' 'client-core/' 'tokens/' 'i18n/' 'platform/' 'ui-web/' 'e2e/' 'docs/' 'infra/')"; }
t4()  { echo "T4 $(sec 'Common commands' | found '`pnpm install`' '`pnpm typecheck`' '`pnpm lint`' '`pnpm format`' '`pnpm format:check`' '`pnpm dev`' '`pnpm dev:up`' '`pnpm dev:down`' '`pnpm dev:reset`' '`pnpm test`' '`pnpm test:e2e`')"; }
t5()  { echo "T5 $(sec 'Boundary rules' | found 'Server modules call each other only through public interfaces, never each other' '`client-core` touches no DOM or browser API, so React Native can reuse it' 'Components reach platform features only through `platform`' 'file picking cannot be caught by lint')"; }
t6()  { echo "T6 $(sec 'Where documents live' | found '`docs/intents/`' '`docs/specs/`' '`docs/plans/`' '`docs/definition-of-done.md`' '`docs/ticket-config.yml`' '`.github/pull_request_template.md`' '`docs/adr/`' '`docs/handoff/`' '`docs/tickets/`' '`docs/<topic>.md`')"; }
t7()  { echo "T7 $(doc CLAUDE.md | grep -cF '<type>/<ticket>-<slug>') $(sec 'Working agreements' | found 'Example: `docs/toki-095-claude-md-sections`' 'Example: `docs(claude): add the project sections to claude.md (TOKI-095)`')"; }
t8()  { echo "T8 $(sec 'Running tests' | found '`pnpm test` runs the unit tests' '`pnpm test:e2e` runs the end-to-end tests')"; }
t9()  { echo "T9 $(doc CLAUDE.md | grep -c '^## Process') $(doc CLAUDE.md | grep -cF 'intent -> spec -> ticket')"; }
t10() { echo "T10 $(git ls-tree -d "$V" docs/intents docs/specs docs/plans | wc -l | tr -d ' ')"; }
t11() { echo "T11 $(settings | jq -r '[.enabledPlugins | keys[]] | join(",")') $(settings | jq -r '.extraKnownMarketplaces.cl.source.repo')"; }
t12() { echo "T12 $(settings | jq -r '.permissions.allow | length') $(settings | jq -r '.permissions.deny | length')"; }
t13() { echo "T13 $(settings | jq -r '.hooks // "none" | if type == "string" then . else "present" end')"; }
t14() { echo "T14 $({ doc CLAUDE.md; settings; } | grep -ciE '/Users/|/home/|ghp_|github_pat_|sk-[A-Za-z0-9]|xox[bp]-|BEGIN [A-Z ]*PRIVATE KEY')"; }
t15() { echo "T15 $(sec 'Working agreements' | grep -c '^## Working agreements') $(sec 'Advisor' | grep -c '^## Advisor') $(settings | jq -r '[has("extraKnownMarketplaces"), has("enabledPlugins"), has("model"), has("advisorModel")] | map(select(.)) | length')"; }

rows="${*:-T1 T2 T3 T4 T5 T6 T7 T8 T9 T10 T11 T12 T13 T14 T15}"
for r in $rows; do
  fn=$(printf '%s' "$r" | tr 'T' 't')
  if declare -F "$fn" >/dev/null; then "$fn"; else echo "$r not a command row" >&2; fi
done
