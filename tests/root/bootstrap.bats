#!/usr/bin/env bats

setup() {
  REPO_ROOT=$(cd "$BATS_TEST_DIRNAME/../.." && pwd -P)
  TEST_HOME="$BATS_TEST_TMPDIR/home"
  FAKE_BIN="$BATS_TEST_TMPDIR/bin"
  mkdir -p "$TEST_HOME" "$FAKE_BIN"
  cat > "$FAKE_BIN/mise" <<'SH'
#!/usr/bin/env sh
[ -n "${MISE_PWD_LOG:-}" ] && pwd >"$MISE_PWD_LOG"
if [ "$1" = "exec" ]; then shift; [ "$1" = "--" ] && shift; exec "$@"; fi
exit 0
SH
  chmod +x "$FAKE_BIN/mise"
  cat > "$FAKE_BIN/npm" <<'SH'
#!/usr/bin/env sh
printf 'argc=%s\n' "$#" >>"$NPM_LOG"
for arg do printf 'arg=%s\n' "$arg" >>"$NPM_LOG"; done
prefix=
while [ "$#" -gt 0 ]; do
  case "$1" in --prefix) shift; prefix=${1:-} ;; esac
  shift || break
done
mkdir -p "$prefix/node_modules/.bin"
cat > "$prefix/node_modules/.bin/pi" <<'PI'
#!/usr/bin/env sh
printf 'PI_BIN=%s\n' "$0" >>"$PI_LOG"
printf 'argc=%s\n' "$#" >>"$PI_LOG"
for arg do printf 'arg=%s\n' "$arg" >>"$PI_LOG"; done
PI
chmod +x "$prefix/node_modules/.bin/pi"
SH
  chmod +x "$FAKE_BIN/npm"
}

copy_repo() {
  clone="$BATS_TEST_TMPDIR/clone"
  mkdir -p "$clone"
  (cd "$REPO_ROOT" && tar --exclude .git -cf - .) | (cd "$clone" && tar -xf -)
  chmod +x "$clone/warden" "$clone/run-warden/bin/warden"
  printf '%s\n' "$clone"
}

@test "fresh clone moves to default WARDEN_HOME and prints welcome" {
  clone=$(copy_repo)
  run env -u WARDEN_HOME -u XDG_DATA_HOME HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_YES=1 MISE_PWD_LOG="$BATS_TEST_TMPDIR/mise-pwd" "$clone/warden"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Welcome to Warden"* ]]
  [ -x "$TEST_HOME/.local/share/warden/warden" ]
  [ "$(cat "$BATS_TEST_TMPDIR/mise-pwd")" = "$TEST_HOME/.local/share/warden" ]
}

@test "fresh clone honors XDG_DATA_HOME for default WARDEN_HOME" {
  clone=$(copy_repo)
  xdg_data="$BATS_TEST_TMPDIR/xdg-data"
  run env -u WARDEN_HOME HOME="$TEST_HOME" XDG_DATA_HOME="$xdg_data" PATH="$FAKE_BIN:$PATH" WARDEN_YES=1 MISE_PWD_LOG="$BATS_TEST_TMPDIR/mise-pwd" "$clone/warden"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Welcome to Warden"* ]]
  [ -x "$xdg_data/warden/warden" ]
  [ "$(cat "$BATS_TEST_TMPDIR/mise-pwd")" = "$xdg_data/warden" ]
}

@test "custom WARDEN_HOME is honored" {
  clone=$(copy_repo)
  custom_home="$BATS_TEST_TMPDIR/custom-warden"
  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_YES=1 WARDEN_HOME="$custom_home" "$clone/warden"
  [ "$status" -eq 0 ]
  [[ "$output" == *"WARDEN_HOME: $custom_home"* ]]
  [ -x "$custom_home/warden" ]
}

@test "bootstrap fails clearly when HOME is unset" {
  clone=$(copy_repo)
  run env -u HOME PATH="$FAKE_BIN:$PATH" WARDEN_HOME="$clone" "$clone/warden"
  [ "$status" -ne 0 ]
  [[ "$output" == *"HOME is required"* ]]
}

@test "bootstrap delegates agents and pi command argv through mise" {
  clone=$(copy_repo)
  agents="$BATS_TEST_TMPDIR/agents"
  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_YES=1 WARDEN_HOME="$clone" WARDEN_AGENTS="$agents" NPM_LOG="$BATS_TEST_TMPDIR/npm.log" PI_LOG="$BATS_TEST_TMPDIR/pi.log" "$clone/warden" agents new ada
  [ "$status" -eq 0 ]
  [ -x "$agents/ada/npm/node_modules/.bin/pi" ]
  grep -F "arg=@earendil-works/pi-coding-agent" "$BATS_TEST_TMPDIR/npm.log"

  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_HOME="$clone" WARDEN_AGENTS="$agents" PI_LOG="$BATS_TEST_TMPDIR/pi.log" "$clone/warden" pi ada --flag "two words"
  [ "$status" -eq 0 ]
  grep -F "PI_BIN=$agents/ada/npm/node_modules/.bin/pi" "$BATS_TEST_TMPDIR/pi.log"
  grep -F "arg=--flag" "$BATS_TEST_TMPDIR/pi.log"
  grep -F "arg=two words" "$BATS_TEST_TMPDIR/pi.log"
}
