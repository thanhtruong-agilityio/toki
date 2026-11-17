#!/usr/bin/env bash
# The shared guard of the reset scripts. Source it after lib.sh.
#
# Every reset script calls `guard_development` as its first step. A reset
# deletes data, so the guard fails closed: anything it is not sure about is a
# refusal.

# guard_development ENV_FILE
# Passes only when NODE_ENV says `development`. The shell and the env file
# are read separately: every source that sets NODE_ENV must say
# `development`, and at least one must set it. A value that is set but empty
# counts as set.
guard_development() {
  local env_file="$1" file_value sources=0 refusal=""

  if [ -n "${NODE_ENV+x}" ]; then
    sources=$((sources + 1))
    if [ "$NODE_ENV" != "development" ]; then
      refusal="NODE_ENV is '$NODE_ENV' in the shell"
    fi
  fi

  if file_value="$(env_file_get "$env_file" NODE_ENV)"; then
    sources=$((sources + 1))
    if [ "$file_value" != "development" ] && [ -z "$refusal" ]; then
      refusal="NODE_ENV is '$file_value' in .env"
    fi
  fi

  if [ "$sources" -eq 0 ]; then
    refusal="NODE_ENV is not set in the shell or in .env"
  fi

  if [ -n "$refusal" ]; then
    fail "Refused: $refusal. A reset runs only when NODE_ENV is 'development'. Nothing was changed."
    return 1
  fi
}

# check_database_names DEVELOPMENT_NAME [TEST_NAME]
# Refuses a development database name that a reset must never drop. Leave
# TEST_NAME out when POSTGRES_TEST_DB is not set.
check_database_names() {
  local dev="$1"

  if [ "$#" -lt 2 ] || [ -z "$2" ]; then
    fail "Refused: POSTGRES_TEST_DB is not set. Set the test database name in .env, so a reset can tell it from the development database. Nothing was changed."
    return 1
  fi
  if [ -z "$dev" ]; then
    fail "Refused: POSTGRES_DB is not set. Set the development database name in .env. Nothing was changed."
    return 1
  fi
  if [ "$dev" = "$2" ]; then
    fail "Refused: POSTGRES_DB and POSTGRES_TEST_DB are both '$dev'. A reset never drops the test database. Nothing was changed."
    return 1
  fi
  case "$dev" in
    postgres | template0 | template1)
      fail "Refused: POSTGRES_DB is '$dev', a system database. Nothing was changed."
      return 1
      ;;
  esac
}

# guard_database_names
# Reads the two names the way the dev scripts read every value (shell, then
# .env), checks them and prints the development database name.
guard_database_names() {
  local dev="" test_name
  dev="$(cfg POSTGRES_DB)" || dev=""
  if test_name="$(cfg POSTGRES_TEST_DB)"; then
    check_database_names "$dev" "$test_name" || return 1
  else
    check_database_names "$dev" || return 1
  fi
  printf '%s' "$dev"
}
