#!/usr/bin/env bash
# Checks behind the rows of docs/qa/TOKI-096.md. Read-only. No network, no model.
# Usage (from the repository root): V=<commit> bash docs/qa/TOKI-096.checks.sh [T1 T2 ...]
# It reads files of the commit V with `git show` and prints one line for each row:
# "<ID> <values>": counts, names and words, never the value of a variable. With no
# argument it runs every row except T5.
# T5 reads the QA's own `.env` in the current directory and prints the count and the names
# of the required variables that are unset or empty. Only the QA runs T5, in their own
# terminal; Claude never runs it.
set -uo pipefail
V="${V:-HEAD}"
US=$'\037'
ENVDOC=docs/environment-config.md
doc() { git show "$V:$1" 2>/dev/null; }

# Inventory rows: name, purpose, read by, required, default, development value, supplied by,
# secret, joined by US, backticks removed. A row with other than eight cells prints "!PARSE".
INV=$(doc "$ENVDOC" | awk '
  function clean(s) { gsub(/`/, "", s); gsub(/^[ \t]+|[ \t]+$/, "", s); return s }
  /^## / { on = ($0 ~ /^## Inventory/); next }
  on && /^\| `/ {
    n = split($0, c, "|")
    if (n != 10) { print "!PARSE"; next }
    line = clean(c[2])
    for (i = 3; i <= 9; i++) line = line "\037" clean(c[i])
    print line
  }')
f() { printf '%s\n' "$INV" | awk -F"$US" -v col="$1" '$1 != "!PARSE" {print $col}'; }
row() { printf '%s\n' "$INV" | awk -F"$US" -v n="$1" '$1 == n'; }
field() { row "$1" | awk -F"$US" -v col="$2" '{print $col}'; } # name, column number
has() { [ -n "$(row "$1")" ]; }
section() { doc "$ENVDOC" | awk -v h="$1" '/^## /{on = (index($0, "## " h) == 1)} on'; }
example() { doc .env.example | sed -n 's/^\([A-Z][A-Z0-9_]*\)=\(.*\)$/\1\x1f\2/p'; }
example_value() { example | awk -F"$US" -v n="$1" '$1 == n {print $2}'; }
parse_errors() { printf '%s\n' "$INV" | grep -c '^!PARSE'; }

t1() {
  local out
  out=$(doc "$ENVDOC" | awk '
    /^## / { on = ($0 ~ /^## Inventory/) }
    on && /^\| Name \|/ {
      tables++
      split("Name Purpose Read by Required Default Development value Supplied by Secret", need, " ")
      line = $0
      miss += (line ~ /\| Name /) ? 0 : 1
      miss += (line ~ /\| Purpose /) ? 0 : 1
      miss += (line ~ /\| Read by /) ? 0 : 1
      miss += (line ~ /\| Required /) ? 0 : 1
      miss += (line ~ /\| Default /) ? 0 : 1
      miss += (line ~ /\| Development value /) ? 0 : 1
      miss += (line ~ /\| Supplied by /) ? 0 : 1
      miss += (line ~ /\| Secret /) ? 0 : 1
    }
    END { print miss + 0, tables + 0 }')
  echo "T1 $out"
}

t2() {
  local ok=0 cat names
  names=$(f 1)
  hasall() { local n; for n in "$@"; do printf '%s\n' "$names" | grep -qx "$n" || return 1; done; }
  hasall NODE_ENV SERVER_PORT SERVER_HOST LOG_LEVEL && ok=$((ok + 1))
  hasall DATABASE_URL && ok=$((ok + 1))
  hasall POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB && ok=$((ok + 1))
  hasall POSTGRES_TEST_DB TEST_DATABASE_URL && ok=$((ok + 1))
  hasall MINIO_ROOT_USER MINIO_ROOT_PASSWORD MINIO_BUCKET && ok=$((ok + 1))
  hasall POSTGRES_PORT MINIO_PORT MINIO_CONSOLE_PORT MAILPIT_SMTP_PORT MAILPIT_WEB_PORT && ok=$((ok + 1))
  hasall SMTP_HOST SMTP_PORT MAIL_FROM_ADDRESS && ok=$((ok + 1))
  hasall FIRST_ADMIN_EMAIL && ok=$((ok + 1))
  hasall FIRST_ADMIN_NAME && ok=$((ok + 1))
  hasall WORKSPACE_NAME && ok=$((ok + 1))
  hasall APP_DOMAIN && ok=$((ok + 1))
  doc "$ENVDOC" | awk '/^### Backup storage/{on=1; next} /^## |^### /{on=0} on' | grep -q 'No variable in phase 1' && ok=$((ok + 1))
  echo "T2 $ok"
}

t3() {
  local inv ex only_inv only_ex bad=0 badnames="" n sec dv ev
  inv=$(f 1 | sort -u); ex=$(example | awk -F"$US" '{print $1}' | sort -u)
  only_inv=$(comm -23 <(printf '%s\n' "$inv") <(printf '%s\n' "$ex") | grep -c .)
  only_ex=$(comm -13 <(printf '%s\n' "$inv") <(printf '%s\n' "$ex") | grep -c .)
  for n in $inv; do
    sec=$(field "$n" 8); [ "$sec" = "no" ] || continue
    dv=$(field "$n" 6); [ "$dv" = "empty" ] && dv=""
    ev=$(example_value "$n")
    if [ "$dv" != "$ev" ]; then bad=$((bad + 1)); badnames="$badnames $n"; fi
  done
  echo "T3 $only_inv $only_ex $bad"
  [ -z "$badnames" ] || echo "  non-secret values that differ:$badnames"
}

t4() {
  local missing=0 checked=0 n
  while IFS= read -r n; do
    [ -n "$n" ] || continue
    if [ "$(field "$n" 4)" = "yes" ] && printf '%s' "$(field "$n" 3)" | grep -qE 'server|production compose'; then
      checked=$((checked + 1))
      [ -n "$(field "$n" 7)" ] || missing=$((missing + 1))
    fi
  done <<< "$(f 1)"
  echo "T4 $missing $checked"
}

t5() { # run by the QA only: reads .env in the current directory, prints no value
  local missing=0 names="" n line
  [ -f .env ] || { echo "T5 no .env in this directory"; return; }
  while IFS= read -r n; do
    [ -n "$n" ] || continue
    [ "$(field "$n" 4)" = "yes" ] || continue
    printf '%s' "$(field "$n" 3)" | grep -q 'production compose' && continue
    line=$(grep -E "^$n=." .env | head -1)
    if [ -z "$line" ]; then missing=$((missing + 1)); names="$names $n"; fi
  done <<< "$(f 1)"
  echo "T5 $missing"
  [ -z "$names" ] || echo "  unset or empty:$names"
}

t6() {
  local ext hdr c rows=0 cols=0 backup
  ext=$(section "External values")
  printf '%s\n' "$ext" | grep -qE '^\| Domain' && rows=$((rows + 1))
  printf '%s\n' "$ext" | grep -qE '^\| Mail account' && rows=$((rows + 1))
  printf '%s\n' "$ext" | grep -qE '^\| VPS' && rows=$((rows + 1))
  hdr=$(printf '%s\n' "$ext" | grep -m1 '^| Value needed')
  for c in 'Value needed' 'Owner' 'Status' 'Needed before'; do
    printf '%s\n' "$hdr" | grep -q "| $c " && cols=$((cols + 1))
  done
  backup=$(printf '%s\n' "$ext" | grep -c '^|.*[Bb]ackup')
  echo "T6 $rows $cols $backup"
}

t7() {
  local sec dev prod sections=0 d=0 p=0 x
  sec=$(section "How secrets are kept")
  printf '%s\n' "$sec" | grep -q '^### Development' && printf '%s\n' "$sec" | grep -q '^### Production' && sections=1
  dev=$(printf '%s\n' "$sec" | awk '/^### Development/{on=1; next} /^### /{on=0} on')
  prod=$(printf '%s\n' "$sec" | awk '/^### Production/{on=1; next} /^### /{on=0} on')
  for x in '`.env` lives in the root' 'Only the builder' 'never committed'; do printf '%s\n' "$dev" | grep -qF -- "$x" && d=$((d + 1)); done
  for x in 'its own `.env` on the server' 'never committed' 'TOKI-085'; do printf '%s\n' "$prod" | grep -qF -- "$x" && p=$((p + 1)); done
  echo "T7 $sections $d $p"
}

t8() {
  local tmp a=0 b=0 p
  tmp=$(mktemp -d); git init -q "$tmp"; doc .gitignore > "$tmp/.gitignore"
  for p in .env .env.local apps/server/.env; do (cd "$tmp" && git check-ignore -q "$p") && a=$((a + 1)); done
  (cd "$tmp" && git check-ignore -q .env.example) && b=$((b + 1))
  rm -rf "$tmp"
  echo "T8 $a $b"
}

t9() {
  local n bad=0 hits
  while IFS= read -r n; do
    [ -n "$n" ] || continue
    [ "$(field "$n" 8)" = "yes" ] || continue
    [ -z "$(example_value "$n")" ] || bad=$((bad + 1))
  done <<< "$(f 1)"
  hits=$({ doc "$ENVDOC"; doc .env.example; } | grep -cE '://[^/[:space:]]+:[^@[:space:]]+@|[A-Za-z0-9]{32,}|(sk|pk|ghp|xox[bp]|AKIA)[-_A-Za-z0-9]{10,}|BEGIN [A-Z ]*PRIVATE KEY')
  echo "T9 $bad $hits"
}

t10() {
  local merge later=0 found=0 k start
  merge=$(git log "$V" --first-parent --merges --format='%ct %s' | grep -i 'toki-096' | tail -1 | cut -d' ' -f1)
  [ -n "$merge" ] || { echo "T10 no merge of TOKI-096 found"; return; }
  for k in 003 004 005 006 008; do
    start=$(git log "$V" --format=%at -i --grep="TOKI-$k" -- . ':!docs' ':!.claude' ':!.github' | sort -n | head -1)
    [ -n "$start" ] || continue
    found=$((found + 1))
    [ "$start" -gt "$merge" ] && later=$((later + 1))
  done
  echo "T10 $later $found"
}

t11() {
  local sec=0 purpose=0 parts=0 n
  for n in DATABASE_URL TEST_DATABASE_URL; do [ "$(field "$n" 8)" = "yes" ] && sec=$((sec + 1)); done
  field TEST_DATABASE_URL 2 | grep -qi 'test database' && purpose=1
  for n in DATABASE_HOST DATABASE_PORT DATABASE_USER DATABASE_PASSWORD DATABASE_NAME DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME; do has "$n" && parts=$((parts + 1)); done
  echo "T11 $sec $purpose $parts"
}

t12() {
  local ok=0
  [ "$(field SERVER_PORT 5)" = "3000" ] && ok=$((ok + 1))
  [ "$(field SERVER_HOST 5)" = "127.0.0.1" ] && ok=$((ok + 1))
  has NODE_ENV && ok=$((ok + 1))
  has LOG_LEVEL && ok=$((ok + 1))
  [ "$(field POSTGRES_PORT 5)" = "5432" ] && ok=$((ok + 1))
  [ "$(field MINIO_PORT 5)" = "9000" ] && ok=$((ok + 1))
  doc "$ENVDOC" | grep -q 'web 5173' && ok=$((ok + 1))
  echo "T12 $ok"
}

t13() {
  local line refs ends
  line=$(doc .github/workflows/ci.yml | grep 'TEST_DATABASE_URL')
  [ -n "$line" ] || { echo "T13 no TEST_DATABASE_URL in the CI workflow"; return; }
  refs=$(printf '%s\n' "$line" | grep -c 'secrets\.')
  ends=$(printf '%s\n' "$line" | grep -cE '/[A-Za-z0-9_]+_test[[:space:]]*$')
  echo "T13 $refs $ends"
}

t14() {
  local inv ex word
  word() { # an address on stdin: reserved, not-reserved or empty (the domain is never printed)
    local a d; a=$(cat); [ -n "$a" ] || { echo empty; return; }
    d="${a#*@}"
    case "$d" in example.com|example.org|example.net|localhost|*.test|*.example|*.invalid|*.localhost) echo reserved ;; *) echo not-reserved ;; esac
  }
  inv=$(field FIRST_ADMIN_EMAIL 6 | word); ex=$(example_value FIRST_ADMIN_EMAIL | word)
  echo "T14 $inv $ex"
}

[ "$(parse_errors)" = "0" ] || echo "parse error: $(parse_errors) inventory row(s) do not have eight cells" >&2
rows="${*:-T1 T2 T3 T4 T6 T7 T8 T9 T10 T11 T12 T13 T14}"
for r in $rows; do
  fn=$(printf '%s' "$r" | tr 'T' 't')
  if declare -F "$fn" >/dev/null; then "$fn"; else echo "$r is not a row" >&2; fi
done
